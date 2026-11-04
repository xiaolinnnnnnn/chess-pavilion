<template>
  <section class="flex h-full min-h-0 flex-col">
    <div class="min-h-0 flex-1 overflow-auto lg:overflow-hidden">
      <component :is="current" :key="active" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import GomokuAI from '@/components/gomoku/GomokuAI.vue';
import XiangqiAI from '@/components/xiangqi/XiangqiAI.vue';
import GoAI from '@/components/go/GoAI.vue';

const route = useRoute();

const gameComponents: Record<string, typeof GomokuAI> = {
  gomoku: GomokuAI,
  go: GoAI,
  xiangqi: XiangqiAI,
};

// 人机入口仅保留首页三个棋类卡片，按路由参数直接渲染，不再提供页内 tab
const active = computed(() => (gameComponents[String(route.params.game)] ? String(route.params.game) : 'gomoku'));
const current = computed(() => gameComponents[active.value]);
</script>
