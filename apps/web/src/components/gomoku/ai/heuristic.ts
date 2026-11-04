import {
  type Board,
  type Coord,
  type Stone,
  isPlayable,
  otherColor,
} from '@games/gomoku/rules';

export type Difficulty = 'easy' | 'normal' | 'hard';

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

const WIN_SCORE = 10_000_000;
const LOSE_SCORE = 9_000_000;

interface Candidate {
  row: number;
  col: number;
  score: number;
}

function stoneAt(board: Board, row: number, col: number): Stone | -1 {
  if (row < 0 || row >= board.length || col < 0 || col >= board.length) return -1;
  return board[row][col];
}

/** 假设在 (row,col) 放入 color 后，该点四个方向的形状评分 */
function shapeScore(board: Board, row: number, col: number, color: Stone): number {
  let total = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let openEnds = 0;
    let gapBridge = 0;

    for (const sign of [1, -1]) {
      let step = 1;
      while (stoneAt(board, row + dr * step * sign, col + dc * step * sign) === color) {
        count++;
        step++;
      }
      const edge = stoneAt(board, row + dr * step * sign, col + dc * step * sign);
      if (edge === 0) openEnds++;
      // 隔一格的延伸（如 ●●○●），能显著提升三/四的威胁
      const bridge = stoneAt(board, row + dr * (step + 1) * sign, col + dc * (step + 1) * sign);
      if (edge === 0 && bridge === color) gapBridge++;
    }

    if (count >= 5) return WIN_SCORE;
    if (count === 4) total += openEnds === 2 ? 500_000 : openEnds === 1 ? 80_000 : 0;
    else if (count === 3) total += openEnds === 2 ? 12_000 + gapBridge * 4_000 : openEnds === 1 ? 1_500 : 0;
    else if (count === 2) total += openEnds === 2 ? 800 : openEnds === 1 ? 120 : 0;
    else total += openEnds === 2 ? 40 : openEnds === 1 ? 8 : 0;
  }

  return total;
}

function candidates(board: Board, radius = 2): Coord[] {
  const size = board.length;
  let hasStone = false;
  const seen = new Set<number>();
  const list: Coord[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === 0) continue;
      hasStone = true;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (!isPlayable(board, r, c)) continue;
          const key = r * size + c;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push({ row: r, col: c });
        }
      }
    }
  }

  if (!hasStone) {
    const center = Math.floor(size / 2);
    return [{ row: center, col: center }];
  }
  return list;
}

function rank(board: Board, color: Stone, radius: number): Candidate[] {
  const opponent = otherColor(color);
  return candidates(board, radius)
    .map(({ row, col }) => {
      const attack = shapeScore(board, row, col, color);
      const defend = shapeScore(board, row, col, opponent);
      const center = 1 - (Math.abs(row - 7) + Math.abs(col - 7)) / 14;
      return {
        row,
        col,
        score: attack * 1.08 + defend * 0.92 + center * 6,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function apply(board: Board, { row, col }: Coord, color: Stone): Board {
  const next = board.map((line) => line.slice() as Stone[]);
  next[row][col] = color;
  return next;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 纯 JS 棋力，作为 Rapfi 未就绪/加载失败时的降级方案。
 * 三档难度只在候选数量、噪声与预判深度上有差异，规则判定始终复用共享内核。
 */
export function chooseHeuristicMove(board: Board, color: Stone, difficulty: Difficulty): Coord | null {
  const opponent = otherColor(color);

  if (difficulty === 'easy') {
    const list = rank(board, color, 1);
    if (!list.length) return null;
    const best = list[0];
    // 有直接取胜/必须封堵的点仍然要下，其余在靠前的候选里随机
    if (best.score > 100_000) return { row: best.row, col: best.col };
    const pool = list.slice(0, Math.min(4, list.length));
    return Math.random() < 0.25 ? pick(list.slice(0, 10)) : pick(pool);
  }

  const ranked = rank(board, color, 2);
  if (!ranked.length) return null;
  if (difficulty === 'normal') {
    return { row: ranked[0].row, col: ranked[0].col };
  }

  // hard：对前 8 个候选做一层对手最佳应对的评估，避免送活三
  const shortlist = ranked.slice(0, 8);
  let bestMove: Candidate | null = null;
  let bestValue = -Infinity;

  for (const move of shortlist) {
    const afterMine = apply(board, move, color);
    const replies = rank(afterMine, opponent, 2).slice(0, 1);
    const replyScore = replies[0]?.score ?? 0;
    const value = move.score - replyScore * 0.85;
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }

  if (!bestMove) return null;
  // 必胜/必堵点时不再引入随机
  return { row: bestMove.row, col: bestMove.col };
}

/** 返回棋盘上第一个空位，兜底用 */
export function firstEmpty(board: Board): Coord | null {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board.length; col++) {
      if (board[row][col] === 0) return { row, col };
    }
  }
  return null;
}
