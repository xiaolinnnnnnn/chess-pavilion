import { computed, onBeforeUnmount, ref } from 'vue';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import type { Room, RoomPlayer } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import { useGameEvents } from '@/hook/useGameEvents';
import msg from '@/components/msg';
import type { Point, Stone } from '@games/go/rules';

interface GoPlayer {
  id: string;
  name: string;
  color: Stone;
}

interface GoState {
  phase: 'waiting' | 'playing' | 'finished';
  size: number;
  komi: number;
  board: Stone[][];
  history: Array<Point & { color: Stone; pass?: boolean }>;
  currentId: string | null;
  colors: Record<string, Stone>;
  players: GoPlayer[];
  captures: Record<string, number>;
  passes: number;
  koPoint: Point | null;
  result: { winnerId: string | null; reason: string; detail: string; score?: { black: number; white: number } } | null;
  deadline: number | null;
  watchers: number;
}

export function useGoRoom(game: GameCore, roomPlayer: RoomPlayer & { room: Room }) {
  const state = ref<GoState | null>(null);
  const remaining = ref(0);
  const connected = ref(true);
  const roomId = roomPlayer.room.id;
  const myId = roomPlayer.id;
  let ticker: number | null = null;

  const myColor = computed<Stone>(() => state.value?.colors?.[myId] ?? 0);
  const opponent = computed(() => state.value?.players.find((item) => item.id !== myId) ?? null);
  const isPlaying = computed(() => state.value?.phase === 'playing');
  const isMyTurn = computed(() => isPlaying.value && state.value?.currentId === myId);
  const lastMove = computed<Point | null>(() => {
    const history = state.value?.history ?? [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].pass) return history[i];
    }
    return null;
  });
  const captures = computed(() => state.value?.captures ?? {});
  const resultTitle = computed(() => {
    const result = state.value?.result;
    if (!result) return '';
    if (result.reason === 'interrupted') return RESULT_TEXT.goInterrupted;
    if (!result.winnerId) return RESULT_TEXT.draw;
    return result.winnerId === myId ? RESULT_TEXT.win : RESULT_TEXT.lose;
  });
  const resultDetail = computed(() => state.value?.result?.detail ?? '');

  function syncTicker(deadline: number | null | undefined) {
    if (ticker) window.clearInterval(ticker);
    ticker = null;
    if (!deadline) {
      remaining.value = 0;
      return;
    }
    const update = () => (remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    ticker = window.setInterval(update, 250);
  }

  function apply(next: GoState | null | undefined) {
    if (!next) return;
    connected.value = true;
    state.value = next;
    syncTicker(next.deadline);
  }

  function onCommand(cmd: { type: string; data: any }) {
    if (roomPlayer.room.attrs?.type !== 'go') return;
    switch (cmd.type) {
      case 'go:state':
        apply(cmd.data);
        break;
      case 'status':
        apply(cmd.data?.go);
        break;
      case 'go:notice':
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

  useGameEvents(game, { 'player.command': onCommand, 'room.command': onCommand });

  const socket = game as unknown as { on: (event: string, handler: (...args: any[]) => void) => void };
  socket.on('sys.close', () => (connected.value = false));
  socket.on('sys.ready', () => (connected.value = true));

  const send = (type: string, data?: unknown) => game.command(roomId, { type, data });
  const place = (point: Point) => {
    if (isMyTurn.value) send('place', point);
  };
  const pass = () => {
    if (isPlaying.value) send('pass');
  };
  const resign = () => {
    if (isPlaying.value) send('resign');
  };

  onBeforeUnmount(() => {
    if (ticker) window.clearInterval(ticker);
  });

  return {
    state,
    myColor,
    opponent,
    isPlaying,
    isMyTurn,
    lastMove,
    captures,
    remaining,
    connected,
    resultTitle,
    resultDetail,
    place,
    pass,
    resign,
  };
}
