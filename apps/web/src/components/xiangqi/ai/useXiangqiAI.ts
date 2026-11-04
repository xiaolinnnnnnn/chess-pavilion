import { computed, onBeforeUnmount, ref } from 'vue';
import {
  type Piece,
  type Side,
  cloneBoard,
  createInitialBoard,
  findGeneral,
  hasAnyLegalEscapeMove,
  isInCheck,
  isLegalMoveForPiece,
  sideOf,
} from '@games/xiangqi/rules';
import { PikafishClient } from './pikafish';
import { toFen, uciToPos } from './fen';

export type XiangqiDifficulty = 'easy' | 'normal' | 'hard';

const THINK_TIME: Record<XiangqiDifficulty, number> = { easy: 250, normal: 700, hard: 1500 };
const PIECE_VALUE: Record<string, number> = { R: 9, N: 4, B: 2, A: 2, C: 4.5, P: 1, K: 1000 };

export function useXiangqiAI() {
  const board = ref<Piece[][]>(createInitialBoard());
  const turn = ref<Side>('red');
  const playerSide = ref<Side>('red');
  const difficulty = ref<XiangqiDifficulty>('normal');
  const phase = ref<'setup' | 'playing' | 'finished'>('setup');
  const thinking = ref(false);
  const selected = ref<{ x: number; y: number } | null>(null);
  const targets = ref<Array<{ x: number; y: number }>>([]);
  const lastMove = ref<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  const history = ref<Array<{ from: { x: number; y: number }; to: { x: number; y: number }; piece: Piece }>>([]);
  const result = ref<{ outcome: 'win' | 'loss' | 'draw'; detail: string } | null>(null);
  const engineStatus = ref<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  const engine = new PikafishClient();
  let token = 0;

  const myTurn = computed(() => phase.value === 'playing' && !thinking.value && turn.value === playerSide.value);
  const canUndo = computed(() => phase.value === 'playing' && history.value.length >= 2);

  function legalTargets(from: { x: number; y: number }, side: Side) {
    const piece = board.value[from.x][from.y];
    const list: Array<{ x: number; y: number }> = [];
    if (!piece || sideOf(piece) !== side) return list;

    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 9; y++) {
        if (x === from.x && y === from.y) continue;
        if (!isLegalMoveForPiece(board.value, piece, from, { x, y })) continue;
        const next = cloneBoard(board.value);
        next[x][y] = piece;
        next[from.x][from.y] = '';
        if (isInCheck(next, side)) continue;
        list.push({ x, y });
      }
    }
    return list;
  }

  function click(x: number, y: number) {
    if (!myTurn.value) return;
    const piece = board.value[x][y];

    if (selected.value && targets.value.some((item) => item.x === x && item.y === y)) {
      const from = selected.value;
      selected.value = null;
      targets.value = [];
      void play(from, { x, y });
      return;
    }

    if (piece && sideOf(piece) === playerSide.value) {
      selected.value = { x, y };
      targets.value = legalTargets({ x, y }, playerSide.value);
    } else {
      selected.value = null;
      targets.value = [];
    }
  }

  function checkGameOver(nextBoard: Piece[][], mover: Side): 'win' | 'loss' | null {
    const enemy: Side = mover === 'red' ? 'green' : 'red';
    const enemyGeneral = findGeneral(nextBoard, enemy);
    const myGeneral = findGeneral(nextBoard, mover);
    if (!myGeneral) return 'loss';
    if (!enemyGeneral) return 'win';
    if (!hasAnyLegalEscapeMove(nextBoard, enemy)) return 'win';
    if (isInCheck(nextBoard, mover) && !hasAnyLegalEscapeMove(nextBoard, mover)) return 'loss';
    return null;
  }

  async function play(from: { x: number; y: number }, to: { x: number; y: number }) {
    const piece = board.value[from.x][from.y];
    if (!piece) return;
    const next = cloneBoard(board.value);
    next[to.x][to.y] = piece;
    next[from.x][from.y] = '';
    board.value = next;
    history.value.push({ from, to, piece });
    lastMove.value = { from, to };
    turn.value = turn.value === 'red' ? 'green' : 'red';

    const outcome = checkGameOver(next, sideOf(piece)!);
    if (outcome) {
      finish(outcome, outcome === 'win' ? '将死对方' : '被将死');
      return;
    }
    void aiTurn();
  }

  function applyAiMove(from: { x: number; y: number }, to: { x: number; y: number }) {
    const piece = board.value[from.x][from.y];
    if (!piece) return false;
    const legal = legalTargets(from, sideOf(piece)!);
    if (!legal.some((item) => item.x === to.x && item.y === to.y)) return false;

    const next = cloneBoard(board.value);
    next[to.x][to.y] = piece;
    next[from.x][from.y] = '';
    board.value = next;
    history.value.push({ from, to, piece });
    lastMove.value = { from, to };
    turn.value = turn.value === 'red' ? 'green' : 'red';

    const outcome = checkGameOver(next, sideOf(piece)!);
    if (outcome) finish(outcome === 'win' ? 'loss' : 'win', outcome === 'win' ? '被将死' : '将死对方');
    return true;
  }

  function fallbackMove(side: Side) {
    const options: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; score: number }> = [];
    for (let fx = 0; fx < 10; fx++) {
      for (let fy = 0; fy < 9; fy++) {
        const piece = board.value[fx][fy];
        if (!piece || sideOf(piece) !== side) continue;
        for (const target of legalTargets({ x: fx, y: fy }, side)) {
          const captured = board.value[target.x][target.y];
          const score = (captured ? PIECE_VALUE[captured[1]] ?? 0 : 0) + Math.random() * 0.3;
          options.push({ from: { x: fx, y: fy }, to: target, score });
        }
      }
    }
    options.sort((a, b) => b.score - a.score);
    return options[0] ?? null;
  }

  async function aiTurn() {
    if (phase.value !== 'playing') return;
    const myToken = ++token;
    thinking.value = true;
    const side = turn.value;

    let applied = false;
    if (engineStatus.value !== 'fallback') {
      try {
        if (engineStatus.value === 'idle') engineStatus.value = 'loading';
        await engine.load();
        engineStatus.value = 'ready';
        const move = await engine.think(toFen(board.value, side), THINK_TIME[difficulty.value]);
        if (myToken !== token) return;
        const pos = uciToPos(move);
        if (pos) applied = applyAiMove(pos.from, pos.to);
      } catch {
        engineStatus.value = 'fallback';
      }
    }

    if (myToken !== token) return;
    if (!applied) {
      const fallback = fallbackMove(side);
      if (fallback) applied = applyAiMove(fallback.from, fallback.to);
    }
    thinking.value = false;
  }

  function finish(outcome: 'win' | 'loss' | 'draw', detail: string) {
    token++;
    thinking.value = false;
    phase.value = 'finished';
    result.value = { outcome, detail };
    selected.value = null;
    targets.value = [];
  }

  function undo() {
    if (!canUndo.value) return;
    token++;
    thinking.value = false;
    history.value.pop();
    history.value.pop();
    board.value = createInitialBoard();
    for (const item of history.value) {
      board.value[item.to.x][item.to.y] = item.piece;
      board.value[item.from.x][item.from.y] = '';
    }
    const last = history.value[history.value.length - 1];
    lastMove.value = last ? { from: last.from, to: last.to } : null;
    turn.value = history.value.length % 2 === 0 ? 'red' : 'green';
    result.value = null;
    phase.value = 'playing';
    if (turn.value !== playerSide.value) void aiTurn();
  }

  function reset(side: Side = playerSide.value) {
    token++;
    thinking.value = false;
    board.value = createInitialBoard();
    turn.value = 'red';
    playerSide.value = side;
    phase.value = 'playing';
    selected.value = null;
    targets.value = [];
    lastMove.value = null;
    history.value = [];
    result.value = null;
    if (side === 'green') void aiTurn();
  }

  function resign() {
    if (phase.value !== 'playing') return;
    finish('loss', '你已认输');
  }

  function openSetup() {
    token++;
    thinking.value = false;
    phase.value = 'setup';
    board.value = createInitialBoard();
    result.value = null;
  }

  onBeforeUnmount(() => {
    token++;
    engine.dispose();
  });

  return {
    board,
    turn,
    playerSide,
    difficulty,
    phase,
    thinking,
    selected,
    targets,
    lastMove,
    result,
    history,
    engineStatus,
    myTurn,
    canUndo,
    click,
    undo,
    reset,
    resign,
    openSetup,
  };
}
