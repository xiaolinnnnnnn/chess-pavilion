<template>
  <section class="flex w-full flex-col items-center gap-2 p-2 py-3">
    <div class="w-full max-w-[min(100%,440px)]">
      <div class="relative rounded-xl border border-base-content/10 bg-base-300/50 p-1.5 shadow-inner">
        <GomokuBoard
          :board="state?.board ?? emptyBoard"
          :last-move="lastMove"
          :win-line="winLine"
          :interactive="isMyTurn && roomPlayer.role === PlayerRole.player"
          :my-color="myColor"
          @place="place"
        />
        <div
          v-if="!isPlaying && !state?.result"
          class="absolute inset-0 flex items-center justify-center rounded-xl bg-base-100/70 text-xs text-base-content/60 backdrop-blur-sm"
        >
          等待开始
        </div>
        <div
          v-else-if="state?.result"
          class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-base-100/70 backdrop-blur-sm"
        >
          <span class="text-lg font-semibold">{{ resultTitle }}</span>
          <span class="px-3 text-center text-[11px] text-base-content/60">{{ resultDetail }}</span>
        </div>
      </div>

      <div class="mt-2 flex items-center justify-between text-xs">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full border" :class="stoneClass(myColor)" />
          <span class="text-base-content/60">{{ myColor === 1 ? '执黑' : myColor === 2 ? '执白' : '观战' }}</span>
        </span>
        <span v-if="isPlaying" class="rounded-full px-2 py-0.5"
          :class="isMyTurn ? 'bg-primary text-primary-content' : 'bg-base-content/10 text-base-content/60'">
          {{ isMyTurn ? '你的回合' : '等待对手' }}
        </span>
        <span v-if="showTimer" class="font-mono tabular-nums text-base-content/60">{{ formatTime(remaining) }}</span>
      </div>

      <div v-if="roomPlayer.role === PlayerRole.player" class="mt-2 grid grid-cols-3 gap-1.5">
        <button class="btn btn-xs" :disabled="!isMyTurn || undoLeft <= 0 || !!pending" @click="requestUndo">
          悔棋 {{ undoLeft }}
        </button>
        <button class="btn btn-xs" :disabled="!isPlaying || drawLeft <= 0 || !!pending" @click="requestDraw">
          求和
        </button>
        <button class="btn btn-xs btn-ghost" :disabled="!isPlaying" @click="resign">认输</button>
      </div>

      <div v-if="incoming" class="mt-2 flex items-center justify-between rounded-lg bg-warning/10 px-2 py-1 text-[11px] text-warning">
        <span>{{ incoming.from }} 请求{{ incoming.label }}</span>
        <span class="flex gap-1">
          <button class="btn btn-xs btn-primary" @click="reply(true)">同意</button>
          <button class="btn btn-xs btn-ghost" @click="reply(false)">拒绝</button>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { PlayerRole, type Room, type RoomPlayer } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import GomokuBoard from './GomokuBoard.vue';
import { useGomoku } from './useGomoku';
import { createBoard, type Stone } from '@games/gomoku/rules';

const props = defineProps<{
  roomPlayer: RoomPlayer & { room: Room };
  game: GameCore;
}>();

const emptyBoard = createBoard();

const {
  state,
  myColor,
  isPlaying,
  isMyTurn,
  pending,
  undoLeft,
  drawLeft,
  lastMove,
  winLine,
  remaining,
  resultTitle,
  resultDetail,
  incoming,
  place,
  requestUndo,
  requestDraw,
  resign,
  reply,
} = useGomoku(props.game, props.roomPlayer);

const showTimer = computed(() => isPlaying.value && (state.value?.settings.countDownWay ?? 0) > 0);

function stoneClass(color: Stone) {
  if (color === 1) return 'bg-neutral border-white/20';
  if (color === 2) return 'bg-base-100 border-base-content/30';
  return 'bg-transparent border-dashed border-base-content/30';
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const emit = defineEmits<{ (e: 'loaded'): void }>();
onMounted(() => emit('loaded'));
</script>
