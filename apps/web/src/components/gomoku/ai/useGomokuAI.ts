import { computed, onBeforeUnmount, ref } from 'vue';
import {
  BLACK,
  WHITE,
  type Board,
  type Coord,
  type Move,
  type Stone,
  createBoard,
  isPlayable,
  judgeMove,
  rebuildBoard,
} from '@games/gomoku/rules';
import { chooseHeuristicMove, type Difficulty } from './heuristic';
import { RapfiClient } from './rapfi';

export type AIOutcome = 'win' | 'loss' | 'draw';

const UNDO_LIMIT = 3;
const THINK_BUDGET: Record<Exclude<Difficulty, 'easy'>, number> = { normal: 500, hard: 1600 };
const MIN_DELAY: Record<Difficulty, number> = { easy: 380, normal: 220, hard: 60 };

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * 人机对战状态机：规则判定复用共享内核，AI 计算全部在浏览器完成。
 * Rapfi 未就绪或超时时自动使用内置棋力，不阻塞界面。
 */
export function useGomokuAI() {
  const board = ref<Board>(createBoard());
  const history = ref<Move[]>([]);
  const playerColor = ref<Stone>(BLACK);
  const difficulty = ref<Difficulty>('normal');
  const phase = ref<'setup' | 'playing' | 'finished'>('setup');
  const thinking = ref(false);
  const undoLeft = ref(UNDO_LIMIT);
  const outcome = ref<AIOutcome | null>(null);
  const winLine = ref<Coord[] | null>(null);
  const lastMove = ref<Coord | null>(null);
  const notice = ref('');
  const engineStatus = ref<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  const engine = new RapfiClient();
  let moveToken = 0;

  const stoned = computed(() => history.value.length);
  const currentColor = computed<Stone>(() => (stoned.value % 2 === 0 ? BLACK : WHITE));
  const myTurn = computed(() => phase.value === 'playing' && !thinking.value && currentColor.value === playerColor.value);
  const canUndo = computed(() => phase.value === 'playing' && undoLeft.value > 0 && history.value.length > 0);

  function applyStone(coord: Coord, color: Stone) {
    const next = board.value.map((line) => line.slice() as Stone[]);
    next[coord.row][coord.col] = color;
    board.value = next;
    history.value.push({ ...coord, color });
    lastMove.value = { ...coord };
    return judgeMove(board.value, coord.row, coord.col, color);
  }

  function finish(result: AIOutcome, reason: string, line: Coord[] | null = null) {
    moveToken++;
    thinking.value = false;
    phase.value = 'finished';
    outcome.value = result;
    winLine.value = line;
    notice.value = reason;
  }

  function place(coord: Coord) {
    if (!myTurn.value || !isPlayable(board.value, coord.row, coord.col)) return;

    const verdict = applyStone(coord, playerColor.value);
    if (verdict.type === 'win') {
      finish('win', '五子连珠，你赢了。', verdict.line);
      return;
    }
    if (verdict.type === 'draw') {
      finish('draw', '棋盘已满，本局平局。');
      return;
    }
    void runAI();
  }

  async function runAI() {
    const token = ++moveToken;
    thinking.value = true;

    const level = difficulty.value;
    const aiColor = currentColor.value;
    const started = performance.now();
    let coord: Coord | null = null;

    if (level !== 'easy') {
      if (engineStatus.value === 'idle') engineStatus.value = 'loading';
      try {
        await engine.load();
        coord = await engine.think(board.value, THINK_BUDGET[level]);
        engineStatus.value = 'ready';
      } catch {
        engineStatus.value = 'fallback';
        if (!notice.value) notice.value = 'AI 引擎不可用，已降级为内置棋力，对局继续。';
      }
    }

    const elapsed = performance.now() - started;
    if (elapsed < MIN_DELAY[level]) await sleep(MIN_DELAY[level] - elapsed);
    if (token !== moveToken || phase.value !== 'playing') return;

    if (!coord || !isPlayable(board.value, coord.row, coord.col)) {
      coord = chooseHeuristicMove(board.value, aiColor, level);
    }
    if (!coord) {
      thinking.value = false;
      return;
    }

    const verdict = applyStone(coord, aiColor);
    thinking.value = false;
    if (verdict.type === 'win') {
      finish('loss', 'AI 五子连珠，本局你输了。', verdict.line);
    } else if (verdict.type === 'draw') {
      finish('draw', '棋盘已满，本局平局。');
    }
  }

  function undo() {
    if (!canUndo.value) return;

    if (thinking.value) {
      moveToken++;
      thinking.value = false;
    }

    const moves = history.value;
    while (moves.length > 0) {
      const last = moves.pop()!;
      if (last.color === playerColor.value) break;
    }

    board.value = rebuildBoard(moves);
    undoLeft.value -= 1;
    winLine.value = null;
    outcome.value = null;
    phase.value = 'playing';
    lastMove.value = moves.length ? { row: moves[moves.length - 1].row, col: moves[moves.length - 1].col } : null;

    // 玩家执白时，撤销后可能又轮到 AI
    if (currentColor.value !== playerColor.value) void runAI();
  }

  function restart(color: Stone = playerColor.value) {
    moveToken++;
    thinking.value = false;
    board.value = createBoard();
    history.value = [];
    undoLeft.value = UNDO_LIMIT;
    outcome.value = null;
    winLine.value = null;
    lastMove.value = null;
    notice.value = '';
    playerColor.value = color;
    phase.value = 'playing';

    if (currentColor.value !== playerColor.value) void runAI();
  }

  function resign() {
    if (phase.value !== 'playing') return;
    finish('loss', '你已认输。');
  }

  /** 回到难度/先后手选择界面 */
  function openSetup() {
    moveToken++;
    thinking.value = false;
    phase.value = 'setup';
    board.value = createBoard();
    history.value = [];
    undoLeft.value = UNDO_LIMIT;
    outcome.value = null;
    winLine.value = null;
    lastMove.value = null;
    notice.value = '';
  }

  function prepare(diff: Difficulty) {
    difficulty.value = diff;
    notice.value = '';
    if (diff !== 'easy' && engineStatus.value === 'idle') {
      engineStatus.value = 'loading';
      engine.load().then(
        () => {
          if (engineStatus.value !== 'fallback') engineStatus.value = 'ready';
        },
        () => {
          engineStatus.value = 'fallback';
          notice.value = 'AI 引擎不可用，将使用内置棋力。';
        },
      );
    }
  }

  onBeforeUnmount(() => {
    moveToken++;
    engine.dispose();
  });

  return {
    board,
    history,
    playerColor,
    difficulty,
    phase,
    thinking,
    undoLeft,
    outcome,
    winLine,
    lastMove,
    notice,
    engineStatus,
    currentColor,
    myTurn,
    canUndo,
    stoned,
    place,
    undo,
    restart,
    resign,
    prepare,
    openSetup,
    BLACK,
    WHITE,
  };
}
