import { randomUUID } from 'node:crypto';
import { db, transaction } from './db';
import { config } from './config';

export interface MatchPlayer {
  id?: string;
  username: string;
  name: string;
  color?: number;
}

export interface MatchInput {
  game: string;
  room: string;
  players: MatchPlayer[];
  /** 获胜方用户名；空数组表示平局 */
  winners: string[];
  reason?: string;
  detail?: string;
  moves?: unknown;
  startedAt: number;
}

export interface MatchRow {
  id: string;
  game: string;
  room: string;
  players: string;
  winners: string;
  result: string | null;
  moves: string | null;
  started_at: number;
  ended_at: number;
}

/**
 * 一局结算：写对局记录、对局参与者明细，并更新积分与战绩。
 * 整个过程在同一个事务内，重复调用不会重复加分（以 match id 唯一约束保证）。
 */
export function recordMatch(input: MatchInput) {
  const id = randomUUID();
  const endedAt = Date.now();
  const deltas: Record<string, number> = {};
  const isDraw = input.winners.length === 0;

  const insertMatch = db.prepare(
    `INSERT INTO matches (id, game, room, players, winners, result, moves, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPlayer = db.prepare(
    `INSERT INTO match_players (match_id, user_id, username, game, result, points_delta, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const updateUser = db.prepare(
    `UPDATE users SET points = MAX(0, points + ?) WHERE username = ?`,
  );
  const findUser = db.prepare(`SELECT id, points FROM users WHERE username = ?`);

  transaction(() => {
    insertMatch.run(
      id,
      input.game,
      input.room,
      JSON.stringify(input.players),
      JSON.stringify(input.winners),
      JSON.stringify({ reason: input.reason, detail: input.detail }),
      input.moves === undefined ? null : JSON.stringify(input.moves),
      input.startedAt,
      endedAt,
    );

    for (const player of input.players) {
      const user = findUser.get(player.username) as { id: string; points: number } | undefined;
      if (!user) continue;
      const result = isDraw ? 'draw' : input.winners.includes(player.username) ? 'win' : 'loss';
      const delta =
        result === 'win' ? config.points.win : result === 'loss' ? config.points.loss : config.points.draw;
      const next = Math.max(0, user.points + delta);
      const applied = next - user.points;
      updateUser.run(applied, player.username);
      insertPlayer.run(id, user.id, player.username, input.game, result, applied, player.color ?? null);
      deltas[player.username] = applied;
    }
  });
  return { id, deltas };
}

export interface AiMatchInput {
  game: string;
  result: 'win' | 'loss' | 'draw';
  moves: number;
}

/** 人机对局结算：仅记录历史，不计入积分（points_delta 恒为 0） */
export function recordAiMatch(username: string, input: AiMatchInput) {
  const id = randomUUID();
  const now = Date.now();
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) throw new Error('用户不存在');
  const players: MatchPlayer[] = [{ username, name: username }, { username: '__ai__', name: 'AI' }];
  const winners = JSON.stringify(input.result === 'win' ? [username] : input.result === 'loss' ? ['__ai__'] : []);
  const count = Math.max(0, Math.trunc(input.moves) || 0);
  const insertMatch = db.prepare(
    `INSERT INTO matches (id, game, room, players, winners, result, moves, started_at, ended_at, mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai')`,
  );
  const insertPlayer = db.prepare(
    `INSERT INTO match_players (match_id, user_id, username, game, result, points_delta, color)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
  );
  transaction(() => {
    insertMatch.run(id, input.game, 'ai', JSON.stringify(players), winners, JSON.stringify({ detail: '人机对局' }), JSON.stringify(new Array(count).fill(0)), now, now);
    insertPlayer.run(id, user.id, username, input.game, input.result);
  });
  return { id };
}

export function getMatch(id: string): MatchRow | undefined {
  return db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as unknown as MatchRow | undefined;
}

export function recentMatches(username: string, limit = 20) {
  return db
    .prepare(
      `SELECT m.*, mp.result AS my_result, mp.points_delta AS my_delta, mp.color AS my_color
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       WHERE mp.username = ?
       ORDER BY m.ended_at DESC
       LIMIT ?`,
    )
    .all(username, limit) as unknown as Array<MatchRow & { my_result: string; my_delta: number; my_color: number | null }>;
}

export interface MyMatchesQuery {
  game?: string;
  from?: number;
  to?: number;
  limit?: number;
}

/** 我的对局：按棋类与时间筛选，并计算手数、对手与胜负 */
export function myMatches(username: string, q: MyMatchesQuery = {}) {
  const where = ['mp.username = ?'];
  const params: Array<string | number> = [username];
  if (q.game) {
    where.push('m.game = ?');
    params.push(q.game);
  }
  if (q.from) {
    where.push('m.ended_at >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('m.ended_at <= ?');
    params.push(q.to);
  }
  const limit = Math.min(200, Math.max(1, q.limit ?? 100));
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT m.id, m.game, m.room, m.players, m.winners, m.result, m.moves, m.ended_at, m.mode,
              mp.result AS my_result, mp.points_delta AS my_delta, mp.color AS my_color
       FROM matches m
       JOIN match_players mp ON mp.match_id = m.id
       WHERE ${where.join(' AND ')}
       ORDER BY m.ended_at DESC
       LIMIT ?`,
    )
    .all(...params) as unknown as Array<{
      id: string;
      game: string;
      room: string;
      players: string;
      winners: string;
      result: string | null;
      moves: string | null;
      ended_at: number;
      mode: string | null;
      my_result: string;
      my_delta: number;
      my_color: number | null;
    }>;

  return rows.map((r) => {
    let players: MatchPlayer[] = [];
    let winners: string[] = [];
    let moveCount = 0;
    let detail = '';
    try {
      players = JSON.parse(r.players) as MatchPlayer[];
      winners = JSON.parse(r.winners) as string[];
      const moves = r.moves ? JSON.parse(r.moves) : [];
      moveCount = Array.isArray(moves) ? moves.length : 0;
      detail = r.result ? (JSON.parse(r.result)?.detail ?? '') : '';
    } catch {
      /* 容忍旧记录解析失败 */
    }
    const opponent = players.find((p) => p.username !== username);
    return {
      id: r.id,
      game: r.game,
      mode: (r.mode === 'ai' ? 'ai' : 'online') as 'online' | 'ai',
      opponent: opponent?.name ?? opponent?.username ?? '—',
      result: r.my_result,
      moves: moveCount,
      delta: r.my_delta,
      endedAt: r.ended_at,
      detail,
      winners,
    };
  });
}

export function userSummary(username: string) {
  const user = db
    .prepare('SELECT id, username, nickname, role, points, created_at, last_login_at FROM users WHERE username = ?')
    .get(username) as unknown as
    | { id: string; username: string; nickname: string; role: string; points: number; created_at: number; last_login_at: number | null }
    | undefined;
  if (!user) return null;

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
              SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws
       FROM match_players WHERE username = ?`,
    )
    .get(username) as unknown as { total: number; wins: number; losses: number; draws: number };

  const byGame = db
    .prepare(
      `SELECT game, COUNT(*) AS total,
              SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
              SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws
       FROM match_players WHERE username = ? GROUP BY game`,
    )
    .all(username);

  return {
    ...user,
    stats: {
      total: totals.total ?? 0,
      wins: totals.wins ?? 0,
      losses: totals.losses ?? 0,
      draws: totals.draws ?? 0,
      winRate: totals.total ? Number(((totals.wins ?? 0) / totals.total).toFixed(3)) : 0,
    },
    byGame,
    recent: recentMatches(username),
  };
}

export function leaderboard(game?: string, limit = 50) {
  const filter = game ? 'AND mp.game = ?' : '';
  const params = game ? [game, limit] : [limit];
  return db
    .prepare(
      `SELECT u.username, u.nickname, u.points,
              COUNT(*) AS total,
              SUM(CASE WHEN mp.result = 'win' THEN 1 ELSE 0 END) AS wins,
              SUM(CASE WHEN mp.result = 'loss' THEN 1 ELSE 0 END) AS losses,
              SUM(CASE WHEN mp.result = 'draw' THEN 1 ELSE 0 END) AS draws
       FROM match_players mp
       JOIN users u ON u.username = mp.username
       WHERE u.status = 'active' ${filter}
       GROUP BY u.username
       ORDER BY u.points DESC, (SUM(CASE WHEN mp.result = 'win' THEN 1.0 ELSE 0 END) / COUNT(*)) DESC
       LIMIT ?`,
    )
    .all(...params) as unknown as Array<{
      username: string;
      nickname: string;
      points: number;
      total: number;
      wins: number;
      losses: number;
      draws: number;
    }>;
}

/** 管理员：分页查看用户 */
export function listUsers(keyword = '', page = 1, pageSize = 20) {
  const like = `%${keyword}%`;
  const rows = db
    .prepare(
      `SELECT id, username, nickname, role, status, points, created_at, last_login_at
       FROM users WHERE username LIKE ? OR nickname LIKE ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(like, like, pageSize, (page - 1) * pageSize);
  const total = db
    .prepare('SELECT COUNT(*) AS count FROM users WHERE username LIKE ? OR nickname LIKE ?')
    .get(like, like) as unknown as { count: number };
  return { rows, total: total.count };
}

export function adjustUserPoints(username: string, delta: number, actor: string) {
  const user = db.prepare('SELECT points FROM users WHERE username = ?').get(username) as unknown as { points: number } | undefined;
  if (!user) throw new Error('用户不存在');
  const applied = Math.max(0, user.points + delta) - user.points;
  db.prepare('UPDATE users SET points = MAX(0, points + ?) WHERE username = ?').run(delta, username);
  db.prepare(
    `INSERT INTO audit_logs (actor, action, target, detail, created_at) VALUES (?, 'points.adjust', ?, ?, ?)`,
  ).run(actor, username, JSON.stringify({ delta, applied }), Date.now());
  return applied;
}
