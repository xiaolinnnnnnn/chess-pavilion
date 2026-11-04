/**
 * 终局大字文案（棋盘正中央 GameResultOverlay 使用）。
 * 失败统一用这句调侃替代「失败」二字，胜利/平局/中断保持原样。
 */
export const RESULT_TEXT = {
  win: '胜利',
  lose: '这分明是老叟戏顽童',
  draw: '平局',
  interrupted: '对局已中断',
  goInterrupted: '对局中断',
} as const;
