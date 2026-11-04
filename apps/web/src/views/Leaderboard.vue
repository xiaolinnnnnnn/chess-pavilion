<template>
  <section class="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">排行榜</h1>
        <p class="text-xs text-base-content/50">按积分排序，同分比较胜率</p>
      </div>
      <div class="join">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="btn btn-sm join-item"
          :class="game === item.key ? 'btn-primary' : 'btn-ghost bg-base-200'"
          @click="select(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </header>

    <div class="overflow-hidden rounded-xl border border-base-content/10">
      <table class="table table-sm">
        <thead>
          <tr>
            <th class="w-12">#</th>
            <th>玩家</th>
            <th class="text-right">积分</th>
            <th class="text-right">场次</th>
            <th class="text-right">胜率</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.username" class="hover">
            <td class="font-mono text-xs text-base-content/40">{{ index + 1 }}</td>
            <td>
              <RouterLink :to="`/u/${row.username}`" class="link link-hover font-medium">{{ row.nickname }}</RouterLink>
            </td>
            <td class="text-right font-mono tabular-nums">{{ row.points }}</td>
            <td class="text-right font-mono text-xs tabular-nums text-base-content/60">{{ row.total }}</td>
            <td class="text-right font-mono text-xs tabular-nums">
              {{ row.total ? Math.round((row.wins / row.total) * 100) : 0 }}%
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="py-10 text-center text-sm text-base-content/40">还没有对局数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';

const gameStore = useGameStore();
const game = ref('');
const rows = ref<any[]>([]);

const tabs = computed(() => [
  { key: '', label: '总榜' },
  ...Object.entries(gameStore.games).map(([key, item]) => ({ key, label: item.name })),
]);

async function load() {
  rows.value = await api.leaderboard(game.value || undefined);
}

function select(key: string) {
  game.value = key;
  load();
}

onMounted(load);
</script>
