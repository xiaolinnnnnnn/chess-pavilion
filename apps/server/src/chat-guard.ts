import type { IRoomPlayer } from '@yige/engine';

/**
 * 房间聊天：长度、频率、敏感词与禁言。
 * 记录只存在内存，不落库、不写日志。
 */
const MAX_LENGTH = 200;
const WINDOW_MS = 5_000;
const WINDOW_LIMIT = 3;
const MUTE_MS = 5_000;
const BLOCKED = ['傻逼', '傻b', '操你', '妈的', 'fuck', 'shit', '赌博', '博彩', '代练', '加微信'];

type Result = { ok: true; content: string } | { ok: false; message: string };

export class ChatGuard {
  private records = new Map<string, { times: number[]; mutedUntil: number }>();

  check(sender: IRoomPlayer, raw: unknown, now = Date.now()): Result {
    const mutedUntil = Number(sender.attributes?.mutedUntil) || 0;
    if (now < mutedUntil) {
      const seconds = Math.ceil((mutedUntil - now) / 1000);
      return { ok: false, message: '你已被禁言，剩余 ' + seconds + ' 秒。' };
    }
    return this.validate(sender.id, raw, now);
  }

  validate(playerId: string, raw: unknown, now = Date.now()): Result {
    if (typeof raw !== 'string') return { ok: false, message: '消息格式不正确。' };

    const content = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!content) return { ok: false, message: '不能发送空白消息。' };
    if ([...content].length > MAX_LENGTH) return { ok: false, message: '消息最多 ' + MAX_LENGTH + ' 个字符。' };

    const lowered = content.toLowerCase();
    if (BLOCKED.some((word) => lowered.includes(word))) {
      return { ok: false, message: '消息包含敏感内容，已被拒绝。' };
    }

    const record = this.records.get(playerId) ?? { times: [], mutedUntil: 0 };
    this.records.set(playerId, record);

    if (now < record.mutedUntil) {
      const seconds = Math.ceil((record.mutedUntil - now) / 1000);
      return { ok: false, message: '发送过快，请 ' + seconds + ' 秒后再试。' };
    }

    record.times = record.times.filter((time) => now - time < WINDOW_MS);
    if (record.times.length >= WINDOW_LIMIT) {
      record.mutedUntil = now + MUTE_MS;
      record.times = [];
      return { ok: false, message: '发送过快，已临时静默 5 秒。' };
    }

    record.times.push(now);
    return { ok: true, content };
  }
}
