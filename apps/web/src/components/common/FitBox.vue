<template>
  <div ref="hostRef" class="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden">
    <div
      class="relative"
      :style="{
        width: size.w ? size.w + 'px' : '100%',
        height: size.h ? size.h + 'px' : undefined,
        aspectRatio: size.w ? undefined : String(ratio),
        visibility: size.w ? 'visible' : 'hidden',
      }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 在可用空间内按固定比例放置最大尺寸的内容盒：
 * 大屏舒展填满，小屏等比收缩，棋盘永远居中且不挤压。
 */
const props = withDefaults(defineProps<{ ratio?: number }>(), { ratio: 1 });

const hostRef = ref<HTMLElement | null>(null);
const size = ref({ w: 0, h: 0 });
let ro: ResizeObserver | null = null;
const timers: number[] = [];

function measure() {
  const el = hostRef.value;
  if (!el) return;
  const cw = el.clientWidth;
  const ch = el.clientHeight;
  // 子内容自身撑开高度（fallback  aspect 盒子）时 ch==cw，按视口可用高度兜底，避免循环依赖导致棋盘过大或被裁切
  let avail = ch;
  if (!avail || Math.abs(avail - cw) < 2) {
    avail = Math.max(240, window.innerHeight - el.getBoundingClientRect().top - 96);
  }
  if (!cw) return;
  let w = cw;
  let h = cw / props.ratio;
  if (h > avail) {
    h = avail;
    w = avail * props.ratio;
  }
  size.value = { w: Math.floor(w), h: Math.floor(h) };
}

onMounted(() => {
  measure();
  ro = new ResizeObserver(measure);
  if (hostRef.value) ro.observe(hostRef.value);
  // 宿主高度由父级 flex 布局在挂载后才稳定；rAF/RO 在隐藏页会被暂停，用 setTimeout 多次兜底重测，保证任何环境下棋盘尺寸收敛
  [40, 120, 300, 600].forEach((ms) => timers.push(window.setTimeout(measure, ms)));
});

onBeforeUnmount(() => {
  timers.forEach((t) => clearTimeout(t));
  ro?.disconnect();
});
</script>
