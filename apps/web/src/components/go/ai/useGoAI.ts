import { computed, onBeforeUnmount, ref } from 'vue';
import {
  BLACK,
  WHITE,
  areaScore,
  createBoard,
  playMove,
  type Board,
  type Point,
  type Stone,
} from '@games/go/rules';
import type { GoDifficulty } from './mcts';

interface WorkerReply {
  id: number;
  move: Point | null;
}

const KOMI = 7.5;

export function useGoAI() {
  const board = ref<Board>(createBoard(9));
  const size = ref(9);
  const playerColor = ref<Stone>(BLACK);
  const difficulty = ref<GoDifficulty>('normal');
  const phase = ref<'setup' | 'playing' | 'finished'>('setup');
  const thinking = ref(false);
  const currentColor = ref<Stone>(BLACK);
  const passes = ref(0);
  const koPoint = ref<Point | null>(null);
  const history = ref<Array<Point & { color: Stone; pass?: boolean }>>([]);
  const captures = ref<Record<number, number>>({ 1: 0, 2: 0 });
  const result = ref<{ outcome: 'win' | 'loss' | 'draw'; detail: string } | null>(null);
  const lastMove = ref<Point | null>(null);

  let worker: Worker | null = null;
  let seq = 0;
  let token = 0;
  const pending = new Map<number, (move: Point | null) => void>();

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./go.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const callback = pending.get(event.data.id);
      if (callback) {
        pending.delete(event.data.id);
        callback(event.data.move);
      }
    };
    return worker;
  }

  function askAI(nextBoard: Board, color: Stone, ko: Point | null) {
    return new Promise<Point | null>((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      ensureWorker().postMessage({
        id,
        board: nextBoard.map((row) => row.slice()),
        color,
        ko,
        difficulty: difficulty.value,
        komi: KOMI,
      });
    });
  }

  const myTurn = computed(() => phase.value === 'playing' && !thinking.value && playerColor.value === currentColor.value);
  const opponentColor = computed<Stone>(() => (playerColor.value === BLACK ? WHITE : BLACK));

  function reset(nextSize = size.value, color = playerColor.value) {
    token++;
    thinking.value = false;
    size.value = nextSize;
    playerColor.value = color;
    board.value = createBoard(nextSize);
    history.value = [];
    passes.value = 0;
    koPoint.value = null;
    captures.value = { 1: 0, 2: 0 };
    currentColor.value = BLACK;
    lastMove.value = null;
    result.value = null;
    phase.value = 'playing';
    if (playerColor.value !== BLACK) void aiTurn();
  }

  function apply(move: Point, color: Stone, pass = false) {
    if (pass) {
      passes.value += 1;
      history.value.push({ row: -1, col: -1, color, pass: true });
      koPoint.value = null;
    } else {
      const played = playMove(board.value, move.row, move.col, color, koPoint.value);
      if (!played.ok) return false;
      board.value = played.board;
      koPoint.value = played.ko;
      captures.value[color] += played.captured.length;
      passes.value = 0;
      history.value.push({ row: move.row, col: move.col, color });
      lastMove.value = move;
    }
    currentColor.value = color === BLACK ? WHITE : BLACK;
    return true;
  }

  function finishScore() {
    const score = areaScore(board.value, KOMI);
    const outcome = score.winner === 0 ? 'draw' : score.winner === playerColor.value ? 'win' : 'loss';
    phase.value = 'finished';
    result.value = { outcome, detail: `黑 ${score.black} 目 · 白 ${score.white} 目（含贴目）` };
  }

  async function aiTurn() {
    const myToken = ++token;
    thinking.value = true;
    const color = currentColor.value;
    const snapshot = board.value;
    const move = await askAI(snapshot, color, koPoint.value);
    if (myToken !== token || phase.value !== 'playing') return;

    if (!move) {
      apply({ row: -1, col: -1 }, color, true);
    } else {
      apply(move, color);
    }

    if (passes.value >= 2) {
      finishScore();
      thinking.value = false;
      return;
    }
    thinking.value = false;
  }

  function place(point: Point) {
    if (!myTurn.value) return;
    if (!apply(point, playerColor.value)) return;
    void aiTurn();
  }

  function pass() {
    if (!myTurn.value) return;
    apply({ row: -1, col: -1 }, playerColor.value, true);
    if (passes.value >= 2) {
      finishScore();
      return;
    }
    void aiTurn();
  }

  function resign() {
    if (phase.value !== 'playing') return;
    token++;
    thinking.value = false;
    phase.value = 'finished';
    result.value = { outcome: 'loss', detail: '你已认输' };
  }

  function openSetup() {
    token++;
    thinking.value = false;
    phase.value = 'setup';
    board.value = createBoard(size.value);
    result.value = null;
    history.value = [];
    passes.value = 0;
    koPoint.value = null;
    lastMove.value = null;
  }

  onBeforeUnmount(() => {
    token++;
    worker?.terminate();
    worker = null;
  });

  return {
    board,
    size,
    playerColor,
    difficulty,
    phase,
    thinking,
    captures,
    passes,
    result,
    lastMove,
    history,
    myTurn,
    opponentColor,
    place,
    pass,
    resign,
    reset,
    openSetup,
    komi: KOMI,
  };
}
