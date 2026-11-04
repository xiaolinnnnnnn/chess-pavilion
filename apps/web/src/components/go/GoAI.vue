<template>
  <section class="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 md:gap-5 md:p-5 lg:h-full lg:min-h-0 lg:flex-row">
    <div class="flex min-h-0 w-full flex-1 items-stretch gap-3">
      <div v-if="phase !== 'setup'" class="flex flex-none flex-col justify-center gap-2">
        <button class="btn btn-sm" :disabled="!myTurn || phase !== 'playing'" @click="pass">停一手</button>
        <button class="btn btn-sm" :disabled="phase !== 'playing'" @click="resign">认输</button>
        <button class="btn btn-sm btn-soft" @click="reset(size, playerColor)">重开</button>
        <button class="btn btn-sm btn-ghost" @click="openSetup">换设置</button>
      </div>
    <div class="flex min-h-0 flex-1 flex-col items-center gap-3">
        <FitBox :ratio="1" class="w-full max-lg:aspect-square max-lg:max-h-[calc(100dvh-16rem)] lg:min-h-0 lg:flex-1">
        <div class="relative h-full w-full rounded-2xl border border-base-content/10 bg-base-300/50 p-2 shadow-inner">
          <GoBoard
            :board="board"
            :last-move="lastMove"
            :interactive="phase === 'playing' && myTurn"
            :my-color="playerColor"
            @place="place"
          />

          <GameResultOverlay
            v-if="result"
            :title="result.outcome === 'win' ? '胜利' : result.outcome === 'loss' ? RESULT_TEXT.lose : '平局'"
            :detail="result.detail"
            :tone="result.outcome === 'win' ? 'win' : result.outcome === 'loss' ? 'lose' : 'draw'"
          >
            <button class="btn btn-xs btn-primary" @click="reset(size, playerColor)">再来一局</button>
            <button class="btn btn-xs btn-ghost" @click="openSetup">换设置</button>
          </GameResultOverlay>
        </div>
        </FitBox>

        <div class="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-3.5 rounded-full border" :class="playerColor === 1 ? 'bg-neutral border-white/20' : 'bg-base-100 border-base-content/30'" />
              <span class="text-base-content/70">你执{{ playerColor === 1 ? '黑' : '白' }}</span>
            </span>
            <span class="text-base-content/30">·</span>
            <span class="text-base-content/70">AI（{{ difficultyText }}）</span>
            <span v-if="phase !== 'setup'" class="text-xs text-base-content/45">第 {{ history.length }} 手</span>
          </div>
          <span v-if="phase === 'playing'" class="rounded-full px-2.5 py-1 text-xs"
            :class="thinking ? 'bg-base-content/10 text-base-content/70' : 'bg-primary text-primary-content'">
            {{ thinking ? 'AI 思考中…' : myTurn ? '轮到你落子' : '等待 AI' }}
          </span>
        </div>
        <div class="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-base-content/60">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-neutral" />黑 提{{ captures['1'] ?? 0 }}</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border border-base-content/30 bg-base-100" />白 提{{ captures['2'] ?? 0 }}</span>
            <span>贴目 {{ komi }}</span>
          </div>
          <span v-if="passes">连续停手 {{ passes }}</span>
        </div>
    </div>
    </div>

    <aside class="flex w-full flex-none flex-col gap-4 lg:h-full lg:w-80 lg:overflow-y-auto xl:w-96">
      <div class="panel p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold">围棋 · 人机对战</h2>
          <button class="btn btn-ghost btn-xs" @click="handleExit">
            <Icon icon="mdi:logout" class="text-sm" />
            退出
          </button>
        </div>

        <template v-if="phase === 'setup'">
          <div class="mt-4">
            <p class="text-xs text-base-content/50">执子</p>
            <div class="join mt-2 grid grid-cols-2">
              <button class="btn btn-sm join-item" :class="startColor === 1 ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="startColor = 1">执黑</button>
              <button class="btn btn-sm join-item" :class="startColor === 2 ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="startColor = 2">执白</button>
            </div>
          </div>
          <div class="mt-4">
            <p class="text-xs text-base-content/50">难度</p>
            <div class="join mt-2 grid grid-cols-3">
              <button v-for="item in levels" :key="item.value" class="btn btn-sm join-item" :class="difficulty === item.value ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="difficulty = item.value">
                {{ item.label }}
              </button>
            </div>
          </div>
          <div class="mt-4">
            <p class="text-xs text-base-content/50">棋盘</p>
            <div class="join mt-2 grid grid-cols-3">
              <button v-for="item in sizes" :key="item" class="btn btn-sm join-item" :class="size === item ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="size = item">
                {{ item }} 路
              </button>
            </div>
          </div>
          <button class="btn btn-primary btn-block mt-5" @click="reset(size, startColor as 1 | 2)">开始对局</button>
        </template>

        <template v-else>
          <p class="mt-3 text-xs leading-relaxed text-base-content/50">
            对局进行中，停一手、认输等操作位于棋盘左下方。
          </p>
        </template>
      </div>

      <div class="rounded-2xl border border-base-content/10 bg-base-100 p-4 text-xs text-base-content/60">
        <p class="font-medium text-base-content/70">规则</p>
        <ul class="mt-2 space-y-1.5">
          <li>· 黑先，双方轮流在交叉点落子。</li>
          <li>· 无气棋子被提；自杀与立即回提（打劫）不允许。</li>
          <li>· 双方连续停手后按中国规则数子，白方贴 7.5 目。</li>
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
import GoBoard from './GoBoard.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import { useGoAI } from './ai/useGoAI';
import { createBoard } from '@games/go/rules';
import type { GoDifficulty } from './ai/mcts';
import { confirm } from '@/components/msgbox';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';

const router = useRouter();
const gameStore = useGameStore();

const { board, size, playerColor, difficulty, phase, thinking, captures, passes, result, lastMove, myTurn, place, pass, resign, reset, openSetup, history, komi } = useGoAI();

const startColor = ref(1);
const sizes = [9, 13, 19];

// 设置阶段切换路数时同步重建预览棋盘，避免棋盘与选择不一致
watch(size, (n) => {
  if (phase.value === 'setup') {
    board.value = createBoard(n);
    history.value = [];
    lastMove.value = null;
    captures.value = { 1: 0, 2: 0 };
    passes.value = 0;
  }
});
const levels: Array<{ value: GoDifficulty; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'normal', label: '普通' },
  { value: 'hard', label: '困难' },
];
const difficultyText = computed(() => levels.find((item) => item.value === difficulty.value)?.label ?? '');

async function handleExit() {
  const inGame = phase.value === 'playing' && !result.value;
  const ok = await confirm(inGame ? '对局进行中，退出将丢弃当前进度。' : '确定退出当前对战吗？', '退出对战', { confirmText: '退出对战', danger: inGame });
  if (!ok) return;
  router.push('/');
}

// 人机对局结束后上报战绩（仅登录用户，不积分），供“我的对局 · 人机”筛选
const aiRecorded = ref(false);
watch(result, (v) => {
  if (!v) { aiRecorded.value = false; return; }
  if (aiRecorded.value || gameStore.player?.isVisitor) return;
  aiRecorded.value = true;
  api.recordAiGame({ game: 'go', result: v.outcome, moves: history.value.length }).catch(() => {});
});
</script>
