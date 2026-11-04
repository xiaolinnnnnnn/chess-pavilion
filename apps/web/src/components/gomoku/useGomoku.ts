import { computed, onBeforeUnmount, ref } from 'vue';
import type { Room, RoomPlayer } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import { useGameEvents } from '@/hook/useGameEvents';
import type { Coord, Stone } from '@games/gomoku/rules';
import type { GomokuPending, GomokuState } from '@games/gomoku/state';
import msg from '@/components/msg';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import { INTERACTION_LABEL, clearIncoming, clearOutgoing, incoming, setIncoming, setOutgoing } from '@/stores/interaction';

const REASON_TEXT: Record<string, string> = {
  five: '五子连珠',
  full: '棋盘已满',
  'agreed-draw': '双方同意和棋',
  resign: '认输',
  timeout: '落子超时',
  disconnect: '断线判负',
  interrupted: '对局中断',
};

/** 联网对局的状态订阅：前端只渲染服务端下发的权威状态 */
export function useGomoku(game: GameCore, roomPlayer: RoomPlayer & { room: Room }) {
  const state = ref<GomokuState | null>(null);
  const remaining = ref(0);
  const connected = ref(true);

  let ticker: number | null = null;

  const roomId = roomPlayer.room.id;
  const myId = roomPlayer.id;

  const myColor = computed<Stone>(() => (state.value?.colors?.[myId] ?? 0) as Stone);
  const opponent = computed(() => state.value?.players.find((player) => player.id !== myId) ?? null);
  const isPlaying = computed(() => state.value?.phase === 'playing');
  const isMyTurn = computed(() => isPlaying.value && state.value?.currentId === myId && !state.value?.pending);
  const pending = computed(() => state.value?.pending ?? null);
  const pendingByMe = computed(() => Boolean(pending.value && pending.value.requesterId === myId));
  const undoLeft = computed(() => state.value?.undoLeft?.[myId] ?? 0);
  const drawLeft = computed(() => state.value?.drawLeft?.[myId] ?? 0);
  const watchers = computed(() => state.value?.watchers ?? roomPlayer.room.players.filter((p) => p.role === 'watcher').length);
  const lastMove = computed<Coord | null>(() => {
    const history = state.value?.history ?? [];
    const last = history[history.length - 1];
    return last ? { row: last.row, col: last.col } : null;
  });
  const winLine = computed(() => state.value?.result?.line ?? null);

  const resultTitle = computed(() => {
    const result = state.value?.result;
    if (!result) return '';
    if (result.reason === 'interrupted') return RESULT_TEXT.interrupted;
    if (!result.winnerId) return RESULT_TEXT.draw;
    return result.winnerId === myId ? RESULT_TEXT.win : RESULT_TEXT.lose;
  });

  const resultTone = computed<'win' | 'lose' | 'draw' | 'interrupted'>(() => {
    const result = state.value?.result;
    if (!result) return 'draw';
    if (result.reason === 'interrupted') return 'interrupted';
    if (!result.winnerId) return 'draw';
    return result.winnerId === myId ? 'win' : 'lose';
  });

  const resultDetail = computed(() => {
    const result = state.value?.result;
    if (!result) return '';
    const base = REASON_TEXT[result.reason] ?? result.reason;
    if (result.reason === 'interrupted') return `${result.detail ?? '房间已失效'}，本局作废不结算积分。`;
    return result.detail || base;
  });

  function syncTicker(deadline: number | null | undefined) {
    if (ticker) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (!deadline) {
      remaining.value = 0;
      return;
    }
    const update = () => {
      remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    };
    update();
    ticker = window.setInterval(update, 250);
  }

  function apply(next: GomokuState | null | undefined) {
    if (!next) return;
    connected.value = true;
    state.value = next;
    syncTicker(next.deadline);
    // 请求本身可能先于广播状态到达；只有“已无请求”或“自己发起的请求”才清空聊天气泡
    if (incoming.value && (!next.pending || next.pending.requesterId === myId)) clearIncoming();
    if (next.pending && next.pending.requesterId === myId) setOutgoing(INTERACTION_LABEL[next.pending.kind] ?? '');
    else clearOutgoing();
  }

  function onCommand(cmd: { type: string; data: any }) {
    if (roomPlayer.room.attrs?.type !== 'gomoku') return;
    switch (cmd.type) {
      case 'gomoku:state':
        apply(cmd.data);
        break;
      case 'status':
        apply(cmd.data?.gomoku);
        break;
      case 'gomoku:request':
        if (roomPlayer.role === 'player' && cmd.data?.requester?.id !== myId) {
          const kind = cmd.data.kind as GomokuPending['kind'];
          setIncoming({
            kind,
            label: INTERACTION_LABEL[kind] ?? '互动',
            from: cmd.data.requester?.name ?? '对手',
            expiresAt: cmd.data.expiresAt ?? 0,
            reply: (agree) => send('reply', { kind, agree }),
          });
        }
        break;
      case 'gomoku:notice':
        msg.error(cmd.data?.message ?? '操作未生效');
        break;
      case 'countdown':
        if (cmd.data?.name === 'turn') syncTicker(cmd.data.end);
        break;
      case 'end':
        syncTicker(null);
        break;
    }
  }

  useGameEvents(game, {
    'player.command': onCommand,
    'room.command': onCommand,
  });

  const socket = game as unknown as {
    on: (event: string, handler: (...args: any[]) => void) => void;
  };
  socket.on('sys.close', () => (connected.value = false));
  socket.on('sys.ready', () => (connected.value = true));

  function send(type: string, data?: unknown) {
    game.command(roomId, { type, data });
  }

  const place = (coord: Coord) => {
    if (!isMyTurn.value) return;
    send('place', coord);
  };
  const requestUndo = () => {
    if (isPlaying.value && undoLeft.value > 0) send('undo');
  };
  const requestDraw = () => {
    if (isPlaying.value && drawLeft.value > 0) send('draw');
  };
  const requestRestart = () => send('restart');
  const resign = () => send('resign');

  function reply(agree: boolean) {
    const request = incoming.value;
    if (!request) return;
    send('reply', { kind: request.kind, agree });
    clearIncoming();
  }

  onBeforeUnmount(() => {
    if (ticker) window.clearInterval(ticker);
    clearIncoming();
    clearOutgoing();
  });

  return {
    state,
    myColor,
    opponent,
    isPlaying,
    isMyTurn,
    pending,
    pendingByMe,
    undoLeft,
    drawLeft,
    watchers,
    lastMove,
    winLine,
    remaining,
    connected,
    resultTitle,
    resultDetail,
    resultTone,
    incoming,
    place,
    requestUndo,
    requestDraw,
    requestRestart,
    resign,
    reply,
  };
}
