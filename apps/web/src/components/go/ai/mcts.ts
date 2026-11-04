import { areaScore, cloneBoard, playMove, type Board, type Point, type Stone } from '@games/go/rules';

export type GoDifficulty = 'easy' | 'normal' | 'hard';

const PLAYOUTS: Record<GoDifficulty, number> = { easy: 120, normal: 480, hard: 1200 };
const MAX_SIM_MOVES = 240;

function neighborsOf(board: Board, point: Point) {
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((item) => item.row >= 0 && item.col >= 0 && item.row < board.length && item.col < board.length);
}

/** 候选点：已有棋子周围两格内的空点；空盘取天元 */
function candidates(board: Board): Point[] {
  const size = board.length;
  const seen = new Set<number>();
  const list: Point[] = [];
  let hasStone = false;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === 0) continue;
      hasStone = true;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size || board[r][c] !== 0) continue;
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

function randomSimulation(board: Board, color: Stone, ko: Point | null, komi: number) {
  let current = color;
  let state = board;
  let koPoint = ko;
  let passes = 0;

  for (let step = 0; step < MAX_SIM_MOVES; step++) {
    const moves = candidates(state);
    let played = false;

    // 随机尝试若干候选，失败就跳过
    for (let attempt = 0; attempt < 8 && moves.length; attempt++) {
      const index = Math.floor(Math.random() * moves.length);
      const move = moves.splice(index, 1)[0];
      const result = playMove(state, move.row, move.col, current, koPoint);
      if (!result.ok) continue;
      state = result.board;
      koPoint = result.ko;
      current = current === 1 ? 2 : 1;
      passes = 0;
      played = true;
      break;
    }

    if (!played) {
      passes += 1;
      current = current === 1 ? 2 : 1;
      if (passes >= 2) break;
    }
  }

  return areaScore(state, komi);
}

export function chooseGoMove(
  board: Board,
  color: Stone,
  ko: Point | null,
  difficulty: GoDifficulty,
  komi = 7.5,
): Point | null {
  const moves = candidates(board);
  if (!moves.length) return null;

  const budget = PLAYOUTS[difficulty];
  const perMove = Math.max(4, Math.floor(budget / Math.min(moves.length, 36)));
  const shortlist = moves.slice(0, 36);

  let best: Point | null = null;
  let bestRate = -1;

  for (const move of shortlist) {
    const attempt = playMove(board, move.row, move.col, color, ko);
    if (!attempt.ok) continue;

    let wins = 0;
    for (let i = 0; i < perMove; i++) {
      const score = randomSimulation(attempt.board, color === 1 ? 2 : 1, attempt.ko, komi);
      if (score.winner === color) wins += 1;
    }

    const rate = wins / perMove + Math.random() * 0.01;
    if (rate > bestRate) {
      bestRate = rate;
      best = move;
    }
  }

  return best;
}

export { cloneBoard };
