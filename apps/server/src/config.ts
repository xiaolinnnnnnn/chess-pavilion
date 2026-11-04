import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/** 运行配置：敏感项全部来自环境变量 */
export const config = {
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 27015),
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'yige.sqlite'),
  sessionSecret: process.env.SESSION_SECRET || 'yige-dev-secret-please-change',
  sessionCookie: process.env.SESSION_COOKIE || 'yige.sid',
  sessionMaxAge: Number(process.env.SESSION_MAX_AGE || 7 * 24 * 60 * 60 * 1000),
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  webDist: path.join(root, '..', 'web', 'dist'),
  points: {
    initial: Number(process.env.POINTS_INITIAL || 100),
    win: Number(process.env.POINTS_WIN || 10),
    loss: Number(process.env.POINTS_LOSS || -5),
    draw: 0,
  },
};

export function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}
