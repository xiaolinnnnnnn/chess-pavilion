<template>
  <GameView :room-player="roomPlayer" :game="game" :player-status="getPlayerStatus" :watcher-status="() => '观战中'">
    <div class="flex h-full min-h-0 w-full flex-col gap-2 p-2 md:p-3">
      <FitBox :ratio="400 / 445" class="min-h-0 w-full flex-1">
        <div class="relative h-full w-full">
          <XiangqiBoard
            fluid
            :board="board ?? emptyBoard"
            :selected="selected"
            :last-move="lastMove"
            :targets="[]"
            :rotate="rotateBoard"
            :interactive="isPlaying && roomPlayer.role === PlayerRole.player && currentPlayer?.id === roomPlayer.id"
            @cell="(x, y) => trySelectOrMove(x, y)"
          />

          <GameResultOverlay v-if="result" :title="resultTitle" :detail="result.detail" :tone="resultTone">
            <button class="btn btn-xs btn-ghost" @click="$router.push('/')">大厅</button>
          </GameResultOverlay>
        </div>
      </FitBox>

      <div class="flex flex-none flex-wrap items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-3.5 w-3.5 rounded-full bg-red-600" />你{{ rotateBoard ? '执绿' : '执红' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="isPlaying"
            class="rounded-full px-2.5 py-1 text-xs"
            :class="currentPlayer?.id === roomPlayer.id ? 'bg-primary text-primary-content' : 'bg-base-content/10 text-base-content/70'"
          >
            {{ currentPlayer?.id === roomPlayer.id ? '轮到你走棋' : `${currentPlayer?.name ?? '对手'} 思考中` }}
          </span>
          <div v-if="isPlaying" class="flex items-center gap-2 text-xs text-base-content/60">
            倒计时 <span class="font-mono tabular-nums">{{ countdown }}s</span>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <div v-if="isPlaying && roomPlayer.role === PlayerRole.player" class="flex flex-col gap-2">
        <button class="btn btn-sm" :disabled="currentPlayer?.id !== roomPlayer.id" @click="requestDraw">请求和棋</button>
        <button class="btn btn-sm btn-ghost" :disabled="currentPlayer?.id !== roomPlayer.id" @click="requestLose">认输</button>
      </div>
    </template>
  </GameView>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { PlayerRole, type RoomPlayer, type Room } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import GameView from '@/components/common/GameView.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import XiangqiBoard from './XiangqiBoard.vue';
import { useXiangqi } from './useXiangqi';

const props = defineProps<{ roomPlayer: RoomPlayer & { room: Room }, game: GameCore }>();

const emptyBoard = Array(10).fill(0).map(() => Array(9).fill(''));

const {
  isPlaying,
  gameStatus,
  currentPlayer,
  board,
  selected,
  lastMove,
  countdown,
  result,
  trySelectOrMove,
  requestDraw,
  requestLose,
} = useXiangqi(props.game, props.roomPlayer);

const resultTitle = computed(() => {
  if (!result.value) return '';
  if (!result.value.winnerId) return RESULT_TEXT.draw;
  return result.value.winnerId === props.roomPlayer.id ? RESULT_TEXT.win : RESULT_TEXT.lose;
});

const resultTone = computed<'win' | 'lose' | 'draw'>(() => {
  if (!result.value || !result.value.winnerId) return 'draw';
  return result.value.winnerId === props.roomPlayer.id ? 'win' : 'lose';
});

const rotateBoard = computed(() => {
  if (props.roomPlayer.role !== 'player') return false;
  return (props.roomPlayer as any).attributes?.side === 'green';
});

function getPlayerStatus(p: RoomPlayer) {
  if (p.role !== 'player') return '观战中';
  if (!p.isReady) return '未准备';
  if (gameStatus.value === 'waiting') return '已准备';
  if (currentPlayer.value?.id === p.id) return '思考中';
  if (gameStatus.value === 'playing') return '等待中';
  return '已准备';
}

const emit = defineEmits<{ (e: 'loaded'): void }>();
onMounted(() => emit('loaded'));
</script>
