<template>
  <section class="flex h-full min-h-0 flex-col gap-2 overflow-auto md:flex-row md:gap-3 md:overflow-hidden">
 
    <div class="relative flex min-h-[58vh] w-full flex-col md:min-h-0 md:min-w-0 md:flex-1">
      <div class="flex min-h-0 flex-1 flex-row">
        <div v-if="$slots.actions" class="flex flex-none flex-col items-stretch justify-center gap-2 p-2 md:p-3">
          <slot name="actions" :isPlaying="isPlaying"></slot>
        </div>
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <slot></slot>
        </div>
      </div>
    </div>

    <aside
      v-if="!lite"
      class="flex w-full flex-none flex-col gap-2 border-t border-base-content/10 pt-2 md:h-full md:w-96 md:border-l md:border-t-0 md:pl-3 md:pt-0"
    >

      <div class="rounded-xl border border-base-content/10 bg-base-100">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
          @click="playersOpen = !playersOpen"
        >
          <span class="flex items-center gap-2">
            <Icon icon="fluent:people-20-filled" class="text-base text-primary" />
            对战玩家
            <span class="rounded-full bg-base-200 px-1.5 text-[11px] text-base-content/60">{{ players.length }} / {{ roomPlayer.room.size || players.length }}</span>
          </span>
          <Icon :icon="playersOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="text-base text-base-content/50" />
        </button>
        <div v-show="playersOpen" class="space-y-1 px-2 pb-2">
          <div
            v-for="p in players"
            :key="p.id"
            class="flex items-center justify-between gap-2 rounded-lg bg-base-200/60 px-2.5 py-1.5"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-base-300 text-[11px] font-bold">
                <img v-if="p.attributes?.avatar" :src="p.attributes.avatar" class="h-full w-full object-cover" />
                <span v-else>{{ p.name.slice(0, 1) }}</span>
              </span>
              <span class="truncate text-sm">{{ p.name }}</span>
              <Icon v-if="p.isCreator" icon="bxs:crown" class="text-sm text-warning" title="房主" />
            </span>
            <span class="status-pill flex-none" :class="statusClass(displayStatus(p))">{{ displayStatus(p) }}</span>
          </div>
          <p v-if="!players.length" class="px-2 py-1 text-xs text-base-content/40">暂无玩家入座</p>
        </div>
      </div>

      <div class="rounded-xl border border-base-content/10 bg-base-100">
        <button
          class="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
          @click="watchersOpen = !watchersOpen"
        >
          <span class="flex items-center gap-2">
            <Icon icon="mdi:eye-outline" class="text-base text-base-content/60" />
            观战玩家
            <span class="rounded-full bg-base-200 px-1.5 text-[11px] text-base-content/60">{{ watchers.length }}</span>
          </span>
          <Icon :icon="watchersOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="text-base text-base-content/50" />
        </button>
        <div v-show="watchersOpen" class="space-y-1 px-2 pb-2">
          <div
            v-for="w in watchers"
            :key="w.id"
            class="flex items-center justify-between gap-2 rounded-lg bg-base-200/60 px-2.5 py-1.5"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-base-300 text-[11px] font-bold">
                <img v-if="w.attributes?.avatar" :src="w.attributes.avatar" class="h-full w-full object-cover" />
                <span v-else>{{ w.name.slice(0, 1) }}</span>
              </span>
              <span class="truncate text-sm">{{ w.name }}</span>
            </span>
            <span class="status-pill flex-none" :class="statusClass(displayStatus(w))">{{ displayStatus(w) }}</span>
          </div>
          <p v-if="!watchers.length" class="px-2 py-1 text-xs text-base-content/40">暂无观众观战</p>
        </div>
      </div>

      <GameChat v-if="chat" :canSend="canChat" class="min-h-0 flex-1" />
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RoomPlayer, Room } from '@yige/engine/client';
import { GameCore } from '@/core/game';
import { useGameEvents } from '@/hook/useGameEvents';
import GameChat from './GameChat.vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    roomPlayer: RoomPlayer & { room: Room };
    game: GameCore;
    /** 自定义玩家状态显示 */
    playerStatus?: (player: RoomPlayer) => string;
    /** 自定义围观者状态显示 */
    watcherStatus?: (player: RoomPlayer) => string;
    /** 是否显示聊天框 */
    chat?: boolean;
    /** 聊天框是否允许发送消息 */
    canChat?: boolean;
    /** 是否为简化模式（隐藏侧边栏） */
    lite?: boolean;
  }>(),
  { chat: true, lite: false, canChat: true },
);

const emit = defineEmits<{
  (e: 'command', msg: { type: string; data: any }): void;
  (e: 'loaded'): void;
}>();

useGameEvents(props.game, {
  'player.command': onCommand,
  'room.command': onCommand,
});

function onCommand(msg: { type: string; data: any }) {
  emit('command', msg);
}

const players = computed(() => props.roomPlayer.room.players.filter((p) => p.role === 'player'));
const watchers = computed(() => props.roomPlayer.room.players.filter((p) => p.role === 'watcher'));

const isPlaying = computed(
  () => props.roomPlayer.role === 'player' && props.roomPlayer.room.status === 'playing',
);

const playersOpen = ref(true);
const watchersOpen = ref(false);

function displayStatus(p: RoomPlayer): string {
  if (p.role === 'watcher') return props.watcherStatus?.(p) || '观战中';
  if (p.status === 'offline') return '已掉线';
  return props.playerStatus?.(p) || defaultStatus(p);
}

function defaultStatus(p: RoomPlayer): string {
  if (isPlaying.value) return '对局中';
  return p.isReady ? '已准备' : '未准备';
}

/** 不同状态渲染不同颜色，覆盖全部枚举状态 */
function statusClass(status: string): string {
  const map: Record<string, string> = {
    已准备: 'status-ready',
    未准备: 'status-idle',
    对局中: 'status-playing',
    落子中: 'status-playing',
    思考中: 'status-thinking',
    等待中: 'status-idle',
    观战中: 'status-watch',
    已离开: 'status-left',
    已掉线: 'status-offline',
    胜利: 'status-win',
    失败: 'status-loss',
  };
  return map[status] ?? 'status-idle';
}

onMounted(() => emit('loaded'));
</script>

<style scoped>
.status-pill {
  border-radius: 9999px;
  padding: 0.1rem 0.55rem;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
}
.status-ready { background: color-mix(in oklab, var(--color-success) 18%, transparent); color: var(--color-success); }
.status-idle { background: color-mix(in oklab, var(--color-base-content) 10%, transparent); color: color-mix(in oklab, var(--color-base-content) 60%, transparent); }
.status-playing { background: color-mix(in oklab, var(--color-primary) 16%, transparent); color: var(--color-primary); }
.status-thinking { background: color-mix(in oklab, var(--color-warning) 20%, transparent); color: var(--color-warning); }
.status-watch { background: color-mix(in oklab, var(--color-info) 18%, transparent); color: var(--color-info); }
.status-left { background: color-mix(in oklab, var(--color-warning) 20%, transparent); color: var(--color-warning); }
.status-offline { background: color-mix(in oklab, var(--color-error) 18%, transparent); color: var(--color-error); }
.status-win { background: color-mix(in oklab, var(--color-success) 22%, transparent); color: var(--color-success); }
.status-loss { background: color-mix(in oklab, var(--color-error) 20%, transparent); color: var(--color-error); }
</style>
