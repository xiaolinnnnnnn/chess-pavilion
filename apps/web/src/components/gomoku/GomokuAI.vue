<template>
  <section class="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 md:gap-5 md:p-5 lg:h-full lg:min-h-0 lg:flex-row">
      <div class="flex min-h-0 w-full flex-1 items-stretch gap-3">
        <div v-if="phase !== 'setup'" class="flex flex-none flex-col justify-center gap-2">
          <button class="btn btn-sm" :disabled="!canUndo" @click="undo">悔棋 <span class="ml-1 text-xs opacity-60">{{ undoLeft }}/3</span></button>
          <button class="btn btn-sm" :disabled="phase !== 'playing'" @click="resign">认输</button>
          <button class="btn btn-sm btn-soft" @click="restart(playerColor)">重开</button>
          <button class="btn btn-sm btn-ghost" @click="openSetup">换难度</button>
        </div>
      <div class="flex min-h-0 flex-1 flex-col items-center gap-3">
        <FitBox :ratio="1" class="w-full max-lg:aspect-square max-lg:max-h-[calc(100dvh-16rem)] lg:min-h-0 lg:flex-1">
          <div class="relative h-full w-full rounded-2xl border border-base-content/10 bg-base-300/50 p-2 shadow-inner">
            <GomokuBoard
              :board="board"
              :last-move="lastMove"
              :win-line="winLine"
              :interactive="phase === 'playing' && myTurn"
              :my-color="playerColor"
              @place="place"
            />

            <GameResultOverlay
              v-if="outcome"
              :title="outcome === 'win' ? '胜利' : outcome === 'loss' ? RESULT_TEXT.lose : '平局'"
              :detail="notice"
              :tone="outcome === 'win' ? 'win' : outcome === 'loss' ? 'lose' : 'draw'"
            >
              <button class="btn btn-xs btn-primary" @click="restart(playerColor)">再来一局</button>
              <button class="btn btn-xs btn-ghost" @click="openSetup">换难度</button>
            </GameResultOverlay>
          </div>
        </FitBox>

          <div class="mt-3 flex w-full flex-wrap items-center justify-between gap-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3.5 w-3.5 rounded-full border" :class="stoneClass(playerColor)" />
                <span class="text-base-content/70">你执{{ playerColor === 1 ? '黑' : '白' }}</span>
              </span>
              <span class="text-base-content/30">·</span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3.5 w-3.5 rounded-full border" :class="stoneClass(playerColor === 1 ? 2 : 1)" />
                <span class="text-base-content/70">AI（{{ difficultyText }}）</span>
              </span>
              <span v-if="phase !== 'setup'" class="text-xs text-base-content/45">第 {{ stoned }} 手</span>
            </div>
            <span v-if="phase === 'playing'" class="rounded-full px-2.5 py-1 text-xs"
              :class="thinking ? 'bg-base-content/10 text-base-content/70' : 'bg-primary text-primary-content'">
              {{ thinking ? 'AI 思考中…' : myTurn ? '轮到你落子' : '等待 AI' }}
            </span>
          </div>
      </div>
      </div>

      <aside class="flex w-full flex-none flex-col gap-4 lg:h-full lg:w-80 lg:overflow-y-auto xl:w-96">
        <div class="panel p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold">五子棋 · 人机对战</h2>
            <button class="btn btn-ghost btn-xs" @click="handleExit">
              <Icon icon="mdi:logout" class="text-sm" />
              退出
            </button>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span class="rounded-full px-2 py-0.5 text-[11px] font-medium bg-base-content/10 text-base-content/60">
              {{ difficultyText }}难度
            </span>
          </div>

          <template v-if="phase === 'setup'">

            <div class="mt-4">
              <p class="text-xs font-medium tracking-wide text-base-content/50">执子</p>
              <div class="mt-2 join grid grid-cols-2">
                <button
                  class="btn btn-sm join-item"
                  :class="startColor === 1 ? 'btn-primary' : 'btn-ghost bg-base-200'"
                  @click="startColor = 1"
                >
                  执黑先行
                </button>
                <button
                  class="btn btn-sm join-item"
                  :class="startColor === 2 ? 'btn-primary' : 'btn-ghost bg-base-200'"
                  @click="startColor = 2"
                >
                  执白后手
                </button>
              </div>
            </div>

            <div class="mt-4">
              <p class="text-xs font-medium tracking-wide text-base-content/50">难度</p>
              <div class="mt-2 join grid grid-cols-3">
                <button
                  v-for="item in difficulties"
                  :key="item.value"
                  class="btn btn-sm join-item"
                  :class="difficulty === item.value ? 'btn-primary' : 'btn-ghost bg-base-200'"
                  @click="difficulty = item.value"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <button class="btn btn-primary btn-block mt-5" @click="start">开始对局</button>
          </template>

          <template v-else>
            <p class="mt-3 text-xs leading-relaxed text-base-content/50">
              对局进行中，悔棋、认输等操作位于棋盘左下方。
            </p>

            <p v-if="notice && !outcome" class="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {{ notice }}
            </p>
          </template>
        </div>

        <div class="rounded-2xl border border-base-content/10 bg-base-100 p-4 text-xs text-base-content/60">
          <p class="font-medium text-base-content/70">规则</p>
          <ul class="mt-2 space-y-1.5">
            <li>· 黑棋先行，双方轮流在交叉点落子。</li>
            <li>· 横、竖、斜任意方向连续五子即胜，满盘为平局。</li>
            <li>· 悔棋会撤销你与 AI 最近各一手，AI 未落子时只撤销你的一手。</li>
            <li>· 人机对战不计入联网积分与战绩。</li>
          </ul>

        </div>
      </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import GomokuBoard from '@/components/gomoku/GomokuBoard.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import { useGomokuAI } from '@/components/gomoku/ai/useGomokuAI';
import type { Difficulty } from '@/components/gomoku/ai/heuristic';
import { confirm } from '@/components/msgbox';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';

const router = useRouter();
const gameStore = useGameStore();

const {
  board,
  playerColor,
  difficulty,
  phase,
  thinking,
  undoLeft,
  outcome,
  winLine,
  lastMove,
  notice,
  myTurn,
  canUndo,
  stoned,
  place,
  undo,
  restart,
  resign,
  prepare,
  openSetup,
} = useGomokuAI();

const startColor = ref(1);

const difficulties: Array<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'normal', label: '普通' },
  { value: 'hard', label: '困难' },
];

const difficultyText = computed(() => difficulties.find((item) => item.value === difficulty.value)?.label ?? '');

function start() {
  prepare(difficulty.value);
  restart(startColor.value as 1 | 2);
}

async function handleExit() {
  const inGame = phase.value === 'playing' && !outcome.value;
  const ok = await confirm(inGame ? '对局进行中，退出将丢弃当前进度。' : '确定退出当前对战吗？', '退出对战', { confirmText: '退出对战', danger: inGame });
  if (!ok) return;
  router.push('/');
}

function stoneClass(color: number) {
  if (color === 1) return 'bg-neutral border-white/20 shadow-sm';
  if (color === 2) return 'bg-base-100 border-base-content/30 shadow-sm';
  return 'bg-transparent border-dashed border-base-content/30';
}

// 人机对局结束后上报战绩（仅登录用户，不积分），供“我的对局 · 人机”筛选
const aiRecorded = ref(false);
watch(outcome, (v) => {
  if (!v) {
    aiRecorded.value = false;
    return;
  }
  if (aiRecorded.value || gameStore.player?.isVisitor) return;
  aiRecorded.value = true;
  api.recordAiGame({ game: 'gomoku', result: v === 'win' ? 'win' : v === 'loss' ? 'loss' : 'draw', moves: stoned.value }).catch(() => {});
});
</script>
