<template>
  <section class="flex h-full w-full flex-col bg-base-100">
    <header class="z-10 flex items-center justify-between border-b border-base-content/10 bg-base-100 px-4 py-2">
      <Back />
      <h1 class="text-sm font-medium">对局复盘</h1>
      <span class="w-16 text-right text-xs text-base-content/40">{{ gameName }}</span>
    </header>

    <section v-if="ComponentReplay" class="flex-1 overflow-auto">
      <component :is="ComponentReplay" v-bind="data" :begin-time="beginTime" :room-name="roomName" />
    </section>
    <section v-else-if="loaded" class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-base-content/40">
      <Icon icon="mdi:history" class="text-4xl" />
      这局没有可用的复盘数据
    </section>
    <section v-else class="flex flex-1 items-center justify-center text-sm text-base-content/40">加载中…</section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { getComponent } from '@/components';
import { useGameStore } from '@/stores/game';
import Back from '@/components/common/Back.vue';
import Icon from '@/components/common/Icon.vue';

const route = useRoute();
const gameStore = useGameStore();
const type = ref('');
const data = ref<Record<string, any>>({});
const beginTime = ref(0);
const roomName = ref('');
const loaded = ref(false);

const ComponentReplay = computed(() => getComponent(type.value, 'Replay'));
const gameName = computed(() => gameStore.games[type.value]?.name ?? '');

onMounted(async () => {
  try {
    const record = await api.record(String(route.params.id));
    type.value = record.game;
    data.value = record.moves ?? {};
    beginTime.value = Number(record.started_at) || 0;
    roomName.value = record.room;
  } finally {
    loaded.value = true;
  }
});
</script>
