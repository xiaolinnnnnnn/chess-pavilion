<template>
  <div ref="rootRef" class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
    <div
      class="pointer-events-auto flex max-w-[92%] flex-col items-center gap-1 rounded-3xl border border-base-content/10 bg-base-100/70 px-7 py-5 text-center shadow-2xl backdrop-blur-md"
    >
      <!-- 字号按棋盘宽度与文案字数实时计算，长句自动缩小，保证永远不溢出 -->
      <p class="whitespace-nowrap font-black leading-none" :class="titleClass" :style="titleStyle">
        {{ title }}
      </p>
      <p v-if="detail" class="mt-1 max-w-[18em] text-xs leading-relaxed text-base-content/60">{{ detail }}</p>
      <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

/** 终局结果：win 胜利 / lose 失败 / draw 平局 / interrupted 作废 */
export type ResultTone = 'win' | 'lose' | 'draw' | 'interrupted';

const props = withDefaults(
  defineProps<{
    title: string;
    detail?: string;
    tone?: ResultTone;
  }>(),
  { detail: '', tone: 'draw' },
);

/** 面板左右内边距合计（px-7） */
const PANEL_PADDING = 56;
/** 面板最多占棋盘宽度的 92%，再留 4% 呼吸位 */
const SAFE_RATIO = 0.92 * 0.96;
/** 短句（如「胜利」）的最大字号 */
const MAX_FONT = 64;
const MIN_FONT = 14;

const rootRef = ref<HTMLElement | null>(null);
const rootWidth = ref(0);
let observer: ResizeObserver | null = null;

onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const width = entries[entries.length - 1]?.contentRect.width ?? 0;
    if (width > 0) rootWidth.value = width;
  });
  if (rootRef.value) {
    rootWidth.value = rootRef.value.clientWidth;
    observer.observe(rootRef.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());

const titleClass = computed(() => {
  switch (props.tone) {
    case 'win':
      return 'text-success drop-shadow-sm';
    case 'lose':
      return 'text-error drop-shadow-sm';
    case 'interrupted':
      return 'text-warning';
    default:
      return 'text-base-content/70';
  }
});

/** 长句收紧字距，短句保持原有的疏朗感 */
const tracking = computed(() => (charCount.value > 4 ? 0.02 : 0.18));

const charCount = computed(() => Math.max(1, Array.from(props.title).length));

const titleStyle = computed(() => {
  // 首帧宽度还没测到时按 480 估算，随后由 ResizeObserver 校正
  const width = rootWidth.value || 480;
  const available = Math.max(120, width * SAFE_RATIO - PANEL_PADDING);
  // 每个字占 (1 + letterSpacing) em，反推单字宽度即可保证整行放得下
  const fitted = available / (charCount.value * (1 + tracking.value));
  const size = Math.max(MIN_FONT, Math.min(MAX_FONT, Math.floor(fitted)));
  return { fontSize: `${size}px`, letterSpacing: `${tracking.value}em` };
});
</script>
