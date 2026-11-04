import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from '../utils/rate-limit';
import { audit } from '../db';
import { changePassword, changeUsername, createVisitor, login, register, toPlayer } from './service';
import { requireLogin } from './middleware';

function reply(req: Request, res: Response, status = 200) {
  const user = req.session.user!;
  res.status(status).json({ code: 0, data: { user, player: toPlayer(user) } });
}

function persist(req: Request, res: Response, user: NonNullable<Request['session']['user']>, status = 200) {
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ code: 500, message: '会话创建失败' });
    req.session.user = user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ code: 500, message: '会话保存失败' });
      res.status(status).json({ code: 0, data: { user, player: toPlayer(user) } });
    });
  });
}

// 登录：30 秒内不允许再次操作（无论成功失败，触发后进入冷却）
const loginLimiter = rateLimit({ windowMs: 30_000, max: 1, key: (req) => `${req.ip}:${String(req.body?.username || '')}` });
const registerLimiter = rateLimit({ windowMs: 30_000, max: 1, key: (req) => String(req.ip) });

export function createAuthRouter() {
  const router = Router();

  router.get('/me', (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ code: 401, message: '未登录' });
    res.json({ code: 0, data: { user, player: toPlayer(user) } });
  });

  router.post('/register', registerLimiter, (req, res) => {
    try {
      const user = register(req.body?.username, req.body?.password);
      audit(user.username, 'auth.register');
      persist(req, res, user, 201);
    } catch (error) {
      res.status(400).json({ code: 400, message: (error as Error).message });
    }
  });

  router.post('/login', loginLimiter, (req, res) => {
    try {
      const user = login(req.body?.username, req.body?.password);
      persist(req, res, user);
    } catch (error) {
      res.status(401).json({ code: 401, message: (error as Error).message });
    }
  });

  router.post('/visitor', (req, res) => {
    const user = createVisitor(req.body?.name);
    persist(req, res, user);
  });

  router.post('/logout', (req, res) => {
    const name = req.session.user?.username;
    req.session.destroy(() => {
      res.clearCookie('yige.sid');
      if (name) audit(name, 'auth.logout');
      res.json({ code: 0, data: true });
    });
  });

  router.post('/password', requireLogin, (req, res) => {
    const user = req.session.user!;
    try {
      changePassword(user.id, String(req.body?.oldPassword || ''), String(req.body?.newPassword || ''));
      audit(user.username, 'auth.password');
      res.json({ code: 0, data: true });
    } catch (error) {
      res.status(400).json({ code: 400, message: (error as Error).message });
    }
  });

  router.post('/username', requireLogin, (req, res) => {
    const user = req.session.user!;
    try {
      const updated = changeUsername(user.id, req.body?.username);
      req.session.user = updated;
      req.session.save(() => {
        audit(updated.username, 'auth.username');
        res.json({ code: 0, data: { user: updated, player: toPlayer(updated) } });
      });
    } catch (error) {
      res.status(400).json({ code: 400, message: (error as Error).message });
    }
  });

  return router;
}
