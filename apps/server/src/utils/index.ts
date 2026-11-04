/** 剔除指定键，返回新对象 */
export function omit(obj: Record<string, any>, keys: string[]) {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
}

/** 只保留指定键 */
export function pick(obj: Record<string, any>, keys: string[]) {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 人类可读的剩余时长 */
export function shortTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  let text = '';
  if (days) text += `${days} 天 `;
  if (hours) text += `${hours} 小时 `;
  if (minutes) text += `${minutes} 分钟 `;
  text += `${rest} 秒`;
  return text.trim();
}

export function random(max: number, min = 0) {
  return Math.floor(Math.random() * (max - min)) + min;
}
