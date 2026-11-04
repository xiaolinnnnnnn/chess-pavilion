<template>
  <div class="pointer-events-none fixed left-1/2 top-5 z-[9999] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-stretch gap-2.5">
    <transition-group name="msg">
      <div v-for="m in messages" :key="m.id" class="pointer-events-auto">
        <div
          role="alert"
          class="flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-[0_8px_24px_-6px_rgba(15,23,42,.25)]"
          :class="typeClass(m.type)"
        >
          <Icon :icon="typeIcon(m.type)" class="flex-none text-lg" />
          <div class="min-w-0 flex-1 break-words leading-snug">{{ m.content }}</div>
          <button class="btn btn-ghost btn-xs btn-square -mr-1.5 flex-none opacity-60 hover:opacity-100" aria-label="关闭" @click="close(m.id)">
            <Icon icon="mdi:close" class="text-sm" />
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

type MsgType = 'success' | 'info' | 'warning' | 'error';
type Msg = { id: number; type: MsgType; content: string; duration: number; onClose?: () => void };

const messages = ref<Msg[]>([]);
let idSeq = 1;

function typeClass(type: MsgType) {
  // 不透明实底配色：成功绿 / 警告黄 / 错误红 / 信息中性
  switch (type) {
    case 'success':
      return 'bg-success text-success-content';
    case 'warning':
      return 'bg-warning text-warning-content';
    case 'error':
      return 'bg-error text-error-content';
    default:
      return 'bg-neutral text-neutral-content';
  }
}

function typeIcon(type: MsgType) {
  switch (type) {
    case 'success':
      return 'mdi:check-circle';
    case 'warning':
      return 'mdi:alert-circle';
    case 'error':
      return 'mdi:close-circle';
    default:
      return 'mdi:information';
  }
}

function add(payload: Omit<Msg, 'id'>) {
  const id = idSeq++;
  const msg: Msg = { id, ...payload };
  messages.value.push(msg);

  if (msg.duration > 0) {
    setTimeout(() => {
      remove(id);
    }, msg.duration);
  }

  return id;
}

function remove(id: number) {
  const idx = messages.value.findIndex((m) => m.id === id);
  if (idx !== -1) {
    const [m] = messages.value.splice(idx, 1);
    if (m.onClose) m.onClose();
  }
}

function close(id: number) {
  remove(id);
}

defineExpose({ add, remove });
</script>

<style scoped>
.msg-enter-from { opacity: 0; transform: translateY(-14px); }
.msg-enter-active { transition: all 220ms ease; }
.msg-leave-to { opacity: 0; transform: translateY(-10px); }
.msg-leave-active { transition: all 180ms ease; position: absolute; left: 0; right: 0; }
</style>
