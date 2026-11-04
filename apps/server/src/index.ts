import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { config, ensureDataDir } from './config';
import { seedAdmin } from './db';
import { Controller } from './controller';
import { SocketManager } from './socket';
import { createRoutes } from './routes/api';
import { gameLoaded } from './games';
import { SqliteSessionStore } from './session-store';

async function main() {
  ensureDataDir();
  seedAdmin();
  await gameLoaded;

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  const store = new SqliteSessionStore(config.sessionMaxAge);
  app.use(
    session({
      name: config.sessionCookie,
      secret: config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: config.sessionMaxAge,
      },
    }),
  );

  const server = http.createServer(app);
  const socket = new SocketManager(
    server,
    (sid) =>
      new Promise((resolve) => {
        store.get(sid, (error: Error | null, sess: any) => {
          if (error || !sess?.user) return resolve(null);
          resolve(sess.user);
        });
      }),
  );

  const controller = new Controller(server, socket);
  controller.run();

  app.use('/api', createRoutes(controller));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  if (fs.existsSync(config.webDist)) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(config.webDist, 'index.html'));
    });
  }

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[http]', error.message);
    res.status(500).json({ code: 500, message: '服务器开小差了，请稍后再试' });
  });

  server.listen(config.port, () => {
    console.info('[server] listening on ' + config.port + ' (' + (config.isProd ? 'production' : 'development') + ')');
    console.info('[server] games: ' + Object.keys(controller.games).join(', '));
  });

  const shutdown = () => {
    console.info('[server] shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[server] 启动失败', error);
  process.exit(1);
});
