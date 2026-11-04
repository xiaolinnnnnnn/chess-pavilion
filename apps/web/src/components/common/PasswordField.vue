<template>
  <div class="field-row">
    <label v-if="label" class="label" :for="inputId">{{ label }}</label>
    <el-input
      :id="inputId"
      v-model="model"
      type="password"
      show-password
      class="w-full"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      @keyup.enter="$emit('enter')"
    />
    <p v-if="error" class="field-error"><Icon icon="mdi:alert-circle-outline" />{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    label?: string;
    placeholder?: string;
    error?: string;
    autocomplete?: string;
  }>(),
  { label: '密码', placeholder: '请输入密码', error: '', autocomplete: 'off' },
);

defineEmits<{ (e: 'enter'): void }>();

const model = defineModel<string>({ default: '' });
const inputId = useId();
</script>
