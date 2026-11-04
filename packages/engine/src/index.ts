import { EventEmitter } from "events";
import { GameHallEvents } from "@lib/events";
import { IMessage, RecvMessageTypes, MessageTypes, IMessagePackage } from "@lib/models/message";
import { IRoom, IRoomPlayer, Room, IRoomOptions, IRoomPlayerOptions, RoomStatus, PlayerRole } from "@lib/models/room";
import { IPlayer, Player, IPlayerOptions, PlayerStatus } from "@lib/models/player";

export interface IGameHallOptions {
  socket: IMessage;
}

export class GameHall extends EventEmitter {
  rooms: Room[] = []; // room list
  players: Player[] = []; // player list
  messageInstance?: IMessage;

  constructor({ socket }: IGameHallOptions) {
    super();
    this.messageInstance = socket;
  }

  /**
   * 导出 JSON 数据
   * @returns 房间与玩家数据
   */
  toJSON() {
    return {
      rooms: this.rooms,
      players: this.players,
    };
  }

  /**
   * 从数据加载
   * @param data 房间与玩家数据
   * @returns this
   */
  loadFrom(data: { rooms?: Room[]; players?: Player[] }) {
    this.rooms = data.rooms?.map((r) => new Room(r, r.players)) ?? [];
    this.players = data.players?.map((p) => new Player(p, p.status)) ?? [];
    this.rooms.forEach((room) => {
      room.setSender((type, message, sender) => {
        this.send({ type: `room.${type}` as MessageTypes, data: message, sender: room });
      })
    })
    setTimeout(() => {
      this.rooms.forEach((room) => {
        room.players.forEach((player) => {
          if (!this.players.some((p) => p.id === player.id)) {
            this.offlinePlayer(player);
          }
        })
      })
    }, 60 * 1000);
    return this;
  }

  on<K extends keyof GameHallEvents>(event: K, listener: GameHallEvents[K]): this {
    super.on(event, listener);
    return this
  }

  emit<K extends keyof GameHallEvents>(event: K, ...args: Parameters<GameHallEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * 判断玩家是否为管理员
   * @param player 玩家信息
   * @returns 是否为管理员
   */
  async isAdmin(_player: IPlayer) {
    return false;
  }

  /**
   * 判断玩家是否被封禁
   * @param _player 玩家信息
   * @returns 是否被封禁
   */
  async isBanned(_player: IPlayer) {
    return false;
  }

  run() {
    this.messageInstance?.on("message", async (message: any, cb?: (err: Error | null, data?: any) => any) => {
      message.sender = message.sender ? this.searchPlayer(message.sender) || message.sender : null;
      try {
        switch (message.type) {
          case RecvMessageTypes.RoomList:
            return cb?.(null, this.rooms);
          case RecvMessageTypes.PlayerList:
            return cb?.(null, this.players);
          case RecvMessageTypes.RoomCreate:
            return cb?.(null, await this.createRoom(message.sender, message.data));
          case RecvMessageTypes.PlayerJoin:
            return await this.joinPlayer(message.sender, message.data);
          case RecvMessageTypes.PlayerLeave:
            return await this.leavePlayer(message.sender, message.data);
          case RecvMessageTypes.PlayerStandUp:
            return await this.leaveSeat(message.sender, message.data);
          case RecvMessageTypes.RoomGet:
            return cb?.(null, this.searchRoom(message.data));
          case RecvMessageTypes.RoomStart:
            return await this.startRoom(message.sender, message.data);
          case RecvMessageTypes.RoomKick:
            return await this.kickPlayer(message.sender, message.data);
          case RecvMessageTypes.RoomTransfer:
            return await this.transferOwner(message.sender, message.data);
          case RecvMessageTypes.RoomClose:
            return await this.closeRoom(message.sender, message.data);
          case RecvMessageTypes.PlayerLogin:
            return await this.loginPlayer(message.data);
          case RecvMessageTypes.PlayerLogout:
            return await this.removePlayer(message.data);
          case MessageTypes.PlayerOffline:
            return await this.offlinePlayer(message.data);
          case RecvMessageTypes.PlayerReady:
            return await this.readyPlayer(message.sender, message.data);
          case RecvMessageTypes.PlayerUnready:
            return await this.unReadyPlayer(message.sender, message.data);
          case RecvMessageTypes.RoomPlayerCommand:
            return this.searchRoom(message.data)?.emit("player-command", { ...message.data , sender: message.sender });
          case RecvMessageTypes.GlobalCommand:
            return this.emit("command", { ...message.data , sender: message.sender });
          default:
            throw new Error('unknown message type.');
        }
      } catch (error) {
        cb?.(error as Error);
        if (message.sender) this.send({
          type: MessageTypes.PlayerError,
          data: {
            name: (error as Error).name, 
            message: (error as Error).message,
            stack: (error as Error).stack,
          },
          sender: message.sender,
        });
      }
    });

    this.on('player', (player, online) => {
      this.send({ type: online ? MessageTypes.PlayerLogin : MessageTypes.PlayerLogout, data: player });
    });

    this.on('players', (players) => {
      this.send({ type: MessageTypes.PlayerList, data: players });
    });

    this.on('room', (room) => {
      this.send({ type: MessageTypes.RoomCreate, data: room });
    });

    this.on('room-player', (room) => {
      this.send({ type: MessageTypes.RoomUpdate, data: room });
    });

    this.on('rooms', (rooms) => {
      this.send({ type: MessageTypes.RoomList, data: rooms });
    });

    this.on('message', (data, sender) => {
      this.send({ type: MessageTypes.GlobalMessage, data: { content: data, sender } });
    });

    return this;
  }

  searchPlayer(player: string): Player | undefined;
  searchPlayer(player: IPlayerOptions | IRoomPlayerOptions): Player | undefined;

  searchPlayer(player: IPlayerOptions | IRoomPlayerOptions | string) {
    const playerId = typeof player === "string" ? player : player?.id;
    return this.players.find((target) => target.id === playerId);
  }

  searchRoom(room: string): Room | undefined;
  searchRoom(room: Partial<IRoomOptions>): Room | undefined;

  searchRoom(room: Partial<IRoomOptions> | string) {
    const roomId = typeof room === "string" ? room : room?.id;
    return this.rooms.find((target) => target.id === roomId);
  }

  async createRoom(sender: IPlayer, options: IRoomOptions) {
    if (!sender) {
      throw new Error('未获取到登录信息，请先登录。');
    }

    if (!options.name) {
      throw new Error('请填写房间名称。');
    }
    const roomInstance = this.searchRoom(options);
    if (roomInstance) {
      throw new Error('同名房间已存在，请换个名称。');
    }

    if (this.rooms.some(r => r.players.some(p => p.id === sender?.id))) {
      throw new Error('你已在其他房间中，请先退出当前房间。');
    }

    const room = new Room(options);
    room.setSender((type, message, sender) => {
      this.send({ type: `room.${type}` as MessageTypes, data: message, sender: room });
    });
    
    this.rooms.push(room);
    this.emit("room", room);
    await this.joinPlayer(sender, { roomId: room.id, ...sender }, true);
    return room;
  }

  async startRoom(sender: IPlayer, room: IRoom) {
    const roomInstance = this.searchRoom(room);
    if (!roomInstance) {
      throw new Error('房间不存在或已被关闭。');
    }
    roomInstance.start(sender);

    return this.emit("room-player", roomInstance);
  }

  async closeRoom(sender: IPlayer | null, room: IRoom) {
    const roomIndex = this.rooms.findIndex((r) => r.id === room.id);
    const roomInstance = this.rooms[roomIndex];
    if (!roomInstance) {
      throw new Error('房间不存在或已被关闭。');
    }

    if (sender?.id && !sender.isAdmin) {
      const senderInRoom = roomInstance.searchPlayer(sender);
      if (!senderInRoom || !senderInRoom.isCreator) {
        throw new Error('你没有权限执行此操作。');
      }
    }

    room = this.rooms.splice(roomIndex, 1)[0];
    room.players.forEach((player) => {
      player.status = PlayerStatus.online;
      player.emit("status", PlayerStatus.online);
    });

    this.emit("rooms", this.rooms);
    roomInstance.emit('close');
    return room;
  }

  async kickPlayer(sender: IPlayer, data: { roomId: string, playerId: string }) {
    const room = this.searchRoom(data.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    if (!sender.isAdmin) {
      const senderInRoom = room.searchPlayer(sender);
      if (!senderInRoom || !senderInRoom.isCreator) {
        throw new Error('你没有权限执行此操作。');
      }
    }

    const targetPlayer = room.players.find(p => p.id === data.playerId);
    if (!targetPlayer) {
      throw new Error('该玩家不在房间中。');
    }

    const roomPlayer = room.kickPlayer(targetPlayer);
    if (roomPlayer) this.emit("room-player", room);
    return roomPlayer;
  }

  async transferOwner(sender: IPlayer, data: { roomId: string, playerId: string }) {
    const room = this.searchRoom(data.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    const creator = room.players.find(p => p.isCreator);
    if (!sender.isAdmin) {
      const senderInRoom = room.searchPlayer(sender);
      if (!senderInRoom || !senderInRoom.isCreator) {
        throw new Error('你没有权限执行此操作。');
      }
    } else {

    }

    const targetPlayer = room.players.find(p => p.id === data.playerId);
    if (!targetPlayer) {
      throw new Error('该玩家不在房间中。');
    }

    if (targetPlayer.id === sender.id) {
      return;
    }

    if (creator) creator.isCreator = false;
    targetPlayer.isCreator = true;

    this.emit("room-player", room);
    return room;
  }

  async loginPlayer (player: IPlayerOptions, cb?: (data: { player: Player }) => void) {
    let playerInstance = this.searchPlayer(player);
    if (!playerInstance?.sender) {
      if (!playerInstance) {
        playerInstance = new Player(player);
        this.players.push(playerInstance);
      }
      playerInstance.isAdmin = await this.isAdmin(playerInstance);
      playerInstance.setSender((type, message) => {
        this.send({ type: `player.${type}` as MessageTypes, data: message, sender: playerInstance });
      });
      this.emit("player", playerInstance, true);

      const room = this.rooms.find(r => r.players.some(p => p.id === playerInstance!.id));
      if (room) {
        const playerIndex = room.players.findIndex(p => p.id === playerInstance!.id);
        if (playerIndex >= 0) {
          const status = room?.status == RoomStatus.playing ? PlayerStatus.playing : PlayerStatus.online;
          playerInstance.status = status;
          playerInstance.attributes = Object.assign({}, room.players[playerIndex].attributes, playerInstance.attributes);
          Object.assign(room.players[playerIndex], playerInstance);
          room.emit('update', room);
        }
      }
    }

    playerInstance.emit("status", playerInstance.status);

    cb?.({ player: playerInstance });
    return playerInstance;
  }

  async joinPlayer(sender: IPlayer, player: IRoomPlayerOptions, isCreator: boolean = false, role: PlayerRole = PlayerRole.player) {
    let playerInstance = this.searchPlayer(sender);
    if (!playerInstance) {
      playerInstance = await this.loginPlayer(sender);
    }

    // 客户端可显式声明观战意图（params.role = 'watcher'），此时不再占用座位
    if ((player as any).params?.role === PlayerRole.watcher) {
      role = PlayerRole.watcher;
    }

    if (playerInstance.isVisitor) {
      role = PlayerRole.watcher;
    }

    if (!player.roomId) {
      throw new Error('缺少房间信息。');
    }

    const room = this.rooms.find((room) => room.id === player.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    // 落座请求才做拦截：观战不受人数与对局状态限制
    if (role === PlayerRole.player && !isCreator) {
      const seated = room.searchPlayer(playerInstance.id);
      const alreadySeated = seated?.role === PlayerRole.player;
      if (!alreadySeated && room.isPlaying) {
        throw new Error('房间正在对局中，请选择观战或等待下一局。');
      }
      if (!alreadySeated && room.isFull) {
        throw new Error('房间座位已满，请选择观战或等待下一局。');
      }
    }

    if (this.rooms.some(r => r.id != room.id && r.players.some(p => p.id === playerInstance!.id && p.role === PlayerRole.player))) {
      throw new Error('你正在其他房间对局中，请先结束。');
    }

    if (!isCreator && !room.players.some(p => p.isCreator)) {
      isCreator = true;
    }

    const roomPlayer = room.addPlayer(playerInstance, isCreator, role);
    if (roomPlayer) {
      this.emit("room-player", room);
    }

    return roomPlayer;
  }

  async leavePlayer(sender: IPlayer, player: IRoomPlayerOptions) {
    if (!player.roomId) {
      throw new Error('缺少房间信息。');
    }

    const room = this.rooms.find((room) => room.id === player.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    const playerInstance = room.searchPlayer(sender);
    if (!playerInstance) {
      throw new Error('你不在该房间中。');
    }

    const roomPlayer = room.kickPlayer(playerInstance);

    if (roomPlayer) this.emit("room-player", room);

    return roomPlayer;
  }
  
  async leaveSeat(sender: IPlayer, player: IRoomPlayerOptions) {
    if (!player.roomId) {
      throw new Error('缺少房间信息。');
    }

    const room = this.rooms.find((room) => room.id === player.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    const playerInstance = room.searchPlayer(sender);
    if (!playerInstance) {
      throw new Error('你不在该房间中。');
    }

    const roomPlayer = room.leaveSeat(playerInstance);
    if (roomPlayer) this.emit("room-player", room);

    return roomPlayer;
  }

  async readyPlayer(sender: IPlayer, player: IRoomPlayer) {
    const playerInstance = this.searchPlayer(sender);
    if (!playerInstance) {
      throw new Error('未找到该玩家。');
    }

    if (!player.roomId) {
      throw new Error('缺少房间信息。');
    }

    const room = this.rooms.find((room) => room.id === player.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    const roomPlayer = room.searchPlayer(playerInstance);
    
    if (!roomPlayer) {
      throw new Error('你不在该房间中。');
    }

    roomPlayer.isReady = true;

    if (room.isReady) {
      room.emit("all-ready", room.players);
    }

    playerInstance.status = PlayerStatus.ready;

    room.emit("player-ready", { ...player, ...roomPlayer });
    room.emit('update', room);

    return this;
  }
    
  async unReadyPlayer(sender: IPlayer, player: IRoomPlayer) {
    const playerInstance = this.searchPlayer(sender);
    if (!playerInstance) {
      throw new Error('未找到该玩家。');
    }

    if (!player.roomId) {
      throw new Error('缺少房间信息。');
    }

    const room = this.rooms.find((room) => room.id === player.roomId);
    if (!room) {
      throw new Error('房间不存在或已被关闭。');
    }

    const roomPlayer = room.searchPlayer(playerInstance);
    
    if (!roomPlayer) {
      throw new Error('你不在该房间中。');
    }

    roomPlayer.isReady = false;
    playerInstance.status = PlayerStatus.unready;
    room.emit("player-unready", { ...player, ...roomPlayer });
    room.emit('update', room);

    return this;
  }

  async removePlayer(sender: IPlayer) {
    const playerIndex = this.players.findIndex((p) => p.id === sender?.id);
    const player = this.players[playerIndex];
    if (playerIndex > -1) {
      this.players.splice(playerIndex, 1)[0];
      this.emit("player", player, false);
    }
    return player;
  }

  async offlinePlayer(sender: IPlayer) {
    const room = this.rooms.find((room) => room.players.some(p => p.id === sender?.id));
    if (room) {
      setTimeout(() => {
        const playerInstance = room.players.find(p => p.id === sender.id && p.role === PlayerRole.player);
        if (this.players.some(p => p.id === sender.id) || !playerInstance) 
          return; // player is online
        playerInstance.status = PlayerStatus.offline;
        room.emit("player-offline", playerInstance);
        playerInstance.status = PlayerStatus.offline;
        room.emit('update', room);
      }, 60 * 1000); // 1 minute later
    }
    this.removePlayer(sender);
    return sender;
  }

  async send(message: IMessagePackage) {
    // send a message to the client
    if (message.type.startsWith('player.') && message.sender) {
      const player = message.sender as Player;
      // Send to all sockets of the player
      this.messageInstance?.send({ 
        type: message.type, 
        data: message.data, 
        senderIds: [player.id]
      });
    }
    else if (message.type.startsWith('room.') && message.sender) {
      const room = message.sender as Room;
      this.messageInstance?.send({ 
        type: message.type, 
        data: message.data, 
        senderIds: room.players.map(p => p.id)
      });
    } else {
      this.messageInstance?.send({ 
        type: message.type, 
        data: message.data, 
        senderIds: this.players.map(p => p.id)
      });
    }
  }
}

export * from "@lib/models/message";
export * from "@lib/models/room";
export * from "@lib/models/player";
export * from "@lib/events";