import session from 'express-session';
import { db } from './db';

/** 基于内置 SQLite 的会话存储，避免额外原生依赖 */
export class SqliteSessionStore extends session.Store {
  private readonly ttl: number;

  constructor(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    super();
    this.ttl = ttlMs;
    db.prepare('DELETE FROM sessions WHERE expire < ?').run(Date.now());
  }

  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    try {
      const row = db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?').get(sid) as
        | { sess: string; expire: number }
        | undefined;
      if (!row || row.expire < Date.now()) {
        if (row) db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return callback(null, null);
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
    try {
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + this.ttl;
      db.prepare(
        'INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire',
      ).run(sid, JSON.stringify(sess), expire);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: () => void) {
    try {
      const expire = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + this.ttl;
      db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      callback?.();
    } catch {
      callback?.();
    }
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  clear(callback?: () => void) {
    db.prepare('DELETE FROM sessions').run();
    callback?.();
  }
}
