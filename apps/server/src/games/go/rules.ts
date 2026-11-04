/**
 * 围棋规则内核：9/13/19 路，中国规则数子，贴目可配置。
 * 前后端共用：服务端用于权威判定，前端用于人机对战与棋盘渲染。
 */
export type Stone = 0 | 1 | 2;
export type Board = Stone[][];

export interface Point {
  row: number;
  col: number;
}

export const SIZES = [9, 13, 19] as const;
export type BoardSize = (typeof SIZES)[number];

export const BLACK: Stone = 1;
export const WHITE: Stone = 2;

export function createBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<Stone>(size).fill(0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice() as Stone[]);
}

export function inBounds(board: Board, row: number, col: number) {
  return row >= 0 && row < board.length && col >= 0 && col < board.length;
}

export function neighbors(board: Board, row: number, col: number): Point[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((point) => inBounds(board, point.row, point.col));
}

export interface GroupInfo {
  stones: Point[];
  liberties: number;
}

/** 取同色连通块与其气数 */
export function groupAt(board: Board, row: number, col: number): GroupInfo {
  const color = board[row][col];
  if (!color) return { stones: [], liberties: 0 };

  const stones: Point[] = [];
  const seen = new Set<number>();
  const libertySet = new Set<number>();
  const stack: Point[] = [{ row, col }];
  const size = board.length;

  while (stack.length) {
    const point = stack.pop()!;
    const key = point.row * size + point.col;
    if (seen.has(key)) continue;
    seen.add(key);
    stones.push(point);

    for (const next of neighbors(board, point.row, point.col)) {
      const value = board[next.row][next.col];
      if (value === 0) libertySet.add(next.row * size + next.col);
      else if (value === color) {
        const nextKey = next.row * size + next.col;
        if (!seen.has(nextKey)) stack.push(next);
      }
    }
  }

  return { stones, liberties: libertySet.size };
}

export type PlayResult =
  | { ok: true; board: Board; captured: Point[]; ko: Point | null }
  | { ok: false; reason: 'occupied' | 'suicide' | 'ko' };

/**
 * 落子并处理提子/自杀/打劫。
 * koPoint 为上一手形成的劫点，禁止立即回提。
 */
export function playMove(board: Board, row: number, col: number, color: Stone, koPoint?: Point | null): PlayResult {
  if (!inBounds(board, row, col)) return { ok: false, reason: 'occupied' };
  if (board[row][col] !== 0) return { ok: false, reason: 'occupied' };
  if (koPoint && koPoint.row === row && koPoint.col === col) return { ok: false, reason: 'ko' };

  const next = cloneBoard(board);
  next[row][col] = color;
  const opponent: Stone = color === BLACK ? WHITE : BLACK;
  const captured: Point[] = [];
  const handled = new Set<number>();

  for (const point of neighbors(next, row, col)) {
    if (next[point.row][point.col] !== opponent) continue;
    const key = point.row * next.length + point.col;
    if (handled.has(key)) continue;
    const group = groupAt(next, point.row, point.col);
    group.stones.forEach((stone) => handled.add(stone.row * next.length + stone.col));
    if (group.liberties === 0) captured.push(...group.stones);
  }

  captured.forEach((point) => {
    next[point.row][point.col] = 0;
  });

  const own = groupAt(next, row, col);
  if (own.liberties === 0) return { ok: false, reason: 'suicide' };

  // 单子提单子且自身仅一气 → 形成劫
  const ko =
    captured.length === 1 && own.stones.length === 1 && own.liberties === 1
      ? { row: captured[0].row, col: captured[0].col }
      : null;

  return { ok: true, board: next, captured, ko };
}

export interface ScoreResult {
  black: number;
  white: number;
  winner: Stone | 0;
  margin: number;
}

/** 中国规则数子：棋子数 + 单方围住的空点，白方加贴目 */
export function areaScore(board: Board, komi = 7.5): ScoreResult {
  const size = board.length;
  const visited = new Array<boolean>(size * size).fill(false);
  let black = 0;
  let white = 0;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const value = board[row][col];
      if (value === BLACK) black++;
      else if (value === WHITE) white++;
    }
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const key = row * size + col;
      if (visited[key] || board[row][col] !== 0) continue;

      const region: Point[] = [];
      const borders = new Set<Stone>();
      const stack: Point[] = [{ row, col }];
      visited[key] = true;

      while (stack.length) {
        const point = stack.pop()!;
        region.push(point);
        for (const next of neighbors(board, point.row, point.col)) {
          const nextKey = next.row * size + next.col;
          const value = board[next.row][next.col];
          if (value === 0) {
            if (!visited[nextKey]) {
              visited[nextKey] = true;
              stack.push(next);
            }
          } else {
            borders.add(value);
          }
        }
      }

      if (borders.size === 1) {
        if (borders.has(BLACK)) black += region.length;
        else white += region.length;
      }
    }
  }

  const whiteTotal = white + komi;
  const winner = black > whiteTotal ? BLACK : whiteTotal > black ? WHITE : 0;
  return { black, white: whiteTotal, winner, margin: Math.abs(black - whiteTotal) };
}
