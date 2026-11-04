import type { NextFunction, Request, Response } from 'express';

interface Options {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
}

/** 极简滑动窗口限流，进程内生效；成功后可用 rateLimitReset 清空计数 */
export function rateLimit({ windowMs, max, key }: Options) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const k = key(req);
    const now = Date.now();
    const recent = (hits.get(k) ?? []).filter((time) => now - time < windowMs);

    if (recent.length >= max) {
      const retry = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ code: 429, message: `操作过于频繁，请 ${retry} 秒后再试` });
    }

    recent.push(now);
    hits.set(k, recent);
    (req as any).rateLimitReset = () => hits.delete(k);
    next();
  };
}
