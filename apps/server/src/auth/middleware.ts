import type { NextFunction, Request, Response } from 'express';
import { findUserById } from './service';

/** 每次请求都用数据库的最新状态刷新会话，封禁立即生效 */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const session = req.session.user;
  if (session && !session.isVisitor) {
    const row = findUserById(session.id);
    if (!row || row.status === 'banned') {
      req.session.destroy(() => undefined);
    } else {
      req.session.user = {
        ...session,
        nickname: row.nickname,
        role: row.role,
        points: row.points,
      };
    }
  }
  next();
}

export function currentUser(req: Request) {
  return req.session.user;
}

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) return res.status(401).json({ code: 401, message: '请先登录' });
  next();
}

/** 需要正式账号（游客只能试玩人机） */
export function requireMember(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  if (!user) return res.status(401).json({ code: 401, message: '请先登录' });
  if (user.isVisitor) return res.status(403).json({ code: 403, message: '游客不能使用该功能，请注册后登录' });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  if (!user) return res.status(401).json({ code: 401, message: '请先登录' });
  if (user.role !== 'admin') return res.status(403).json({ code: 403, message: '没有权限' });
  next();
}
