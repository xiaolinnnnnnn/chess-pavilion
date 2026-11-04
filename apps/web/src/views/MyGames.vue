<template>
  <main class="mx-auto flex w-full max-w-4xl flex-col gap-4 overflow-auto p-4 md:p-8">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">我的对局</h1>
      <Back />
    </header>


    <div class="panel flex flex-wrap items-center gap-3 px-4 py-3">
      <label class="flex items-center gap-2 whitespace-nowrap text-sm">
        <span class="text-base-content/60">类型</span>
        <el-select v-model="mode" class="!w-32">
          <el-option label="全部" value="all" />
          <el-option label="联网" value="online" />
          <el-option label="人机" value="ai" />
        </el-select>
      </label>
      <label class="flex items-center gap-2 whitespace-nowrap text-sm">
        <span class="text-base-content/60">棋类</span>
        <el-select v-model="game" class="!w-32">
          <el-option label="全部" value="all" />
          <el-option v-for="(g, key) in gameStore.games" :key="key" :label="g.name" :value="key" />
        </el-select>
      </label>
      <label class="flex items-center gap-2 whitespace-nowrap text-sm">
        <span class="text-base-content/60">时间</span>
        <el-select v-model="range" class="!w-32">
          <el-option label="全部" value="all" />
          <el-option label="今天" value="today" />
          <el-option label="近 7 天" value="7" />
          <el-option label="近 30 天" value="30" />
        </el-select>
      </label>
    </div>

    <div class="panel overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center gap-2 py-12 text-sm text-base-content/50">
        <span class="loading loading-spinner loading-sm"></span>加载中…
      </div>
      <div v-else-if="!filtered.length" class="py-12 text-center text-sm text-base-content/40">暂无对局记录</div>
      <table v-else class="table table-zebra">
        <thead>
          <tr>
            <th>棋类</th>
            <th>对手</th>
            <th>结果</th>
            <th>手数</th>
            <th>积分</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filtered" :key="row.id">
            <td>{{ gameName(row.game) }}</td>
            <td class="max-w-[10em] truncate">{{ row.opponent }}</td>
            <td>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="resultClass(row.result)">
                {{ resultText(row.result) }}
              </span>
            </td>
            <td class="font-mono tabular-nums">{{ row.moves }}</td>
            <td class="font-mono tabular-nums" :class="row.delta > 0 ? 'text-success' : row.delta < 0 ? 'text-error' : ''">
              {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
            </td>
            <td class="text-xs text-base-content/60">{{ formatTime(row.endedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import { useGameStore } from '@/stores/game';
import Back from '@/components/common/Back.vue';
import msg from '@/components/msg';

const gameStore = useGameStore();

const rows = ref<any[]>([]);
const loading = ref(true);
const mode = ref('all');
const game = ref('all');
const range = ref('all');

function gameName(key: string) {
  return gameStore.games[key]?.name ?? key;
}

const filtered = computed(() => {
  const now = Date.now();
  const rangeMs = range.value === 'today' ? startOfToday() : range.value === '7' ? 7 * 86400_000 : range.value === '30' ? 30 * 86400_000 : 0;
  return rows.value.filter((r) => {
    if (mode.value !== 'all' && r.mode !== mode.value) return false;
    if (game.value !== 'all' && r.game !== game.value) return false;
    if (rangeMs && r.endedAt < now - rangeMs) return false;
    return true;
  });
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Date.now() - d.getTime();
}

function resultText(result: string) {
  return result === 'win' ? '胜利' : result === 'loss' ? '失败' : '平局';
}
function resultClass(result: string) {
  if (result === 'win') return 'bg-success/15 text-success';
  if (result === 'loss') return 'bg-error/15 text-error';
  return 'bg-base-content/10 text-base-content/60';
}
function formatTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await api.myGames();
  } catch (err) {
    msg.error((err as Error).message || '加载对局记录失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
