import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { config, ensureDataDir } from './config';

ensureDataDir();
if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  nickname TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  points INTEGER NOT NULL DEFAULT ${config.points.initial},
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  room TEXT NOT NULL,
  players TEXT NOT NULL,
  winners TEXT NOT NULL,
  result TEXT,
  moves TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL,
  user_id TEXT,
  username TEXT NOT NULL,
  game TEXT NOT NULL,
  result TEXT NOT NULL,
  points_delta INTEGER NOT NULL DEFAULT 0,
  color INTEGER,
  PRIMARY KEY (match_id, username),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(username, game);
CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game, ended_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
`);

// 迁移：为历史对局表补充“模式”列（online 联网 / ai 人机），幂等
try {
  db.exec(`ALTER TABLE matches ADD COLUMN mode TEXT NOT NULL DEFAULT 'online'`);
} catch {
  /* 列已存在则忽略 */
}

export interface UserRow {
  id: string;
  username: string;
  nickname: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  points: number;
  created_at: number;
  last_login_at: number | null;
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function seedAdmin() {
  if (!config.adminUsername || !config.adminPassword) return;
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(config.adminUsername);
  if (existing) return;
  db.prepare(
    `INSERT INTO users (id, username, nickname, password_hash, role, points, created_at)
     VALUES (?, ?, ?, ?, 'admin', ?, ?)`,
  ).run(
    randomUUID(),
    config.adminUsername,
    config.adminUsername,
    bcrypt.hashSync(config.adminPassword, 10),
    config.points.initial,
    Date.now(),
  );
  console.info('[auth] 已创建初始管理员 ' + config.adminUsername);
}

export function audit(actor: string | null, action: string, target?: string, detail?: unknown) {
  db.prepare('INSERT INTO audit_logs (actor, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    actor,
    action,
    target ?? null,
    detail === undefined ? null : JSON.stringify(detail),
    Date.now(),
  );
}
