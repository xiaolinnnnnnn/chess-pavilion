import axios from 'axios';
import { Player, type Room, type RoomPlayer } from '@yige/engine/client';
import type { GameConfig } from '@/types';

export interface IRoomMessage {
  content: string;
  sender?: RoomPlayer;
  createdAt: number;
}

export interface GameStats {
  game: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface IUser {
  id: string;
  username: string;
  nickname: string;
  role: 'user' | 'admin';
  points: number;
  avatar?: string;
  isVisitor?: boolean;
}

export class User implements IUser {
  id: string;
  username: string;
  nickname: string;
  role: 'user' | 'admin';
  points: number;
  avatar: string;
  isVisitor: boolean;

  constructor(user: Partial<IUser>) {
    this.id = user.id ?? '';
    this.username = user.username ?? '';
    this.nickname = user.nickname ?? '';
    this.role = user.role ?? 'user';
    this.points = user.points ?? 0;
    this.avatar = user.avatar ?? '';
    this.isVisitor = user.isVisitor ?? false;
  }

  get isAdmin() {
    return this.role === 'admin';
  }

  get player(): Player {
    return new Player({
      id: this.id,
      name: this.nickname,
      isAdmin: this.isAdmin,
      isVisitor: this.isVisitor,
      attributes: { username: this.username, nickname: this.nickname, avatar: this.avatar, points: this.points },
    });
  }
}

export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 });

http.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body?.code !== 0) return Promise.reject(new Error(body?.message || '请求失败'));
    return body.data;
  },
  (error) => {
    const message = error?.response?.data?.message || error?.message || '网络异常';
    return Promise.reject(new Error(message));
  },
);

const toUser = (data: any) => new User(data?.user ?? data);

export const api = {
  getConfig(): Promise<{ games: Record<string, GameConfig>; user: IUser | null }> {
    return http.get('/config');
  },
  me(): Promise<User | null> {
    return http.get('/auth/me').then(toUser).catch(() => null);
  },
  register(username: string, password: string): Promise<User> {
    return http.post('/auth/register', { username, password }).then(toUser);
  },
  login(username: string, password: string): Promise<User> {
    return http.post('/auth/login', { username, password }).then(toUser);
  },
  loginVisitor(name?: string): Promise<User> {
    return http.post('/auth/visitor', { name }).then(toUser);
  },
  logout(): Promise<void> {
    return http.post('/auth/logout');
  },
  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return http.post('/auth/password', { oldPassword, newPassword });
  },
  updateUsername(username: string): Promise<User> {
    return http.post('/auth/username', { username }).then(toUser);
  },
  myGames(params: { game?: string; from?: number; to?: number; mode?: string } = {}): Promise<any[]> {
    return http.get('/me/games', { params });
  },
  recordAiGame(payload: { game: string; result: 'win' | 'loss' | 'draw'; moves: number }): Promise<{ id: string }> {
    return http.post('/me/games', payload);
  },
  messages(): Promise<{ content: string; sender?: Player; createdAt: number }[]> {
    return http.get('/messages');
  },
  record(id: string): Promise<any> {
    return http.get(`/records/${id}`);
  },
  user(username: string): Promise<any> {
    return http.get(`/users/${username}`);
  },
  leaderboard(game?: string): Promise<any[]> {
    return http.get(`/leaderboard${game ? '/' + game : ''}`);
  },
  adminUsers(params: { keyword?: string; page?: number; pageSize?: number }): Promise<{ rows: any[]; total: number }> {
    return http.get('/admin/users', { params });
  },
  adminPatchUser(id: string, patch: Record<string, any>): Promise<any> {
    return http.patch(`/admin/users/${id}`, patch);
  },
  getRooms(): Promise<Room[]> {
    return http.get('/rooms');
  },
  getPlayers(): Promise<Player[]> {
    return http.get('/players');
  },
};
