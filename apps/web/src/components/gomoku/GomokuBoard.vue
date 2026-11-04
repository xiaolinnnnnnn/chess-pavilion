<template>
  <div ref="wrapRef" class="relative w-full aspect-square">
    <canvas
      ref="canvasRef"
      class="block h-full w-full rounded-xl shadow-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60"
      :class="canPlay ? 'cursor-pointer' : 'cursor-default'"
      :tabindex="canPlay ? 0 : -1"
      role="application"
      :aria-label="`五子棋棋盘，${boardSize} 路，当前${canPlay ? '可落子' : '观战中'}`"
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
import type { Board, Coord, Stone } from '@games/gomoku/rules';

const props = withDefaults(
  defineProps<{
    board: Board;
    /** 最后一手，用于落子动画与标记 */
    lastMove?: Coord | null;
    /** 胜利五子连线 */
    winLine?: Coord[] | null;
    /** 是否允许落子（观战、非回合、AI 思考中传 false） */
    interactive?: boolean;
    /** 我方棋子颜色，用于悬停预览 */
    myColor?: Stone;
    /** 落子后是否清空悬停预览 */
    clearHoverOnPlace?: boolean;
  }>(),
  {
    lastMove: null,
    winLine: null,
    interactive: true,
    myColor: 0,
    clearHoverOnPlace: true,
  },
);

const emit = defineEmits<{ (e: 'place', coord: Coord): void }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLElement | null>(null);

const boardSize = computed(() => props.board.length);
const canPlay = computed(() => props.interactive && props.myColor !== 0);

const hover = ref<Coord | null>(null);
const focused = ref<Coord>({ row: Math.floor(boardSize.value / 2), col: Math.floor(boardSize.value / 2) });

const geometry = { size: 0, pad: 0, cell: 0, dpr: 1 };
let observer: ResizeObserver | null = null;
let raf = 0;
let animStart = 0;
let winStart = 0;

const STAR_POINTS: Record<number, Coord[]> = {
  15: [
    { row: 3, col: 3 },
    { row: 3, col: 11 },
    { row: 11, col: 3 },
    { row: 11, col: 11 },
    { row: 7, col: 7 },
  ],
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, color: Stone, radius: number, alpha = 1) {
  if (color === 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(28, 18, 8, 0.35)';
  ctx.shadowBlur = radius * 0.55;
  ctx.shadowOffsetY = radius * 0.22;

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.15,
    x,
    y,
    radius * 1.15,
  );
  if (color === 1) {
    gradient.addColorStop(0, '#6f6f6f');
    gradient.addColorStop(0.45, '#232323');
    gradient.addColorStop(1, '#050505');
  } else {
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.6, '#f4f1e8');
    gradient.addColorStop(1, '#cfc8ba');
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color === 1 ? 'rgba(255,255,255,0.14)' : 'rgba(60,45,25,0.18)';
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const size = Math.max(120, Math.min(rect.width, rect.height));
  const dpr = window.devicePixelRatio || 1;
  const pixel = Math.round(size * dpr);

  if (canvas.width !== pixel || canvas.height !== pixel) {
    canvas.width = pixel;
    canvas.height = pixel;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const pad = Math.max(20, size * 0.074);
  const cell = (size - pad * 2) / (boardSize.value - 1);
  geometry.size = size;
  geometry.pad = pad;
  geometry.cell = cell;
  geometry.dpr = dpr;

  const boardGradient = ctx.createLinearGradient(0, 0, size, size);
  boardGradient.addColorStop(0, '#eed6ae');
  boardGradient.addColorStop(0.55, '#e6c795');
  boardGradient.addColorStop(1, '#d9b478');
  ctx.fillStyle = boardGradient;
  roundRect(ctx, 0, 0, size, size, size * 0.022);
  ctx.fill();

  // 木纹：极低对比度的横向纹理，避免纯色塑料感
  ctx.save();
  roundRect(ctx, 0, 0, size, size, size * 0.022);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    const y = (i + 0.5) * (size / 7) + Math.sin(i * 1.7) * size * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y - size * 0.012, size * 0.7, y + size * 0.012, size, y - size * 0.004);
    ctx.strokeStyle = `rgba(120, 82, 40, ${0.05 + (i % 3) * 0.013})`;
    ctx.lineWidth = size * 0.006;
    ctx.stroke();
  }
  ctx.restore();

  // 网格
  const start = pad;
  const end = size - pad;
  ctx.strokeStyle = 'rgba(74, 52, 30, 0.52)';
  ctx.lineWidth = Math.max(0.7, size * 0.0012);
  ctx.beginPath();
  for (let i = 0; i < boardSize.value; i++) {
    const p = start + i * cell;
    ctx.moveTo(start, p);
    ctx.lineTo(end, p);
    ctx.moveTo(p, start);
    ctx.lineTo(p, end);
  }
  ctx.stroke();

  // 外框
  ctx.strokeStyle = 'rgba(70, 48, 26, 0.75)';
  ctx.lineWidth = Math.max(1.1, size * 0.0022);
  ctx.strokeRect(start, start, end - start, end - start);

  // 星位
  ctx.fillStyle = 'rgba(58, 40, 22, 0.78)';
  (STAR_POINTS[boardSize.value] ?? []).forEach(({ row, col }) => {
    ctx.beginPath();
    ctx.arc(start + col * cell, start + row * cell, Math.max(1.6, cell * 0.075), 0, Math.PI * 2);
    ctx.fill();
  });

  // 坐标
  const fontSize = Math.max(9, Math.min(12, cell * 0.42));
  ctx.fillStyle = 'rgba(66, 46, 24, 0.62)';
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < boardSize.value; i++) {
    ctx.fillText(String.fromCharCode(65 + i), start + i * cell, end + pad * 0.52);
    ctx.fillText(String(boardSize.value - i), pad * 0.48, start + i * cell);
  }

  // 棋子
  const now = performance.now();
  const radius = cell * 0.44;
  for (let row = 0; row < boardSize.value; row++) {
    for (let col = 0; col < boardSize.value; col++) {
      const color = props.board[row][col];
      if (!color) continue;

      const isLast = props.lastMove?.row === row && props.lastMove?.col === col;
      let scale = 1;
      let alpha = 1;
      if (isLast && animStart) {
        const t = Math.min(1, (now - animStart) / 220);
        scale = 0.65 + 0.35 * easeOutCubic(t);
        alpha = 0.35 + 0.65 * t;
      }
      drawStone(ctx, start + col * cell, start + row * cell, color, radius * scale, alpha);
    }
  }

  // 悬停预览
  if (canPlay.value && hover.value && props.board[hover.value.row]?.[hover.value.col] === 0) {
    drawStone(
      ctx,
      start + hover.value.col * cell,
      start + hover.value.row * cell,
      props.myColor,
      radius,
      0.38,
    );
  }

  // 最后一手标记
  if (props.lastMove) {
    const { row, col } = props.lastMove;
    if (props.board[row]?.[col]) {
      const x = start + col * cell;
      const y = start + row * cell;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.4, radius * 0.32), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(224, 70, 60, 0.95)';
      ctx.lineWidth = Math.max(1.6, cell * 0.07);
      ctx.stroke();
    }
  }

  // 胜利连线
  if (props.winLine && props.winLine.length >= 2) {
    const t = winStart ? Math.min(1, (now - winStart) / 380) : 1;
    const first = props.winLine[0];
    const last = props.winLine[props.winLine.length - 1];
    ctx.save();
    ctx.globalAlpha = 0.85 * easeOutCubic(t);
    ctx.strokeStyle = '#e0463c';
    ctx.lineWidth = Math.max(2, cell * 0.13);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(224, 70, 60, 0.55)';
    ctx.shadowBlur = cell * 0.4;
    ctx.beginPath();
    ctx.moveTo(start + first.col * cell, start + first.row * cell);
    ctx.lineTo(
      start + first.col * cell + (last.col - first.col) * cell * easeOutCubic(t),
      start + first.row * cell + (last.row - first.row) * cell * easeOutCubic(t),
    );
    ctx.stroke();
    ctx.restore();
  }

  // 键盘焦点
  if (canPlay.value && document.activeElement === canvas) {
    const x = start + focused.value.col * cell;
    const y = start + focused.value.row * cell;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
    ctx.lineWidth = Math.max(1.4, cell * 0.06);
    ctx.stroke();
  }
}

function loop() {
  draw();
  const now = performance.now();
  const animating = (animStart && now - animStart < 240) || (winStart && now - winStart < 400);
  if (animating) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = 0;
  }
}

function requestDraw() {
  if (raf) return;
  raf = requestAnimationFrame(loop);
}

function coordAt(event: PointerEvent): Coord | null {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const { pad, cell } = geometry;
  const col = Math.round((x - pad) / cell);
  const row = Math.round((y - pad) / cell);
  if (row < 0 || row >= boardSize.value || col < 0 || col >= boardSize.value) return null;
  const dx = x - (pad + col * cell);
  const dy = y - (pad + row * cell);
  return Math.hypot(dx, dy) <= cell * 0.58 ? { row, col } : null;
}

function placeAt(coord: Coord) {
  if (!canPlay.value) return;
  if (props.board[coord.row]?.[coord.col] !== 0) return;
  emit('place', coord);
  if (props.clearHoverOnPlace) hover.value = null;
}

function onPointerDown(event: PointerEvent) {
  const coord = coordAt(event);
  if (!coord) return;
  focused.value = coord;
  placeAt(coord);
}

function onPointerMove(event: PointerEvent) {
  if (!canPlay.value) return;
  const coord = coordAt(event);
  const next = coord && props.board[coord.row][coord.col] === 0 ? coord : null;
  if (next?.row === hover.value?.row && next?.col === hover.value?.col) return;
  hover.value = next;
  draw();
}

function onPointerLeave() {
  if (!hover.value) return;
  hover.value = null;
  draw();
}

function onKeydown(event: KeyboardEvent) {
  if (!canPlay.value) return;
  const { row, col } = focused.value;
  const max = boardSize.value - 1;
  let next: Coord | null = null;
  if (event.key === 'ArrowUp') next = { row: Math.max(0, row - 1), col };
  else if (event.key === 'ArrowDown') next = { row: Math.min(max, row + 1), col };
  else if (event.key === 'ArrowLeft') next = { row, col: Math.max(0, col - 1) };
  else if (event.key === 'ArrowRight') next = { row, col: Math.min(max, col + 1) };
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placeAt(focused.value);
    return;
  }

  if (next) {
    event.preventDefault();
    focused.value = next;
    draw();
  }
}

watch(
  () => props.board,
  () => requestDraw(),
  { deep: true },
);

watch(
  () => props.lastMove,
  (value) => {
    animStart = value ? performance.now() : 0;
    requestDraw();
  },
);

watch(
  () => props.winLine,
  (value) => {
    winStart = value ? performance.now() : 0;
    requestDraw();
  },
);

onMounted(() => {
  observer = new ResizeObserver(() => requestDraw());
  if (wrapRef.value) observer.observe(wrapRef.value);
  requestDraw();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (raf) cancelAnimationFrame(raf);
});
</script>
