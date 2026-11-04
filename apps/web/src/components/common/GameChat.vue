<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2">
    <div ref="listRef" class="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-base-content/10 bg-base-200/40 p-3">
      <div
        v-for="(message, index) in messages"
        :key="index"
        class="flex flex-col text-sm"
        :class="message.sender?.id === roomPlayer?.id ? 'items-end' : 'items-start'"
      >
        <div v-if="message.sender" class="mb-0.5 flex gap-1 px-1 text-[10px] text-base-content/40">
          <span>{{ message.sender.name }}</span>
          <span v-if="(message.sender as RoomPlayer)?.role === PlayerRole.watcher">观众</span>
        </div>
        <div
          class="max-w-[85%] break-words rounded-2xl px-3 py-1.5"
          :class="{
            'rounded-tr-none bg-primary text-primary-content': message.sender?.id === roomPlayer?.id,
            'rounded-tl-none bg-base-100': message.sender && message.sender?.id !== roomPlayer?.id,
            'w-full rounded bg-base-200/60 py-1 text-center text-xs text-base-content/50': !message.sender,
          }"
        >
          {{ message.content }}
        </div>
      </div>
      <p v-if="!messages.length && !incoming && !outgoing" class="py-8 text-center text-xs text-base-content/30">还没有消息</p>

      <div v-if="incoming" class="flex flex-col items-start text-sm">
        <div class="mb-0.5 flex gap-1 px-1 text-[10px] text-base-content/40">
          <span>{{ incoming.from }}</span>
          <span>互动请求</span>
        </div>
        <div class="max-w-[92%] rounded-2xl rounded-tl-none border border-warning/40 bg-warning/10 px-3 py-2">
          <p class="text-[13px] leading-relaxed">
            {{ incoming.from }} 请求{{ incoming.label }}<template v-if="countdown > 0">，<span class="font-mono tabular-nums">{{ countdown }}s</span> 内未响应视为拒绝</template>
          </p>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-xs btn-primary" @click="answer(true)">同意</button>
            <button class="btn btn-xs btn-ghost" @click="answer(false)">拒绝</button>
          </div>
        </div>
      </div>

      <p v-else-if="outgoing" class="w-full rounded-2xl bg-base-200/60 px-3 py-1.5 text-center text-xs text-base-content/50">
        已向对手发起{{ outgoing }}请求，等待回应…
      </p>
    </div>

    <div class="flex-none space-y-1.5">
      <!-- 表情面板：点击面板外部或按 Esc 同样可以关闭 -->
      <div
        v-if="emojiOpen"
        ref="emojiPanelRef"
        class="max-h-56 overflow-y-auto rounded-xl border border-base-content/10 bg-base-100 p-2 shadow-lg"
      >
        <div v-for="group in emojiGroups" :key="group.label" class="mb-1 last:mb-0">
          <span class="mb-0.5 block px-0.5 text-[10px] text-base-content/35">{{ group.label }}</span>
          <div class="grid grid-cols-10 gap-0.5">
            <button
              v-for="emoji in group.list"
              :key="emoji"
              type="button"
              class="rounded-lg py-1 text-lg leading-none transition-colors hover:bg-base-200"
              @click="insertEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-stretch gap-1.5">
        <button
          ref="emojiBtnRef"
          class="btn btn-sm btn-ghost h-10 w-10 flex-none rounded-xl border border-base-content/10 px-0"
          title="表情"
          :class="{ 'btn-active': emojiOpen }"
          @click.stop="toggleEmoji"
        >
          <Icon icon="mdi:emoticon-happy-outline" class="text-lg" />
        </button>
        <el-input
          v-model="inputText"
          class="chat-input h-10 min-w-0 flex-1"
          input-class="h-full"
          :placeholder="canSend ? '说点什么…' : '当前无法发言'"
          :disabled="!canSend"
          maxlength="200"
          @keyup.enter="handleSend"
        />
        <button
          class="btn btn-sm btn-primary h-10 w-10 flex-none rounded-xl px-0"
          title="发送"
          :disabled="!canSend || !inputText.trim()"
          @click="handleSend()"
        >
          <Icon icon="mdi:send" class="text-lg" />
        </button>
      </div>

      <p v-if="roomPlayer && roomPlayer.role !== PlayerRole.player && roomPlayer.room.status === RoomStatus.playing" class="text-[11px] text-base-content/40">
        对局中，观众消息仅其他观众可见
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PlayerRole, RoomStatus, type RoomPlayer } from '@yige/engine/client';
import type { IMessage } from '..';
import Icon from './Icon.vue';
import { useGameStore } from '@/stores/game';
import { useGameEvents } from '@/hook/useGameEvents';
import type { GameCore } from '@/core/game';
import { clearIncoming, incoming, outgoing } from '@/stores/interaction';

const props = withDefaults(
  defineProps<{
    canSend?: boolean;
    placeholder?: string;
    customSend?: boolean;
  }>(),
  { canSend: true, placeholder: '说点什么…', customSend: false },
);

const emit = defineEmits<{ (e: 'send', text: string): void }>();

/** 表情分组：常用情绪 / 手势互动 / 棋局与庆祝 */
const emojiGroups = [
  {
    label: '常用',
    list: [
      '😀', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '😉', '😊',
      '😍', '🤩', '😘', '😜', '🤪', '🤔', '🤨', '😐', '😑', '😶',
      '🙄', '😏', '😒', '😔', '😞', '😢', '😭', '😤', '😠', '😡',
      '🤯', '😱', '😨', '😰', '😥', '😓', '🤗', '🤫', '🤭', '😴',
    ],
  },
  {
    label: '互动',
    list: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👏', '🙌', '🤝',
      '🙏', '💪', '👋', '🫡', '🫠', '🤝', '💯', '❓', '❗', '💤',
    ],
  },
  {
    label: '对局',
    list: [
      '♟️', '♞', '♜', '🎯', '🎲', '⚫', '⚪', '🔴', '🟢', '🟡',
      '🏆', '🥇', '🥈', '🥉', '🎉', '🎊', '🔥', '💥', '⭐', '✨',
      '🧠', '🍵', '☕', '🎵', '🌙', '☀️', '🚀', '🐣', '😎', '🤓',
    ],
  },
];

const inputText = ref('');
const emojiOpen = ref(false);
const emojiPanelRef = ref<HTMLElement | null>(null);
const emojiBtnRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const gameStore = useGameStore();

function toggleEmoji() {
  emojiOpen.value = !emojiOpen.value;
}

const game = computed(() => gameStore.game as GameCore);
const roomPlayer = computed(() => gameStore.roomPlayer);

function insertEmoji(emoji: string) {
  inputText.value = (inputText.value + emoji).slice(0, 200);
}

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
  });
}

function handleSend(event?: KeyboardEvent) {
  // 键盘回车透传原生事件：输入法组合态（拼音候选）不触发发送；
  // 点击发送按钮时没有事件对象，也要正常发送。
  if (event?.isComposing) return;
  const text = inputText.value.trim();
  if (!text || !roomPlayer.value || !props.canSend) return;
  inputText.value = '';
  emojiOpen.value = false;
  if (props.customSend) emit('send', text);
  else game.value?.command(roomPlayer.value.room.id, { type: 'say', data: text });
}

useGameEvents(game.value, {
  'player.message': onMessage,
  'room.message': onMessage,
  'player.command': onCommand,
});

const messages = ref<IMessage[]>([]);

function onMessage(message: IMessage) {
  messages.value.push(message);
  if (messages.value.length > 100) messages.value.shift();
  scrollToBottom();
}

function onCommand(cmd: any) {
  if (cmd.type !== 'status') return;
  messages.value = [...(cmd.data.messageHistory || [])].reverse();
  scrollToBottom();
}

// ---------------- 表情面板：点击其他位置 / Esc 关闭 ----------------
function onDocPointerDown(event: PointerEvent) {
  if (!emojiOpen.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (emojiPanelRef.value?.contains(target) || emojiBtnRef.value?.contains(target)) return;
  emojiOpen.value = false;
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && emojiOpen.value) emojiOpen.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onDocKeydown);
});

// ---------------- 互动请求（悔棋/和棋/重来）气泡 ----------------
const now = ref(Date.now());
let ticker: number | null = null;

const countdown = computed(() => {
  const req = incoming.value;
  if (!req?.expiresAt) return 0;
  return Math.max(0, Math.ceil((req.expiresAt - now.value) / 1000));
});

watch(
  () => incoming.value,
  (req) => {
    if (ticker) {
      window.clearInterval(ticker);
      ticker = null;
    }
    if (!req) return;
    scrollToBottom();
    if (!req.expiresAt) return;
    now.value = Date.now();
    ticker = window.setInterval(() => {
      now.value = Date.now();
      if (!incoming.value?.expiresAt || now.value >= incoming.value.expiresAt) {
        clearIncoming();
        if (ticker) {
          window.clearInterval(ticker);
          ticker = null;
        }
      }
    }, 500);
  },
);

function answer(agree: boolean) {
  const req = incoming.value;
  if (!req) return;
  incoming.value = null;
  req.reply(agree);
}

onBeforeUnmount(() => {
  if (ticker) window.clearInterval(ticker);
  incoming.value = null;
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onDocKeydown);
});
</script>

<style scoped>
/* EP 聊天输入：撑满 40px 行高、12px 圆角，与两侧按钮同廓 */
.chat-input :deep(.el-input__wrapper) {
  height: 100%;
  border-radius: 0.75rem;
}
</style>
