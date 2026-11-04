/**
 * 五子棋规则内核（前后端共用）
 *
 * 这里只放纯函数：不依赖 DOM、Node API 或任何框架。
 * - 服务端用它做权威校验（落子合法性、胜负、平局）
 * - 前端人机模式与棋盘渲染用它做同样的判断，保证规则一致
 *
 * 坐标约定：board[row][col]，row 从上往下递增，col 从左往右递增。
 */

export const BOARD_SIZE = 15;

/** 0 空位，1 黑，2 白 */
export type Stone = 0 | 1 | 2;
export type Board = Stone[][];

export const BLACK: Stone = 1;
export const WHITE: Stone = 2;

export interface Coord {
  row: number;
  col: number;
}

export interface Move extends Coord {
  color: Stone;
}

export type JudgeResult =
  | { type: 'win'; line: Coord[] }
  | { type: 'draw' }
  | { type: 'continue' };

export function createBoard(size = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice() as Stone[]);
}

export function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < (board[row]?.length ?? 0);
}

/** 坐标必须是整数、在棋盘内且为空位 */
export function isPlayable(board: Board, row: number, col: number): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && inBounds(board, row, col) && board[row][col] === 0;
}

export function placeStone(board: Board, row: number, col: number, color: Stone): boolean {
  if (!isPlayable(board, row, col) || color === 0) return false;
  board[row][col] = color;
  return true;
}

export function removeStone(board: Board, row: number, col: number): void {
  if (inBounds(board, row, col)) board[row][col] = 0;
}

export function rebuildBoard(history: Move[], size = BOARD_SIZE): Board {
  const board = createBoard(size);
  for (const move of history) {
    if (isPlayable(board, move.row, move.col)) board[move.row][move.col] = move.color;
  }
  return board;
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // 横
  [1, 0], // 竖
  [1, 1], // 主对角
  [1, -1], // 副对角
];

/**
 * 取经过 (row,col) 的同色最长连线。
 * 自由规则下 5 子及以上都算胜（长连也算胜）。
 */
export function findWinLine(board: Board, row: number, col: number, color: Stone): Coord[] | null {
  if (color === 0 || !inBounds(board, row, col) || board[row][col] !== color) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const before: Coord[] = [];
    const after: Coord[] = [];

    for (let step = 1; ; step++) {
      const r = row - dr * step;
      const c = col - dc * step;
      if (!inBounds(board, r, c) || board[r][c] !== color) break;
      before.unshift({ row: r, col: c });
    }
    for (let step = 1; ; step++) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (!inBounds(board, r, c) || board[r][c] !== color) break;
      after.push({ row: r, col: c });
    }

    const line = [...before, { row, col }, ...after];
    if (line.length >= 5) return line;
  }

  return null;
}

/** 落子后的局面判定：胜利 / 平局 / 继续 */
export function judgeMove(board: Board, row: number, col: number, color: Stone): JudgeResult {
  const line = findWinLine(board, row, col, color);
  if (line) return { type: 'win', line };
  if (isBoardFull(board)) return { type: 'draw' };
  return { type: 'continue' };
}

/** A1 ~ O15 形式的可读坐标 */
export function formatCoord({ row, col }: Coord, size = BOARD_SIZE): string {
  return `${String.fromCharCode(65 + col)}${size - row}`;
}

/** 用于日志、提示的落子文案 */
export function describeMove(move: Move, size = BOARD_SIZE): string {
  return `${move.color === BLACK ? '黑' : '白'} ${formatCoord(move, size)}`;
}

/** 对手颜色 */
export function otherColor(color: Stone): Stone {
  return color === BLACK ? WHITE : BLACK;
}

/** 统计某颜色棋子数量，用于判断“是否轮到我”以外的场景（回放、AI 评估） */
export function countStones(board: Board, color: Stone): number {
  let count = 0;
  for (const row of board) for (const cell of row) if (cell === color) count++;
  return count;
}
