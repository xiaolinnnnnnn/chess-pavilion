<template>
  <section class="flex flex-col gap-4 md:h-full md:flex-row">
    <div class="flex flex-1 flex-col items-center justify-start gap-3 p-3 md:justify-center md:p-4">
      <div class="w-full max-w-[min(100%,560px)]">
        <div class="rounded-2xl border border-base-content/10 bg-base-300/50 p-2 shadow-inner">
          <GomokuBoard
            :board="currentBoard"
            :last-move="currentMove"
            :win-line="showFinalLine ? (result?.line ?? null) : null"
            :interactive="false"
          />
        </div>
        <div class="mt-3 flex items-center justify-between text-sm">
          <span class="text-base-content/70">
            {{ roomName || '对局回放' }}
            <span class="ml-2 text-xs text-base-content/40">{{ players.map((p) => p.name).join(' vs ') }}</span>
          </span>
          <span v-if="showFinalLine && result" class="rounded-full px-2 py-0.5 text-xs" :class="result.winnerId ? 'bg-primary/15 text-primary' : 'bg-base-content/10 text-base-content/60'">
            {{ result.winnerId ? `${winnerName} 获胜` : '平局' }}
          </span>
        </div>
      </div>
    </div>

    <aside class="flex h-[45vh] w-full flex-none flex-col border-t border-base-content/20 md:h-full md:w-80 md:border-t-0 md:border-l md:pl-4">
      <h3 class="flex items-center gap-2 p-2 text-sm font-medium text-base-content/70">
        <Icon icon="mdi:history" />
        对局记录
        <span class="ml-auto font-mono text-xs text-base-content/40">{{ step }} / {{ history.length }}</span>
      </h3>

      <div class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        <button
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-base-200"
          :class="{ 'bg-primary text-primary-content hover:bg-primary': step === 0 }"
          @click="step = 0"
        >
          <span>开局</span>
          <span class="font-mono text-xs opacity-60">00:00</span>
        </button>
        <button
          v-for="(move, index) in history"
          :key="index"
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-base-200"
          :class="{ 'bg-primary text-primary-content hover:bg-primary': step === index + 1 }"
          @click="step = index + 1"
        >
          <span class="flex items-center gap-2">
            <span class="w-5 text-right font-mono text-xs opacity-60">{{ index + 1 }}</span>
            <span class="h-3 w-3 rounded-full border" :class="move.color === 1 ? 'bg-neutral border-white/20' : 'bg-base-100 border-base-content/30'" />
            <span class="font-mono">{{ formatCoord(move) }}</span>
          </span>
          <span class="font-mono text-xs opacity-60">{{ formatTime(move.time) }}</span>
        </button>
      </div>

      <div class="flex items-center justify-between gap-2 py-2">
        <button class="btn btn-sm" :disabled="step === 0" @click="step--">
          <Icon icon="mdi:chevron-left" />
        </button>
        <button class="btn btn-sm btn-circle btn-ghost" @click="toggle">
          <Icon :icon="playing ? 'mdi:pause' : 'mdi:play'" class="text-xl" />
        </button>
        <button class="btn btn-sm" :disabled="step >= history.length" @click="step++">
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import GomokuBoard from './GomokuBoard.vue';
import Icon from '@/components/common/Icon.vue';
import { formatCoord, rebuildBoard, type Move } from '@games/gomoku/rules';
import type { GomokuResult } from '@games/gomoku/state';

const props = defineProps<{
  history?: Array<Move & { time?: number }>;
  players?: Array<{ id?: string; name: string; color: number }>;
  result?: GomokuResult | null;
  beginTime?: number;
  roomName?: string;
}>();

const history = computed(() => props.history ?? []);
const players = computed(() => props.players ?? []);
const result = computed(() => props.result ?? null);

const step = ref(0);
const playing = ref(false);
let timer: number | null = null;

const currentBoard = computed(() => rebuildBoard(history.value.slice(0, step.value)));
const currentMove = computed(() => {
  const move = history.value[step.value - 1];
  return move ? { row: move.row, col: move.col } : null;
});
const showFinalLine = computed(() => step.value === history.value.length && history.value.length > 0);
const winnerName = computed(() => {
  const winner = result.value?.winnerId;
  return props.players?.find((p) => p.id === winner)?.name ?? '胜方';
});

function toggle() {
  if (playing.value) {
    stop();
    return;
  }
  if (step.value >= history.value.length) step.value = 0;
  playing.value = true;
  timer = window.setInterval(() => {
    if (step.value >= history.value.length) {
      stop();
      return;
    }
    step.value++;
  }, 500);
}

function stop() {
  playing.value = false;
  if (timer) window.clearInterval(timer);
  timer = null;
}

function formatTime(ms = 0) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

onBeforeUnmount(stop);
</script>
