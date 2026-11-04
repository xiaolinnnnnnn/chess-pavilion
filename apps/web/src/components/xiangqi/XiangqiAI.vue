<template>
  <section class="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 md:gap-5 md:p-5 lg:h-full lg:min-h-0 lg:flex-row">

    <div class="flex min-h-0 w-full min-w-0 flex-1 items-stretch gap-3">
      <div v-if="phase !== 'setup'" class="flex flex-none flex-col justify-center gap-2">
        <button class="btn btn-sm" :disabled="!canUndo" @click="undo">悔棋</button>
        <button class="btn btn-sm" :disabled="phase !== 'playing'" @click="resign">认输</button>
        <button class="btn btn-sm btn-soft" @click="reset(playerSide)">重开</button>
        <button class="btn btn-sm btn-ghost" @click="openSetup">换设置</button>
      </div>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3">

      <FitBox :ratio="400 / 445" class="w-full max-lg:aspect-[400/445] max-lg:max-h-[calc(100dvh-16rem)] lg:min-h-0 lg:flex-1">
        <div class="relative h-full w-full">
          <XiangqiBoard
            fluid
            :board="board"
            :selected="selected"
            :last-move="lastMove"
            :targets="targets"
            :rotate="playerSide === 'green'"
            :interactive="phase === 'playing' && myTurn"
            @cell="click"
          />

          <GameResultOverlay
            v-if="result"
            :title="result.outcome === 'win' ? '胜利' : result.outcome === 'loss' ? RESULT_TEXT.lose : '平局'"
            :detail="result.detail"
            :tone="result.outcome === 'win' ? 'win' : result.outcome === 'loss' ? 'lose' : 'draw'"
          >
            <button class="btn btn-xs btn-primary" @click="reset(playerSide)">再来一局</button>
            <button class="btn btn-xs btn-ghost" @click="openSetup">换设置</button>
          </GameResultOverlay>
        </div>
      </FitBox>

      <div class="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-3.5 w-3.5 rounded-full" :class="playerSide === 'red' ? 'bg-red-600' : 'bg-green-600'" />
            <span class="text-base-content/70">你执{{ playerSide === 'red' ? '红' : '绿' }}</span>
          </span>
          <span class="text-base-content/30">·</span>
          <span class="text-base-content/70">AI（{{ difficultyText }}）</span>
          <span v-if="phase !== 'setup'" class="text-xs text-base-content/45">第 {{ history.length }} 手</span>
        </div>
        <span v-if="phase === 'playing'" class="rounded-full px-2.5 py-1 text-xs"
          :class="thinking ? 'bg-base-content/10 text-base-content/70' : 'bg-primary text-primary-content'">
          {{ thinking ? 'AI 思考中…' : myTurn ? '轮到你走棋' : '等待 AI' }}
        </span>
      </div>

      </div>
      </div>

    <aside class="flex w-full flex-none flex-col gap-4 lg:h-full lg:w-80 lg:overflow-y-auto xl:w-96">
      <div class="panel p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-base font-semibold">中国象棋 · 人机</h2>
          <button class="btn btn-ghost btn-xs" @click="handleExit">
            <Icon icon="mdi:logout" class="text-sm" />
            退出
          </button>
        </div>

        <template v-if="phase === 'setup'">
          <div class="mt-4">
            <p class="text-xs text-base-content/50">执子</p>
            <div class="join mt-2 grid grid-cols-2">
              <button class="btn btn-sm join-item" :class="startSide === 'red' ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="startSide = 'red'">执红先行</button>
              <button class="btn btn-sm join-item" :class="startSide === 'green' ? 'btn-primary' : 'btn-ghost bg-base-200'" @click="startSide = 'green'">执绿后行</button>
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
          <button class="btn btn-primary btn-block mt-5" @click="reset(startSide)">开始对局</button>
        </template>

        <template v-else>
          <p class="mt-3 text-xs leading-relaxed text-base-content/50">
            对局进行中，悔棋、认输等操作位于棋盘左下方。
          </p>
        </template>
      </div>

      <div class="rounded-2xl border border-base-content/10 bg-base-100 p-4 text-xs text-base-content/60">
        <p class="font-medium text-base-content/70">规则</p>
        <ul class="mt-2 space-y-1.5">
          <li>· 红先绿后，点击棋子后点击目标点落子。</li>
          <li>· 马别腿、象塞眼、炮隔子、九宫与过河兵均按标准规则。</li>
          <li>· 将帅对脸与自陷将军不合法；被将死或无子可走即负。</li>
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
import XiangqiBoard from './XiangqiBoard.vue';
import GameResultOverlay from '@/components/common/GameResultOverlay.vue';
import { RESULT_TEXT } from '@/components/common/gameResultText';
import { useXiangqiAI, type XiangqiDifficulty } from './ai/useXiangqiAI';
import type { Side } from '@games/xiangqi/rules';
import { confirm } from '@/components/msgbox';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';

const router = useRouter();
const gameStore = useGameStore();

const { board, turn, playerSide, difficulty, phase, thinking, selected, targets, lastMove, result, history, myTurn, canUndo, click, undo, reset, resign, openSetup } = useXiangqiAI();

const startSide = ref<Side>('red');
const levels: Array<{ value: XiangqiDifficulty; label: string }> = [
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
  api.recordAiGame({ game: 'xiangqi', result: v.outcome, moves: history.value.length }).catch(() => {});
});
</script>
