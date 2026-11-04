import http from 'node:http';
import crypto from 'node:crypto';
import {
  GameHall,
  PlayerRole,
  PlayerStatus,
  Room,
  RoomPlayer,
  RoomStatus,
  type IPlayer,
  type IRoomOptions,
} from '@yige/engine';
import { SocketManager } from './socket';
import Games, { GameRoom, type IGameInfo } from './games';
import { restoreGameState } from './games';
import { findUserById } from './auth/service';
import type { SessionUser } from './auth/types';

export interface LobbyMessage {
  content: string;
  sender?: { id: string; name: string };
  createdAt: number;
}

export class Controller extends GameHall {
  messages: LobbyMessage[] = [];
  socket: SocketManager;
  private instances = new Map<string, GameRoom>();

  constructor(server: http.Server, socket: SocketManager) {
    super({ socket: socket as unknown as any });
    this.socket = socket;
  }

  /** 暴露给 /api/config 的游戏清单 */
  get games() {
    return Object.keys(Games).reduce((all, key) => {
      const meta = Games[key];
      all[key] = {
        name: meta.name,
        minSize: meta.minSize,
        maxSize: meta.maxSize,
        description: meta.description,
        table: meta.table ?? 'custom',
        ai: meta.ai ?? 'none',
        settings: meta.settings ?? [],
        requireAllReadyToStart: meta.requireAllReadyToStart ?? true,
      } satisfies IGameInfo;
      return all;
    }, {} as Record<string, IGameInfo>);
  }

  run() {
    return super
      .run()
      .on('room', (room) => {
        this.attachRoom(room);
      })
      .on('room-player', (room) => {
        if (room.players.length === 0) this.closeRoom(null, room).catch(() => undefined);
      })
      .on('command', (command) => {
        if (command.type !== 'say' || !command.sender) return;
        const content = String(command.data ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!content) return;
        this.messages.push({ content, sender: { id: command.sender.id, name: command.sender.name }, createdAt: Date.now() });
        this.messages = this.messages.slice(-200);
        this.emit('message', content, command.sender);
      })
      .on('error', (error) => console.error('[hall]', error));
  }

  private attachRoom(room: Room) {
    const type = room.attrs?.type;
    const meta = type ? Games[type] : undefined;
    if (!meta) {
      this.send({ type: 'global.error' as any, data: '游戏类型不存在', sender: room });
      return;
    }

    const GameClass = meta.default as unknown as new (room: Room) => GameRoom;
    const instance = new GameClass(room);
    const saved = restoreGameState(room.id);
    if (saved) Object.assign(instance, saved);
    this.instances.set(room.id, instance);
    instance.init();

    room.on('close', () => {
      this.instances.delete(room.id);
    });
  }

  /** 房间设置只接受游戏声明的字段，避免前端塞任意数据 */
  private sanitizeAttrs(type: string, attrs: Record<string, any> = {}) {
    const meta = Games[type];
    const result: Record<string, any> = { type };
    if (attrs.passwd) result.passwd = crypto.createHash('md5').update(String(attrs.passwd)).digest('hex');

    for (const field of meta?.settings ?? []) {
      const value = attrs[field.key];
      if (field.type === 'switch') result[field.key] = value === undefined ? field.default : Boolean(value);
      else if (field.type === 'number') {
        const number = Number(value);
        result[field.key] =
          Number.isFinite(number) && number >= (field.min ?? -Infinity) && number <= (field.max ?? Infinity)
            ? number
            : field.default;
      } else {
        const allowed = (field.options ?? []).map((option) => option.value);
        result[field.key] = allowed.includes(value) ? value : field.default;
      }
    }
    return result;
  }

  async createRoom(sender: IPlayer, options: IRoomOptions) {
    const type = String(options.attrs?.type || '');
    const meta = Games[type];
    if (!meta) throw new Error('请选择有效的游戏类型');
    if (!options.name || !String(options.name).trim()) throw new Error('请填写房间名称');

    const size = Math.min(meta.maxSize, Math.max(meta.minSize, Number(options.size) || meta.minSize));
    return super.createRoom(sender, {
      ...options,
      name: String(options.name).trim().slice(0, 30),
      size,
      minSize: meta.minSize,
      requireAllReadyToStart: meta.requireAllReadyToStart ?? true,
      attrs: this.sanitizeAttrs(type, options.attrs),
    });
  }

  async startRoom(sender: IPlayer, room: IRoomOptions) {
    const instance = this.searchRoom(room);
    const meta = instance?.attrs?.type ? Games[instance.attrs.type] : undefined;
    if (instance && meta && instance.validPlayers.length < meta.minSize) {
      throw new Error(`至少需要 ${meta.minSize} 名玩家`);
    }
    if (instance) {
      const GameClass = meta!.default as unknown as new (room: Room) => GameRoom;
      new GameClass(instance as Room).onPreStart?.(sender, instance as Room);
    }
    return super.startRoom(sender, room as any);
  }

  async isAdmin(player: IPlayer) {
    if (!player?.id) return false;
    return findUserById(player.id)?.role === 'admin';
  }

  async isBanned(player: IPlayer) {
    if (!player?.id) return false;
    return findUserById(player.id)?.status === 'banned';
  }

  /** 封禁、登出、删号时立刻踢掉用户的所有连接与座位 */
  kickUser(userId: string) {
    for (const room of this.rooms) {
      const player = room.players.find((p) => p.id === userId);
      if (player) {
        room.kickPlayer(player);
        this.emit('room-player', room);
      }
    }
    this.socket.closeUser(userId);
  }

  roomSummary() {
    return this.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      size: room.size,
      type: room.attrs?.type,
      status: room.status,
      watchers: room.watchers.length,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        status: p.status,
        isReady: p.isReady,
        isCreator: p.isCreator,
      })),
      attrs: room.attrs,
    }));
  }
}

export function sessionToPlayer(user: SessionUser) {
  return {
    id: user.id,
    name: user.nickname,
    isAdmin: user.role === 'admin',
    isVisitor: Boolean(user.isVisitor),
    attributes: { username: user.username, nickname: user.nickname, points: user.points },
  };
}
