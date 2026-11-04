import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Controller } from '../controller';
import { createAuthRouter } from '../auth/router';
import { attachUser, requireAdmin, requireMember } from '../auth/middleware';
import { getMatch, leaderboard, listUsers, myMatches, recordAiMatch, userSummary } from '../stats';
import { db, audit } from '../db';
import { toPlayer } from '../auth/service';

export function createRoutes(controller: Controller) {
  const router = Router();
  router.use(attachUser);
  router.use('/auth', createAuthRouter());

  router.get('/config', (req: Request, res: Response) => {
    res.json({
      code: 0,
      data: {
        games: controller.games,
        user: req.session.user ?? null,
        player: req.session.user ? toPlayer(req.session.user) : null,
      },
    });
  });

  router.get('/rooms', (_req, res) => {
    res.json({ code: 0, data: controller.roomSummary() });
  });

  router.get('/players', (_req, res) => {
    res.json({
      code: 0,
      data: controller.players.map((player) => ({
        id: player.id,
        name: player.name,
        status: player.status,
        isAdmin: player.isAdmin,
        isVisitor: player.isVisitor,
        attributes: player.attributes,
      })),
    });
  });

  router.get('/messages', (_req, res) => {
    res.json({ code: 0, data: controller.messages });
  });

  router.get('/records/:id', (req, res) => {
    const record = getMatch(req.params.id);
    if (!record) return res.status(404).json({ code: 404, message: '对局不存在' });
    res.json({
      code: 0,
      data: {
        ...record,
        players: JSON.parse(record.players),
        winners: JSON.parse(record.winners),
        result: record.result ? JSON.parse(record.result) : null,
        moves: record.moves ? JSON.parse(record.moves) : null,
      },
    });
  });

  router.get('/users/:username', (req, res) => {
    const summary = userSummary(req.params.username);
    if (!summary) return res.status(404).json({ code: 404, message: '用户不存在' });
    res.json({ code: 0, data: summary });
  });

  router.get('/leaderboard/:game?', (req, res) => {
    res.json({ code: 0, data: leaderboard(req.params.game) });
  });

  router.get('/me/stats', requireMember, (req, res) => {
    res.json({ code: 0, data: userSummary(req.session.user!.username) });
  });

  router.get('/me/games', requireMember, (req, res) => {
    const game = req.query.game ? String(req.query.game) : undefined;
    const from = req.query.from ? Number(req.query.from) || undefined : undefined;
    const to = req.query.to ? Number(req.query.to) || undefined : undefined;
    res.json({ code: 0, data: myMatches(req.session.user!.username, { game, from, to }) });
  });

  // 人机对局结算上报（仅登录用户，不积分）
  router.post('/me/games', requireMember, (req, res) => {
    const { game, result, moves } = req.body ?? {};
    if (!game || !['win', 'loss', 'draw'].includes(String(result))) {
      return res.status(400).json({ code: 400, message: '参数不合法' });
    }
    try {
      const id = recordAiMatch(req.session.user!.username, { game: String(game), result: String(result) as 'win' | 'loss' | 'draw', moves: Number(moves) || 0 }).id;
      res.json({ code: 0, data: { id } });
    } catch (error) {
      res.status(400).json({ code: 400, message: (error as Error).message || '记录失败' });
    }
  });

  router.get('/admin/users', requireAdmin, (req, res) => {
    const keyword = String(req.query.keyword || '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 20));
    res.json({ code: 0, data: listUsers(keyword, page, pageSize) });
  });

  router.patch('/admin/users/:id', requireAdmin, (req, res) => {
    const actor = req.session.user!.username;
    const row = db.prepare('SELECT id, username, role, status, points FROM users WHERE id = ?').get(req.params.id) as
      | { id: string; username: string; role: string; status: string; points: number }
      | undefined;
    if (!row) return res.status(404).json({ code: 404, message: '用户不存在' });

    const { role, status, pointsDelta, reason } = req.body ?? {};
    if (role && ['user', 'admin'].includes(role)) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, row.id);
      audit(actor, 'user.role', row.username, { role });
    }
    if (status && ['active', 'banned'].includes(status)) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, row.id);
      audit(actor, 'user.status', row.username, { status, reason });
      if (status === 'banned') controller.kickUser(row.id);
    }
    if (pointsDelta !== undefined) {
      const delta = Math.trunc(Number(pointsDelta) || 0);
      if (delta !== 0) {
        const applied = Math.max(0, row.points + delta) - row.points;
        db.prepare('UPDATE users SET points = MAX(0, points + ?) WHERE id = ?').run(delta, row.id);
        audit(actor, 'user.points', row.username, { delta, applied, reason });
      }
    }

    const updated = db.prepare('SELECT id, username, nickname, role, status, points FROM users WHERE id = ?').get(row.id);
    res.json({ code: 0, data: updated });
  });

  router.post('/admin/rooms/:id/close', requireAdmin, async (req, res) => {
    try {
      const room = controller.rooms.find((item) => item.id === req.params.id);
      if (!room) return res.status(404).json({ code: 404, message: '房间不存在' });
      await controller.closeRoom(req.session.user as any, room);
      audit(req.session.user!.username, 'room.close', room.name);
      res.json({ code: 0, data: true });
    } catch (error) {
      res.status(400).json({ code: 400, message: (error as Error).message });
    }
  });

  return router;
}
