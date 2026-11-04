<template>
  <GameView
    :room-player="roomPlayer"
    :game="game"
    :player-status="playerStatus"
    :watcher-status="() => '观战中'"
    :can-chat="true"
  >
    <div class="flex h-full min-h-0 w-full flex-col gap-2 p-2 md:p-3">
      <FitBox :ratio="1" class="min-h-0 w-full flex-1">
        <div class="relative h-full w-full rounded-2xl border border-base-content/10 bg-base-300/50 p-2 shadow-inner">
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
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-base-100/70 backdrop-blur-sm"
          >
            <Icon icon="mdi:chess-knight" class="text-4xl text-base-content/30" />
            <p class="text-sm text-base-content/70">等待房主开始对局</p>
          </div>

          <GameResultOverlay
            v-else-if="state?.result"
            :title="resultTitle"
            :detail="resultDetail"
            :tone="resultTone"
          >
            <button class="btn btn-xs btn-primary" :disabled="!!pending" @click="requestRestart">再来一局</button>
            <button class="btn btn-xs btn-ghost" @click="$router.push('/')">大厅</button>
          </GameResultOverlay>
        </div>
      </FitBox>

      <div class="flex flex-none flex-wrap items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <template v-if="state?.players.length">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-3.5 rounded-full border" :class="stoneClass(myColor)" />
              <span class="text-base-content/70">你{{ colorText(myColor) }}</span>
            </span>
            <span class="text-base-content/30">·</span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-3.5 rounded-full border" :class="stoneClass(opponent?.color)" />
              <span class="truncate text-base-content/70">{{ opponent?.name ?? '等待对手' }}</span>
            </span>
          </template>
          <span v-else class="text-base-content/50">等待玩家入座</span>
          <span v-if="isPlaying" class="text-xs text-base-content/45">第 {{ state?.history?.length ?? 0 }} 手</span>
        </div>

        <div class="flex items-center gap-2">
          <span
            v-if="isPlaying"
            class="rounded-full px-2.5 py-1 text-xs"
            :class="isMyTurn ? 'bg-primary text-primary-content' : 'bg-base-content/10 text-base-content/70'"
          >
            {{ isMyTurn ? '轮到你落子' : thinkingText }}
          </span>
          <span
            v-if="showTimer"
            class="rounded-full px-2 py-1 font-mono text-xs tabular-nums"
            :class="remaining <= 10 ? 'bg-error/15 text-error' : 'bg-base-content/10 text-base-content/70'"
          >
            {{ formatTime(remaining) }}
          </span>
          <span class="inline-flex items-center gap-1 text-xs text-base-content/50">
            <Icon icon="mdi:eye-outline" />
            {{ watchers }}
          </span>
        </div>
      </div>

      <p v-if="!connected" class="flex-none text-xs text-warning">
        连接已断开，正在自动重连…60 秒内重连可恢复对局。
      </p>

    </div>

    <template #actions>
      <div v-if="roomPlayer.role === PlayerRole.player" class="flex flex-col gap-2">
        <button class="btn btn-sm" :disabled="!isMyTurn || undoLeft <= 0 || !!pending" @click="requestUndo">
          悔棋 <span class="ml-1 text-xs opacity-60">{{ undoLeft }}/3</span>
        </button>
        <button class="btn btn-sm" :disabled="!isPlaying || drawLeft <= 0 || !!pending" @click="requestDraw">
          求和 <span class="ml-1 text-xs opacity-60">{{ drawLeft }}/1</span>
        </button>
        <button class="btn btn-sm btn-ghost" :disabled="!isPlaying" @click="resign">认输</button>
        <button class="btn btn-sm btn-soft" :disabled="!!pending" @click="requestRestart">重来</button>
      </div>
    </template>
  </GameView>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { PlayerRole, type Room, type RoomPlayer } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import GameView from '@/components/common/GameView.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import Icon from '@/components/common/Icon.vue';
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
  opponent,
  isPlaying,
  isMyTurn,
  pending,
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
  place,
  requestUndo,
  requestDraw,
  requestRestart,
  resign,
} = useGomoku(props.game, props.roomPlayer);

const pendingLabel = computed(() => {
  switch (pending.value?.kind) {
    case 'undo':
      return '悔棋';
    case 'draw':
      return '和棋';
    case 'restart':
      return '重来';
    default:
      return '';
  }
});

const showTimer = computed(() => isPlaying.value && (state.value?.settings.countDownWay ?? 0) > 0);

const thinkingText = computed(() => {
  if (!isPlaying.value) return '等待开始';
  if (pending.value) return `等待${pendingLabel.value}回应`;
  return `${state.value?.players.find((p) => p.id === state.value?.currentId)?.name ?? '对手'} 思考中`;
});

function stoneClass(color?: Stone) {
  if (color === 1) return 'bg-neutral border-white/20 shadow-sm';
  if (color === 2) return 'bg-base-100 border-base-content/30 shadow-sm';
  return 'bg-transparent border-dashed border-base-content/30';
}

function colorText(color: Stone) {
  if (color === 1) return '执黑（先手）';
  if (color === 2) return '执白（后手）';
  return '';
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function playerStatus(player: RoomPlayer) {
  if (!isPlaying.value) return player.isReady ? '已准备' : '未准备';
  const color = state.value?.colors?.[player.id];
  if (player.id === state.value?.currentId) return '落子中';
  return color ? `执${color === 1 ? '黑' : '白'}` : '等待中';
}

const emit = defineEmits<{ (e: 'loaded'): void }>();
onMounted(() => emit('loaded'));
</script>
