<template>
  <div ref="wrapRef" class="relative aspect-square w-full">
    <canvas
      ref="canvasRef"
      class="block h-full w-full rounded-xl shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      :class="canPlay ? 'cursor-pointer' : 'cursor-default'"
      :tabindex="canPlay ? 0 : -1"
      role="application"
      :aria-label="`围棋棋盘，${board.length} 路`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @keydown="onKeydown"
      @blur="hover = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Board, Point, Stone } from '@games/go/rules';

const props = withDefaults(
  defineProps<{
    board: Board;
    lastMove?: Point | null;
    interactive?: boolean;
    myColor?: Stone;
  }>(),
  { lastMove: null, interactive: true, myColor: 0 },
);

const emit = defineEmits<{ (e: 'place', point: Point): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLElement | null>(null);
const hover = ref<Point | null>(null);
const focused = ref<Point>({ row: 0, col: 0 });

const canPlay = computed(() => props.interactive && props.myColor !== 0);

const geometry = { pad: 0, cell: 0 };
let observer: ResizeObserver | null = null;
let raf = 0;

const STARS: Record<number, Point[]> = {
  9: [
    { row: 2, col: 2 }, { row: 2, col: 6 }, { row: 4, col: 4 }, { row: 6, col: 2 }, { row: 6, col: 6 },
  ],
  13: [
    { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 6, col: 6 }, { row: 9, col: 3 }, { row: 9, col: 9 },
  ],
  19: [
    { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
    { row: 9, col: 3 }, { row: 9, col: 9 }, { row: 9, col: 15 },
    { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 },
  ],
};

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, color: Stone, radius: number, alpha = 1) {
  if (!color) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(20, 14, 8, 0.32)';
  ctx.shadowBlur = radius * 0.5;
  ctx.shadowOffsetY = radius * 0.18;
  const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius * 1.15);
  if (color === 1) {
    gradient.addColorStop(0, '#6a6a6a');
    gradient.addColorStop(0.5, '#1f1f1f');
    gradient.addColorStop(1, '#030303');
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.6, '#f6f3ea');
    gradient.addColorStop(1, '#d5cec0');
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const size = Math.max(120, Math.min(rect.width, rect.height));
  const dpr = window.devicePixelRatio || 1;
  const pixel = Math.round(size * dpr);
  if (canvas.width !== pixel) {
    canvas.width = pixel;
    canvas.height = pixel;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const pad = Math.max(16, size * 0.055);
  const cell = (size - pad * 2) / (props.board.length - 1);
  geometry.pad = pad;
  geometry.cell = cell;

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  // 与五子棋棋盘同色：统一三停点木纹渐变
  gradient.addColorStop(0, '#eed6ae');
  gradient.addColorStop(0.55, '#e6c795');
  gradient.addColorStop(1, '#d9b478');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.022);
  ctx.fill();

  ctx.strokeStyle = 'rgba(70, 48, 26, 0.55)';
  ctx.lineWidth = Math.max(0.7, size * 0.0012);
  ctx.beginPath();
  for (let i = 0; i < props.board.length; i++) {
    const p = pad + i * cell;
    ctx.moveTo(pad, p);
    ctx.lineTo(size - pad, p);
    ctx.moveTo(p, pad);
    ctx.lineTo(p, size - pad);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(58, 40, 22, 0.8)';
  (STARS[props.board.length] ?? []).forEach(({ row, col }) => {
    ctx.beginPath();
    ctx.arc(pad + col * cell, pad + row * cell, Math.max(1.6, cell * 0.09), 0, Math.PI * 2);
    ctx.fill();
  });

  const radius = cell * 0.46;
  for (let row = 0; row < props.board.length; row++) {
    for (let col = 0; col < props.board.length; col++) {
      drawStone(ctx, pad + col * cell, pad + row * cell, props.board[row][col], radius);
    }
  }

  if (canPlay.value && hover.value && props.board[hover.value.row]?.[hover.value.col] === 0) {
    drawStone(ctx, pad + hover.value.col * cell, pad + hover.value.row * cell, props.myColor, radius, 0.35);
  }

  if (props.lastMove && props.lastMove.row >= 0) {
    const { row, col } = props.lastMove;
    ctx.beginPath();
    ctx.arc(pad + col * cell, pad + row * cell, Math.max(2.4, radius * 0.3), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(214, 74, 62, 0.95)';
    ctx.lineWidth = Math.max(1.4, cell * 0.07);
    ctx.stroke();
  }

  if (canPlay.value && document.activeElement === canvas) {
    const x = pad + focused.value.col * cell;
    const y = pad + focused.value.row * cell;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.06, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
    ctx.lineWidth = Math.max(1.2, cell * 0.06);
    ctx.stroke();
  }
}

function coordAt(event: PointerEvent): Point | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const { pad, cell } = geometry;
  const col = Math.round((x - pad) / cell);
  const row = Math.round((y - pad) / cell);
  const max = props.board.length - 1;
  if (row < 0 || row > max || col < 0 || col > max) return null;
  const dx = x - (pad + col * cell);
  const dy = y - (pad + row * cell);
  return Math.hypot(dx, dy) <= cell * 0.55 ? { row, col } : null;
}

function place(point: Point) {
  if (!canPlay.value || props.board[point.row]?.[point.col] !== 0) return;
  emit('place', point);
  hover.value = null;
}

function onPointerDown(event: PointerEvent) {
  const point = coordAt(event);
  if (point) {
    focused.value = point;
    place(point);
  }
}

function onPointerMove(event: PointerEvent) {
  if (!canPlay.value) return;
  const point = coordAt(event);
  const next = point && props.board[point.row][point.col] === 0 ? point : null;
  if (next?.row === hover.value?.row && next?.col === hover.value?.col) return;
  hover.value = next;
  draw();
}

function onPointerLeave() {
  hover.value = null;
  draw();
}

function onKeydown(event: KeyboardEvent) {
  if (!canPlay.value) return;
  const max = props.board.length - 1;
  const { row, col } = focused.value;
  if (event.key === 'ArrowUp') focused.value = { row: Math.max(0, row - 1), col };
  else if (event.key === 'ArrowDown') focused.value = { row: Math.min(max, row + 1), col };
  else if (event.key === 'ArrowLeft') focused.value = { row, col: Math.max(0, col - 1) };
  else if (event.key === 'ArrowRight') focused.value = { row, col: Math.min(max, col + 1) };
  else if (event.key === 'Enter' || event.key === ' ') place(focused.value);
  else return;
  event.preventDefault();
  draw();
}

watch(() => props.board, draw, { deep: true });
watch(() => props.lastMove, draw);
watch(() => props.interactive, draw);

onMounted(() => {
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  if (wrapRef.value) observer.observe(wrapRef.value);
  draw();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(raf);
});
</script>
