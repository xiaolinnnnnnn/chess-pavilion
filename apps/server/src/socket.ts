import http from 'node:http';
import { EventEmitter } from 'node:events';
import cookie from 'cookie';
import signature from 'cookie-signature';
import { WebSocketServer, WebSocket } from 'ws';
import { MessageTypes, type IMessage, type IMessageData, type IMessageEmitterEvents, type IMessagePackages } from '@yige/engine';
import { config } from './config';
import type { SessionUser } from './auth/types';
import { toPlayer } from './auth/service';

type SessionResolver = (sid: string) => Promise<SessionUser | null>;

interface Connection {
  socket: WebSocket;
  user: SessionUser | null;
  ready: boolean;
  queue: string[];
}

/**
 * WebSocket 层：连接身份完全来自 HTTP 会话，不接受客户端自报的 player 信息。
 */
export class SocketManager extends EventEmitter<any> {
  private connections: Connection[] = [];
  private server: WebSocketServer;

  constructor(server: http.Server, private resolveSession: SessionResolver) {
    super();
    this.server = new WebSocketServer({ server });
    this.server.on('connection', (socket, request) => this.onConnection(socket, request));
  }

  private onConnection(socket: WebSocket, request: http.IncomingMessage) {
    const connection: Connection = { socket, user: null, ready: false, queue: [] };
    this.connections.push(connection);

    socket.on('message', (raw) => {
      if (!connection.ready) {
        connection.queue.push(String(raw));
        return;
      }
      this.onMessage(connection, String(raw));
    });

    socket.on('close', () => {
      this.connections = this.connections.filter((item) => item !== connection);
      const user = connection.user;
      if (user && !this.connections.some((item) => item.user?.id === user.id)) {
        this.emit('message', { type: MessageTypes.PlayerOffline, data: user, sender: user } as unknown as IMessageData, () => undefined);
      }
      this.emit('close');
    });

    const sid = this.readSessionId(request.headers.cookie);
    const done = (user: SessionUser | null) => {
      if (!user) {
        socket.close(4001, 'unauthorized');
        return;
      }
      connection.user = user;
      connection.ready = true;
      const queue = connection.queue.splice(0);
      queue.forEach((raw) => this.onMessage(connection, raw));
      this.emit('ready');
    };

    if (!sid) return done(null);
    this.resolveSession(sid).then(done, () => done(null));
  }

  private onMessage(connection: Connection, raw: string) {
    let packet: any;
    try {
      packet = JSON.parse(raw);
    } catch {
      return;
    }
    const user = connection.user;
    if (!user) return;

    const message: IMessageData = {
      ...packet,
      // 只信任会话，player.login 携带的数据会被覆盖为会话用户
      data: packet.type === MessageTypes.PlayerLogin ? toPlayer(user) : packet.data,
      sender: user as any,
    };

    this.emit(
      'message',
      message,
      (error: Error | null, data?: any) => {
        if (error) {
          if (!message.sender) {
            connection.socket.send(JSON.stringify({ type: MessageTypes.PlayerError, data: { message: error.message } }));
          }
          return;
        }
        connection.socket.send(JSON.stringify({ type: message.type, data }));
      },
    );
  }

  private readSessionId(header?: string): string | null {
    if (!header) return null;
    const cookies = cookie.parse(header);
    const value = cookies[config.sessionCookie];
    // express-session 的 cookie 值形如 s:<sid>.<hmac>，其中 hmac 是对 <sid> 的签名，
    // 需先去掉 s: 前缀再校验（与 express-session 内部实现一致）
    if (!value || !value.startsWith('s:')) return null;
    return signature.unsign(value.slice(2), config.sessionSecret) || null;
  }

  send(message: IMessagePackages) {
    this.connections.forEach(({ socket, user }) => {
      if (!user || socket.readyState !== WebSocket.OPEN) return;
      if (!message.senderIds.includes(user.id)) return;
      socket.send(JSON.stringify({ type: message.type, data: message.data, sender: user }));
    });
  }

  closeUser(userId: string) {
    this.connections
      .filter((item) => item.user?.id === userId)
      .forEach((item) => item.socket.close(4003, 'session-ended'));
  }

  close() {
    this.server.close();
  }
}
