<template>
  <GameView :room-player="roomPlayer" :game="game" :player-status="playerStatus" :watcher-status="() => '观战中'">
    <div class="flex h-full min-h-0 w-full flex-col gap-2 p-2 md:p-3">
      <FitBox :ratio="1" class="min-h-0 w-full flex-1">
        <div class="relative h-full w-full rounded-2xl border border-base-content/10 bg-base-300/50 p-2 shadow-inner">
          <GoBoard
            :board="state?.board ?? emptyBoard"
            :last-move="lastMove"
            :interactive="isMyTurn && roomPlayer.role === PlayerRole.player"
            :my-color="myColor"
            @place="place"
          />


          <div v-if="!isPlaying && !state?.result" class="absolute inset-0 flex items-center justify-center rounded-2xl bg-base-100/60 text-sm text-base-content/60 backdrop-blur-sm">
            等待房主开始
          </div>

          <GameResultOverlay
            v-else-if="state?.result"
            :title="resultTitle"
            :detail="resultDetail"
            :tone="resultTone"
          >
            <RouterLink to="/" class="btn btn-xs btn-ghost">大厅</RouterLink>
          </GameResultOverlay>
        </div>
      </FitBox>

      <div class="flex flex-none flex-wrap items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-3.5 w-3.5 rounded-full border" :class="stoneClass(myColor)" />
            <span class="text-base-content/70">你执{{ myColor === 1 ? '黑' : '白' }}</span>
          </span>
          <span class="text-base-content/30">·</span>
          <span class="text-base-content/70">{{ opponentName }}</span>
          <span v-if="isPlaying" class="text-xs text-base-content/45">第 {{ state?.history?.length ?? 0 }} 手</span>
        </div>
        <span
          v-if="isPlaying"
          class="rounded-full px-2.5 py-1 text-xs"
          :class="isMyTurn ? 'bg-primary text-primary-content' : 'bg-base-content/10 text-base-content/70'"
        >
          {{ isMyTurn ? '轮到你落子' : '等待对手落子' }}
        </span>
      </div>

      <div class="flex flex-none flex-wrap items-center justify-between gap-2 text-xs text-base-content/60">
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-neutral" />黑 提{{ captures['1'] ?? 0 }}</span>
          <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border border-base-content/30 bg-base-100" />白 提{{ captures['2'] ?? 0 }}</span>
          <span>贴目 {{ state?.komi ?? 7.5 }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="isPlaying && state?.deadline" class="font-mono tabular-nums" :class="remaining <= 10 ? 'text-error' : ''">{{ formatTime(remaining) }}</span>
          <span v-if="state?.passes">连续停手 {{ state.passes }}</span>
          <span class="inline-flex items-center gap-1"><Icon icon="mdi:eye-outline" />{{ state?.watchers ?? 0 }}</span>
        </div>
      </div>

      <p v-if="!connected" class="flex-none text-xs text-warning">连接已断开，正在重连…</p>
    </div>

    <template #actions>
      <div v-if="roomPlayer.role === PlayerRole.player" class="flex flex-col gap-2">
        <button class="btn btn-sm" :disabled="!isPlaying" @click="pass">停一手</button>
        <button class="btn btn-sm btn-ghost" :disabled="!isPlaying" @click="resign">认输</button>
      </div>
    </template>
  </GameView>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PlayerRole, type Room, type RoomPlayer } from '@yige/engine/client';
import type { GameCore } from '@/core/game';
import GameView from '@/components/common/GameView.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import Icon from '@/components/common/Icon.vue';
import GoBoard from './GoBoard.vue';
import { useGoRoom } from './useGoRoom';
import { createBoard, type Stone } from '@games/go/rules';

const props = defineProps<{ roomPlayer: RoomPlayer & { room: Room }; game: GameCore }>();

const emptyBoard = createBoard(9);
const { state, myColor, isPlaying, isMyTurn, lastMove, captures, remaining, connected, resultTitle, resultDetail, place, pass, resign } = useGoRoom(
  props.game,
  props.roomPlayer,
);

const opponentName = computed(() => {
  const op = state.value?.players?.find((p: any) => p.id !== props.roomPlayer.id);
  return op?.name ?? '等待对手';
});

const resultTone = computed<'win' | 'lose' | 'draw' | 'interrupted'>(() => {
  const result = state.value?.result;
  if (!result) return 'draw';
  if (result.reason === 'interrupted') return 'interrupted';
  if (!result.winnerId) return 'draw';
  return result.winnerId === props.roomPlayer.id ? 'win' : 'lose';
});

function stoneClass(color: Stone) {
  if (color === 1) return 'bg-neutral';
  if (color === 2) return 'bg-base-100 border border-base-content/30';
  return 'bg-transparent border border-dashed border-base-content/30';
}
function formatTime(seconds: number) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
function playerStatus(player: RoomPlayer) {
  if (!isPlaying.value) return player.isReady ? '已准备' : '未准备';
  return player.id === state.value?.currentId ? '落子中' : '等待中';
}
const emit = defineEmits<{ (e: 'loaded'): void }>();
emit('loaded');
</script>
