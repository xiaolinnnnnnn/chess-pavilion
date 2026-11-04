<template>
  <section class="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
    <div v-if="loading" class="py-20 text-center text-sm text-base-content/40">加载中…</div>
    <div v-else-if="!summary" class="py-20 text-center text-sm text-base-content/40">用户不存在</div>

    <template v-else>
      <header class="flex flex-wrap items-center gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
          {{ summary.nickname.slice(0, 1) }}
        </div>
        <div class="flex-1">
          <h1 class="text-xl font-semibold">{{ summary.nickname }}</h1>
          <p class="text-xs text-base-content/50">@{{ summary.username }} · 加入于 {{ formatDate(summary.created_at) }}</p>
        </div>
        <div class="rounded-xl bg-base-200 px-4 py-2 text-right">
          <p class="text-xs text-base-content/50">积分</p>
          <p class="font-mono text-lg tabular-nums">{{ summary.points }}</p>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="item in statCards" :key="item.label" class="rounded-xl border border-base-content/10 bg-base-100 p-3">
          <p class="text-xs text-base-content/50">{{ item.label }}</p>
          <p class="font-mono text-lg tabular-nums">{{ item.value }}</p>
        </div>
      </div>

      <div v-if="summary.byGame?.length" class="flex flex-wrap gap-2 text-xs">
        <span v-for="item in summary.byGame" :key="item.game" class="rounded-full bg-base-200 px-3 py-1">
          {{ gameName(item.game) }} · {{ item.total }} 局 · 胜 {{ item.wins }}
        </span>
      </div>

      <section>
        <h2 class="mb-2 text-sm font-medium text-base-content/70">最近对局</h2>
        <div class="overflow-hidden rounded-xl border border-base-content/10">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>时间</th>
                <th>游戏</th>
                <th>结果</th>
                <th class="text-right">积分</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="match in summary.recent" :key="match.id" class="hover">
                <td class="whitespace-nowrap text-xs text-base-content/60">{{ formatDateTime(match.ended_at) }}</td>
                <td class="text-sm">{{ gameName(match.game) }}</td>
                <td>
                  <span class="badge badge-sm" :class="resultClass(match.my_result)">
                    {{ resultText(match.my_result) }}
                  </span>
                </td>
                <td class="text-right font-mono text-xs tabular-nums" :class="match.my_delta > 0 ? 'text-error' : match.my_delta < 0 ? 'text-success' : ''">
                  {{ match.my_delta > 0 ? '+' : '' }}{{ match.my_delta }}
                </td>
                <td class="text-right">
                  <RouterLink class="link link-hover text-xs text-primary" :to="`/p/${match.id}`">复盘</RouterLink>
                </td>
              </tr>
              <tr v-if="!summary.recent?.length">
                <td colspan="5" class="py-8 text-center text-sm text-base-content/40">还没有对局记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';

const route = useRoute();
const gameStore = useGameStore();
const summary = ref<any>(null);
const loading = ref(true);

const statCards = computed(() => {
  const stats = summary.value?.stats ?? {};
  return [
    { label: '总场次', value: stats.total ?? 0 },
    { label: '胜', value: stats.wins ?? 0 },
    { label: '负', value: stats.losses ?? 0 },
    { label: '胜率', value: `${Math.round((stats.winRate ?? 0) * 100)}%` },
  ];
});

function gameName(key: string) {
  return gameStore.games[key]?.name ?? key;
}
function resultText(result: string) {
  return result === 'win' ? '胜' : result === 'loss' ? '负' : '和';
}
function resultClass(result: string) {
  return result === 'win' ? 'badge-error' : result === 'loss' ? 'badge-success' : 'badge-ghost';
}
function formatDate(ts: number) {
  return ts ? new Date(ts).toLocaleDateString('zh-CN') : '-';
}
function formatDateTime(ts: number) {
  return ts ? new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
}

async function load() {
  loading.value = true;
  try {
    summary.value = await api.user(String(route.params.username));
  } catch {
    summary.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.username, load);
onMounted(load);
</script>
