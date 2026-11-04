<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[600] flex items-start justify-center overflow-y-auto p-4 pt-[15vh]">
      <div class="fixed inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden="true"></div>

      <div
        role="dialog"
        aria-modal="true"
        class="relative w-full max-w-md rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
        style="box-shadow: 0 20px 40px -12px rgba(15,23,42,.2), 0 8px 16px -8px rgba(15,23,42,.1)"
      >
        <header class="mb-4 flex items-start justify-between gap-4">
          <h2 class="text-base font-semibold leading-6">{{ title }}</h2>
          <button class="icon-btn -mr-1 -mt-1 text-base-content/40 hover:text-base-content" aria-label="关闭" @click="handleCancel">
            <Icon icon="mdi:close" class="text-lg" />
          </button>
        </header>

        <div class="text-sm leading-relaxed text-base-content/70">
          <div v-if="isString && message" class="whitespace-pre-wrap">{{ message }}</div>
          <slot v-if="!isString" />
          <el-input
            v-if="showInput"
            v-model="internalInputValue"
            class="mt-2 w-full"
            :type="inputType"
            :show-password="inputType === 'password'"
            :placeholder="inputPlaceholder"
            @keyup.enter="handleConfirm"
          />
        </div>

        <footer class="mt-6 flex justify-end gap-3">
          <button v-if="showCancel" class="btn btn-outline" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn" :class="danger ? 'btn-error' : 'btn-primary'" @click="handleConfirm">{{ confirmText }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    title?: string;
    message?: string | object;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    showInput?: boolean;
    inputPlaceholder?: string;
    inputValue?: string;
    inputType?: string;
  }>(),
  {
    visible: false,
    title: '提示',
    message: '',
    showCancel: true,
    confirmText: '确定',
    cancelText: '取消',
    danger: false,
    showInput: false,
    inputPlaceholder: '',
    inputValue: '',
    inputType: 'text',
  },
);

const emit = defineEmits(['confirm', 'cancel', 'close']);

const isString = computed(() => typeof props.message === 'string');
const internalInputValue = ref(props.inputValue);

function handleConfirm() {
  emit('confirm', props.showInput ? internalInputValue.value : true);
}

function handleCancel() {
  emit('cancel');
}
</script>
