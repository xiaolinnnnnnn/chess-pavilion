import { IPlayer, IRoomPlayer, PlayerRole, PlayerStatus, Room, RoomPlayer, RoomStatus } from '@yige/engine';
import * as glob from 'glob';
import * as path from 'path';
import { omit } from '../utils';
import { Router } from 'express';
import { recordMatch } from '../stats';
import { ChatGuard } from '../chat-guard';

const files = glob
  .sync(path.join(__dirname, '*.*').replace(/\\/g, '/'))
  .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
  .concat(
    glob
      .sync(path.join(__dirname, '**', 'index.*').replace(/\\/g, '/'))
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js')),
  );

export interface IGame extends IGameInfo {
  default: (room: Room, methods?: IGameMethod) => any;
}

export interface GameSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface GameSettingField {
  key: string;
  label: string;
  type: 'select' | 'switch' | 'number';
  options?: GameSettingOption[];
  default: string | number | boolean;
  min?: number;
  max?: number;
  help?: string;
}

export interface IGameInfo {
  name: string;
  minSize: number;
  maxSize: number;
  description: string;
  /** 棋盘/牌桌的类型，前端据此选择渲染器 */
  table?: 'grid' | 'board' | 'cards' | 'custom';
  /** 人机对战入口；none 表示该游戏暂不提供 */
  ai?: 'client' | 'none';
  /** 建房设置，由前端通用表单渲染，避免每个游戏写一个 Attrs 组件 */
  settings?: GameSettingField[];
  requireAllReadyToStart?: boolean;
}

export interface IGameMethod {
  save: (data: Record<string, any>) => Promise<void>;
  restore: () => Promise<Record<string, any> | null>;
}

export type GameMap = { [key: string]: IGame };

const games: GameMap = {};

async function loadGames() {
  await Promise.all(
    files.map(async (file) => {
      let name = path.basename(file.replace(/\.(ts|js)$/, ''));
      if (name === 'index') {
        name = path.basename(path.dirname(file));
        if (name === 'games') return;
      }
      const game = (await import('./' + name)) as IGame;
      if (!game) return;
      games[name] = game;
    }),
  );
  return games;
}

export const gameLoaded = loadGames();
export default games;

export interface IRoomMessage {
  content: string;
  sender?: IRoomPlayer;
  createdAt: number;
}

export interface IRoomAchievement {
  win: number;
  lost: number;
  draw: number;
  score?: number;
}

export interface IGameCommand {
  type: string;
  data?: any;
  sender: IRoomPlayer;
}

/** 进程内的对局状态快照：用于同一进程内断线重连/页面刷新恢复 */
const gameStates = new Map<string, Record<string, any>>();

export class GameRoom {
  messageHistory: IRoomMessage[] = [];
  achievements: Record<string, IRoomAchievement> = {};
  publicCommands: string[] = ['say', 'status'];
  saveIgnoreProps: string[] = [];
  tickTimeout: Record<string, NodeJS.Timeout> = {};
  tickEndTime: Record<string, number> = {};
  room: Room;
  beginTime = 0;
  /** 本局是否已经写库，保证幂等 */
  recorded = false;

  protected chatGuard = new ChatGuard();
  private readonly ignoredProps = ['room', 'tickTimeout', 'chatGuard'];

  constructor(room: Room) {
    this.room = room;
  }

  get Routers(): Router | null {
    return null;
  }

  init() {
    return this.room
      .on('player-command', (message: any) => {
        const players = this.publicCommands.includes(message.type) ? this.room.players : this.room.validPlayers;
        const sender = players.find((p) => p.id === message.sender?.id);
        if (!sender) return;
        if (sender.role !== PlayerRole.player && message.type === 'say' && this.room.status === RoomStatus.playing) {
          this.onWatcherSay({ ...message, sender });
          return;
        }
        this.onCommand({ ...message, sender });
      })
      .on('start', () => {
        this.onStart();
        this.beginTime = Date.now();
        this.recorded = false;
        this.save();
      })
      .on('end', () => {
        this.room.emit('command', { type: 'end' });
        this.stopTimer();
        this.save();
      })
      .on('message', (message: { content: string; sender?: IRoomPlayer }) => {
        this.messageHistory.unshift({ ...message, createdAt: Date.now() });
        if (this.messageHistory.length > 100) this.messageHistory.length = 100;
        this.save();
      })
      .on('player-ready', () => this.save())
      .on('player-unready', () => this.save())
      .on('join', () => this.save())
      .on('leave', () => this.save())
      .on('close', () => {
        this.stopTimer();
        gameStates.delete(this.room.id);
      });
  }

  isPlayerOnline(player: IPlayer) {
    return !this.room.players.find((p) => p.id === player.id && p.status === PlayerStatus.offline);
  }

  getPlayerById(playerId: string) {
    return this.room.players.find((p) => p.id === playerId) ?? null;
  }

  save() {
    gameStates.set(this.room.id, omit(this, [...this.ignoredProps, ...this.saveIgnoreProps]));
  }

  getStatus(sender: IRoomPlayer) {
    return {
      messageHistory: this.messageHistory,
      achievements: this.achievements,
      tickEndTime: this.tickEndTime,
    };
  }

  getData(): any {
    return {};
  }

  setPlayerAttributes(playerId: string, attributes: Record<string, any>) {
    const player = this.room.players.find((p) => p.id === playerId);
    if (!player) return;
    player.attributes = { ...player.attributes, ...attributes };
    this.save();
  }

  onPreStart(_sender: IPlayer, _room: Room) {}

  onStart() {
    throw new Error('Method not implemented.');
  }

  onCommand(message: IGameCommand) {
    switch (message.type) {
      case 'say':
        this.onSay(message);
        break;
      case 'status': {
        const player = this.room.players.find((p) => p.id === message.data?.id);
        if (!player) break;
        player.emit('command', { type: 'status', data: this.getStatus(player) });
        break;
      }
      case 'achievements':
        (message.sender as RoomPlayer).emit('command', { type: 'achievements', data: this.achievements });
        break;
    }
  }

  onWatcherSay(message: IGameCommand) {
    const sender = message.sender as RoomPlayer;
    const check = this.chatGuard.check(sender, message.data);
    if (!check.ok) {
      this.sayTo(check.message, sender);
      return;
    }
    this.room.watchers.forEach((watcher) => watcher.emit('message', { content: check.content, sender }));
  }

  onSay(message: IGameCommand) {
    const sender = message.sender as RoomPlayer;
    const check = this.chatGuard.check(sender, message.data);
    if (!check.ok) {
      this.sayTo(check.message, sender);
      return;
    }
    this.say(check.content, sender);
  }

  say(message: string, sender?: IRoomPlayer) {
    this.room.emit('message', { content: message, sender });
  }

  sayTo(message: string, receiver: RoomPlayer) {
    receiver.emit('message', { content: message });
  }

  command(type: string, data?: any, sender?: { id: string }) {
    this.room.emit('command', { type, data, sender });
  }

  commandTo(type: string, data: any, receiver: RoomPlayer) {
    receiver.emit('command', { type, data });
  }

  virtualCommand(type: string, data: any, sender: RoomPlayer) {
    this.room.emit('player-command', { type, data, sender });
  }

  /**
   * 结算并写入对局记录。winners 为空视为平局。
   * 只有正式账号会写入战绩与积分，游客对局不结算。
   */
  saveAchievements(winners?: RoomPlayer[] | null, saveRecord = true) {
    const winnerNames = (winners ?? []).map((p) => p.attributes?.username).filter(Boolean) as string[];
    const isDraw = winnerNames.length === 0;

    this.room.validPlayers.forEach((player) => {
      const record = (this.achievements[player.name] ??= { win: 0, lost: 0, draw: 0 });
      if (isDraw) record.draw += 1;
      else if (winnerNames.includes(player.attributes?.username)) record.win += 1;
      else record.lost += 1;
    });

    this.room.emit('command', { type: 'achievements', data: this.achievements });
    this.save();

    if (!saveRecord || this.recorded) return;
    this.recorded = true;

    const players = this.room.validPlayers
      .filter((p) => p.attributes?.username && !p.isVisitor)
      .map((p) => ({
        id: p.id,
        username: String(p.attributes!.username),
        name: p.name,
        color: Number(p.attributes?.color) || undefined,
      }));
    if (!players.length) return;

    try {
      recordMatch({
        game: this.room.attrs?.type ?? 'unknown',
        room: this.room.name,
        players,
        winners: winnerNames,
        reason: isDraw ? 'draw' : 'settled',
        moves: this.getData(),
        startedAt: this.beginTime,
      });
    } catch (error) {
      console.error('[stats] 写入对局记录失败', error);
    }
  }

  saveScore(_score: number) {
    this.saveAchievements(null);
  }

  saveRecord(_winners?: RoomPlayer[] | null, _score?: number) {
    // 对局记录统一由 saveAchievements 写入，保留方法避免各游戏改动
  }

  async getMaxScore(player: RoomPlayer): Promise<number> {
    return Number(player.attributes?.score) || 0;
  }

  startTimer(callback: () => void, ms: number, name = '') {
    this.stopTimer(name);
    this.tickEndTime[name] = Date.now() + ms;
    this.tickTimeout[name] = setTimeout(() => {
      delete this.tickTimeout[name];
      delete this.tickEndTime[name];
      callback();
    }, ms);
    this.room.emit('command', { type: 'countdown', data: { seconds: ms / 1000, name, end: this.tickEndTime[name] } });
  }

  stopTimer(name = '') {
    if (name && this.tickTimeout[name]) {
      clearTimeout(this.tickTimeout[name]);
      delete this.tickTimeout[name];
      delete this.tickEndTime[name];
    } else if (!name) {
      Object.keys(this.tickTimeout).forEach((key) => {
        clearTimeout(this.tickTimeout[key]);
        delete this.tickTimeout[key];
        delete this.tickEndTime[key];
      });
    }
  }

  restoreTimer(timer: Record<string, () => void>) {
    Object.keys(this.tickEndTime).forEach((name) => {
      const endTime = this.tickEndTime[name];
      const now = Date.now();
      if (endTime > now) {
        const handler = timer[name];
        if (handler) this.startTimer(handler, endTime - now, name);
        else this.stopTimer(name);
      } else {
        delete this.tickEndTime[name];
        delete this.tickTimeout[name];
        timer[name]?.();
      }
    });
  }
}

export function restoreGameState(roomId: string) {
  return gameStates.get(roomId) ?? null;
}
