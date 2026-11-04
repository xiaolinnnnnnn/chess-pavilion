import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, type UserRow } from '../db';
import { config } from '../config';
import type { SessionUser } from './types';

export const RESERVED_NAMES = new Set(['admin', 'administrator', 'system', 'root', 'official', '管理员', '官方', '系统']);
const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/;

export function validateUsername(username: unknown): string {
  const value = typeof username === 'string' ? username.trim() : '';
  if (!USERNAME_RE.test(value)) throw new Error('用户名需为 3-20 位字母、数字、下划线或中文');
  if (RESERVED_NAMES.has(value.toLowerCase())) throw new Error('该用户名不可用');
  return value;
}

export function validatePassword(password: unknown): string {
  const value = typeof password === 'string' ? password : '';
  if (value.length < 8 || value.length > 16) throw new Error('密码长度需为 8-16 位');
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) throw new Error('密码需同时包含字母和数字');
  return value;
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    role: row.role,
    points: row.points,
    avatar: '',
  };
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function sessionUserFromRow(row: UserRow): SessionUser {
  return toSessionUser(row);
}

export function register(username: string, password: string): SessionUser {
  const name = validateUsername(username);
  const pwd = validatePassword(password);
  if (findUserByUsername(name)) throw new Error('用户名已被占用');

  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, username, nickname, password_hash, role, points, created_at)
     VALUES (?, ?, ?, ?, 'user', ?, ?)`,
  ).run(id, name, name, bcrypt.hashSync(pwd, 10), config.points.initial, Date.now());

  return toSessionUser(findUserById(id)!);
}

export function login(username: string, password: string): SessionUser {
  const row = findUserByUsername(typeof username === 'string' ? username.trim() : '');
  const invalid = new Error('用户名或密码错误');
  if (!row) throw invalid;
  if (!bcrypt.compareSync(typeof password === 'string' ? password : '', row.password_hash)) throw invalid;
  if (row.status === 'banned') throw new Error('账号已被封禁');

  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), row.id);
  return toSessionUser(row);
}

export function createVisitor(name?: string): SessionUser {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const nickname = (name && String(name).trim().slice(0, 12)) || `游客${suffix}`;
  return {
    id: `guest_${randomUUID()}`,
    username: `guest_${suffix}`,
    nickname,
    role: 'user',
    points: 0,
    isVisitor: true,
  };
}

export function toPlayer(user: SessionUser) {
  return {
    id: user.id,
    name: user.nickname,
    isAdmin: user.role === 'admin',
    isVisitor: Boolean(user.isVisitor),
    attributes: {
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar ?? '',
      points: user.points,
    },
  };
}

export function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const row = findUserById(userId);
  if (!row) throw new Error('用户不存在');
  if (!bcrypt.compareSync(oldPassword, row.password_hash)) throw new Error('原密码不正确');
  const pwd = validatePassword(newPassword);
  if (bcrypt.compareSync(pwd, row.password_hash)) throw new Error('新密码不能与原密码相同');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pwd, 10), userId);
}

/** 修改用户名（同时同步昵称），需保证未被占用且符合规则 */
export function changeUsername(userId: string, username: string): SessionUser {
  const name = validateUsername(username);
  const existing = findUserByUsername(name);
  if (existing && existing.id !== userId) throw new Error('用户名已被占用');
  db.prepare('UPDATE users SET username = ?, nickname = ? WHERE id = ?').run(name, name, userId);
  return toSessionUser(findUserById(userId)!);
}
