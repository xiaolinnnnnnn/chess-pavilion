<template>
  <div
    ref="shellRef"
    class="xiangqi-shell flex rounded-2xl border border-base-content/10 bg-base-300/50 shadow-inner"
    :class="fluid ? 'h-full w-full items-center justify-center overflow-hidden' : 'mx-auto w-full max-w-[424px] justify-center p-4 sm:p-8'"
    :style="fluid ? { padding: EDGE * u + 'px' } : undefined"
  >
    <div
      ref="boardRef"
      class="relative shrink-0 rounded-lg"
      :class="{ 'rotate-180': rotate }"
      :style="{ width: 360 * u + 'px', height: 405 * u + 'px', background: 'linear-gradient(135deg, #eed6ae 0%, #e6c795 55%, #d9b478 100%)' }"
    >
      <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 360 405" preserveAspectRatio="none">
        <rect x="0" y="0" width="360" height="180" fill="none" stroke="currentColor" stroke-width="2" class="text-[#4a341e]/70" />
        <rect x="0" y="225" width="360" height="180" fill="none" stroke="currentColor" stroke-width="2" class="text-[#4a341e]/70" />
        <line x1="0" y1="180" x2="0" y2="225" stroke="currentColor" stroke-width="2" class="text-[#4a341e]/70" />
        <line x1="360" y1="180" x2="360" y2="225" stroke="currentColor" stroke-width="2" class="text-[#4a341e]/70" />
        <line x1="0" y1="0" x2="0" y2="180" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="360" y1="0" x2="360" y2="180" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line v-for="c in 7" :key="'vt' + c" :x1="c * 45" y1="0" :x2="c * 45" y2="180" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="0" y1="225" x2="0" y2="405" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="360" y1="225" x2="360" y2="405" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line v-for="c in 7" :key="'vb' + c" :x1="c * 45" y1="225" :x2="c * 45" y2="405" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line v-for="r in 5" :key="'ht' + r" x1="0" :y1="(r - 1) * 45" x2="360" :y2="(r - 1) * 45" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line v-for="r in 5" :key="'hb' + r" x1="0" :y1="225 + (r - 1) * 45" x2="360" :y2="225 + (r - 1) * 45" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="135" y1="0" x2="225" y2="90" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="225" y1="0" x2="135" y2="90" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="135" y1="315" x2="225" y2="405" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />
        <line x1="225" y1="315" x2="135" y2="405" stroke="currentColor" stroke-width="1" class="text-[#4a341e]/55" />

        <g v-if="lastMove" pointer-events="none">
          <circle :cx="svgX(lastMove.from.y)" :cy="svgY(lastMove.from.x)" r="22" fill="none" stroke="currentColor" stroke-width="5" class="text-[#2b1d10]/35" />
          <circle :cx="svgX(lastMove.from.y)" :cy="svgY(lastMove.from.x)" r="22" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" class="text-[#d64a3e]" />
          <circle :cx="svgX(lastMove.to.y)" :cy="svgY(lastMove.to.x)" r="22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" class="text-[#d64a3e]" />
        </g>
      </svg>

      <div class="relative" :style="{ width: 360 * u + 'px', height: 405 * u + 'px' }">
        <div
          v-for="r in 10"
          :key="'row' + r"
          class="absolute"
          :style="{ top: ((r - 1 <= 4 ? (r - 1) * 45 : 225 + (r - 1 - 5) * 45) * u) + 'px', left: 0, right: 0 }"
        >
          <div
            v-for="c in 9"
            :key="'cell' + c"
            class="absolute"
            :style="{ left: (c - 1) * 45 * u + 'px', transform: 'translate(-50%, -50%)', width: 45 * u + 'px', height: 45 * u + 'px' }"
            @click="interactive && emit('cell', r - 1, c - 1)"
          >
            <svg
              v-if="shouldShowIntersectionMark(r - 1, c - 1)"
              class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              :width="40 * u"
              :height="40 * u"
              viewBox="0 0 40 40"
            >
              <line x1="16" y1="16" x2="16" y2="12" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="16" y1="16" x2="12" y2="16" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="24" y1="16" x2="24" y2="12" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="24" y1="16" x2="28" y2="16" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="16" y1="24" x2="16" y2="28" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="16" y1="24" x2="12" y2="24" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="24" y1="24" x2="24" y2="28" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
              <line x1="24" y1="24" x2="28" y2="24" stroke="currentColor" stroke-width="1.5" class="text-[#4a341e]/70" />
            </svg>

            <span
              v-if="targets.some((t) => t.x === r - 1 && t.y === c - 1)"
              class="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563eb]/70"
              :style="{ width: 12 * u + 'px', height: 12 * u + 'px' }"
            />

            <button
              v-if="board[r - 1]?.[c - 1]"
              type="button"
              class="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-bold leading-none shadow-md transition"
              :class="[pieceClasses(board[r - 1][c - 1]), selected && selected.x === r - 1 && selected.y === c - 1 ? 'ring-2 ring-primary ring-offset-2' : '']"
              :style="{ width: PIECE * u + 'px', height: PIECE * u + 'px', fontSize: 15 * u + 'px' }"
              @click.stop.prevent="interactive && emit('cell', r - 1, c - 1)"
            >
              <span class="select-none" :class="{ 'rotate-180': rotate }">{{ pieceText(board[r - 1][c - 1]) }}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        class="pointer-events-none absolute left-0 right-0 select-none text-center font-bold text-[#3a2a18]/90"
        :style="{ top: 180 * u + 'px', height: 45 * u + 'px', fontSize: 18 * u + 'px', padding: '0 ' + 32 * u + 'px' }"
      >
        <div class="flex h-full items-center justify-between" :class="{ 'rotate-180': rotate }">
          <span class="font-serif tracking-widest">{{ rotate ? '汉界' : '楚河' }}</span>
          <span class="inline-block rotate-180 font-serif tracking-widest">{{ rotate ? '楚河' : '汉界' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Piece } from '@games/xiangqi/rules';

const props = withDefaults(
  defineProps<{
    board: Piece[][];
    selected?: { x: number; y: number } | null;
    lastMove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
    targets?: Array<{ x: number; y: number }>;
    rotate?: boolean;
    interactive?: boolean;
    /** 填满父容器可用空间（人机/大厅对战区使用） */
    fluid?: boolean;
  }>(),
  { selected: null, lastMove: null, targets: () => [], rotate: false, interactive: true, fluid: false },
);

const emit = defineEmits<{ (e: 'cell', x: number, y: number): void }>();

/** 基准画布：9 路 × 10 行，格距 45（360 × 405） */
const DESIGN_W = 360;
const DESIGN_H = 405;
/** 棋子直径（设计坐标系，格距 45）：略小于格距，避免边缘棋子顶到容器被裁切 */
const PIECE = 32;
/** 棋子圆心到棋盘外沿的预留量：半个棋子 + 选中描边（ring/offset）余量 */
const EDGE = PIECE / 2 + 4;

/** 缩放系数：1 即原始 360×405 设计尺寸 */
const u = ref(1);
const shellRef = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;
const timers: number[] = [];

/** 依据可用空间计算缩放比；fluid 时宽高都是硬约束，并把棋子外溢的余量算进预算 */
function applyScale(availW: number, availH: number) {
  if (availW <= 0) return;
  if (props.fluid) {
    const byWidth = availW / (DESIGN_W + EDGE * 2);
    const byHeight = availH > 0 ? availH / (DESIGN_H + EDGE * 2) : Infinity;
    // 不设高下限：允许棋盘随容器等比收缩，防止裁切溢出
    u.value = Math.max(0.2, Math.min(byWidth, byHeight));
    return;
  }
  u.value = Math.max(0.2, availW / DESIGN_W);
}

function measure() {
  const el = shellRef.value;
  if (!el) return;
  if (props.fluid) {
    // fluid 的内边距由 u 推导，不能再从容器尺寸里扣减，否则与缩放形成循环依赖
    applyScale(el.clientWidth, el.clientHeight);
    return;
  }
  const style = getComputedStyle(el);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  applyScale(el.clientWidth - padX, el.clientHeight - padY);
}

onMounted(() => {
  measure();
  // 观察容器自身尺寸变化（border-box，不受内边距影响，不会形成回调循环）
  ro = new ResizeObserver(() => measure());
  if (shellRef.value) ro.observe(shellRef.value);
  // FitBox 在父组件挂载后才约束尺寸；rAF 在隐藏页会被暂停，改用 setTimeout 多次兜底重测，确保任何环境收敛
  [40, 120, 300, 600].forEach((ms) => timers.push(window.setTimeout(measure, ms)));
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  ro?.disconnect();
});

function shouldShowIntersectionMark(r: number, c: number) {
  if ((r === 2 || r === 7) && (c === 1 || c === 7)) return true;
  if ((r === 3 || r === 6) && c % 2 === 0) return true;
  return false;
}

function pieceText(piece: Piece) {
  if (!piece) return '';
  const side = piece[0];
  const type = piece[1];
  const red: Record<string, string> = { R: '车', N: '马', B: '相', A: '士', K: '帅', C: '炮', P: '兵' };
  const green: Record<string, string> = { R: '車', N: '馬', B: '象', A: '仕', K: '将', C: '砲', P: '卒' };
  return side === 'r' ? red[type] ?? type : green[type] ?? type;
}

function pieceClasses(piece: Piece) {
  if (!piece) return 'bg-transparent';
  return piece[0] === 'r' ? 'bg-red-600 text-white' : 'bg-green-600 text-white';
}

function svgX(col: number) {
  return col * 45;
}
function svgY(row: number) {
  return row <= 4 ? row * 45 : 225 + (row - 5) * 45;
}
</script>

<style scoped>
.xiangqi-shell {
  -webkit-user-select: none;
  user-select: none;
}
</style>
