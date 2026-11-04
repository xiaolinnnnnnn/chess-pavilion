import type { Piece } from '@games/xiangqi/rules';

/** 把棋盘转成 Pikafish/UCI 使用的 FEN（红方大写，绿方小写） */
export function toFen(board: Piece[][], turn: 'red' | 'green'): string {
  const rows: string[] = [];
  for (let x = 0; x < 10; x++) {
    let row = '';
    let empty = 0;
    for (let y = 0; y < 9; y++) {
      const piece = board[x][y];
      if (!piece) {
        empty++;
        continue;
      }
      if (empty) {
        row += empty;
        empty = 0;
      }
      row += piece[0] === 'r' ? piece[1].toUpperCase() : piece[1].toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'} - - 0 1`;
}

/** Pikafish 的着法形如 h2e2：文件 a-i 对应列，rank 0 在红方底线 */
export function uciToPos(move: string): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const match = /^([a-i])(\d)([a-i])(\d)$/.exec(move.trim());
  if (!match) return null;
  return {
    from: { x: 9 - Number(match[2]), y: match[1].charCodeAt(0) - 97 },
    to: { x: 9 - Number(match[4]), y: match[3].charCodeAt(0) - 97 },
  };
}
