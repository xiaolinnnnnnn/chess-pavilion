<template>
  <div class="panel p-6 sm:p-8">
    <header class="mb-6 flex items-center gap-3">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon icon="mdi:chess-knight" class="text-2xl" />
      </div>
      <div>
        <h1 class="text-xl font-semibold leading-tight">弈阁</h1>
      </div>
    </header>

    <div role="tablist" class="tabs tabs-box mb-6 grid grid-cols-2">
      <button role="tab" class="tab" :class="{ 'tab-active': mode === 'login' }" @click="switchMode('login')">登录</button>
      <button role="tab" class="tab" :class="{ 'tab-active': mode === 'register' }" @click="switchMode('register')">注册</button>
    </div>

    <form class="space-y-4" novalidate autocomplete="off" @submit.prevent="submit">
      <div class="field field-row">
        <label class="label" for="auth-username">用户名</label>
        <el-input
          id="auth-username"
          ref="usernameRef"
          v-model.trim="username"
          autocomplete="off"
          name="login-username"
          class="w-full"
          placeholder="3-20 位字母、数字、下划线或中文"
          :aria-invalid="!!errors.username"
          @keyup.enter="submit"
        />
        <p v-if="errors.username" class="field-error"><Icon icon="mdi:alert-circle-outline" />{{ errors.username }}</p>
      </div>

      <PasswordField
        v-model="password"
        label="密码"
        :placeholder="mode === 'login' ? '请输入密码' : '8-16 位，包含字母和数字'"
        :error="errors.password"
        autocomplete="new-password"
        @enter="submit"
      />

      <PasswordField
        v-if="mode === 'register'"
        v-model="confirm"
        label="确认密码"
        placeholder="再次输入密码"
        :error="errors.confirm"
        autocomplete="new-password"
        @enter="submit"
      />

      <button class="btn btn-primary btn-block" :disabled="loading">
        <span v-if="loading" class="loading loading-spinner loading-xs"></span>
        {{ mode === 'login' ? '登录' : '创建账号' }}
      </button>
    </form>

    <div class="my-6 flex items-center gap-3 text-xs text-base-content/30">
      <span class="h-px flex-1 bg-base-content/10"></span>
      或
      <span class="h-px flex-1 bg-base-content/10"></span>
    </div>

    <button class="btn btn-ghost btn-block" :disabled="loading" @click="playAsGuest">以游客身份试玩</button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue';
import type { InputInstance } from 'element-plus';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useGameStore } from '@/stores/game';
import msg from '@/components/msg';
import PasswordField from './PasswordField.vue';

const router = useRouter();
const gameStore = useGameStore();

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const confirm = ref('');
const loading = ref(false);
const usernameRef = ref<InputInstance | null>(null);

const errors = reactive<{ username: string; password: string; confirm: string }>({
  username: '',
  password: '',
  confirm: '',
});

const emit = defineEmits<{ (e: 'success'): void }>();

function switchMode(next: 'login' | 'register') {
  mode.value = next;
  Object.keys(errors).forEach((k) => ((errors as any)[k] = ''));
  nextTick(() => usernameRef.value?.focus());
}

function validateField(field: 'username' | 'password' | 'confirm') {
  if (field === 'username') {
    if (!username.value) errors.username = '请输入用户名';
    else if (!/^[\w\u4e00-\u9fa5]{3,20}$/.test(username.value)) errors.username = '用户名需为 3-20 位字母、数字、下划线或中文';
    else errors.username = '';
  }
  if (field === 'password') {
    if (!password.value) errors.password = mode.value === 'login' ? '请输入密码' : '请设置密码';
    // 登录只做非空校验，长度与复杂度限制属于注册流程
    else if (mode.value === 'register' && (password.value.length < 8 || password.value.length > 16)) errors.password = '密码长度需在 8-16 位之间';
    else if (mode.value === 'register' && !/(?=.*[A-Za-z])(?=.*\d)/.test(password.value)) errors.password = '密码需同时包含字母和数字';
    else errors.password = '';
  }
  if (field === 'confirm') {
    if (!confirm.value) errors.confirm = '请再次输入密码';
    else if (confirm.value !== password.value) errors.confirm = '两次输入的密码不一致';
    else errors.confirm = '';
  }
}

function validateAll() {
  validateField('username');
  validateField('password');
  if (mode.value === 'register') validateField('confirm');
  return !errors.username && !errors.password && (mode.value === 'login' || !errors.confirm);
}

async function submit() {
  if (loading.value) return;
  if (!validateAll()) {
    const first = errors.username || errors.password || errors.confirm;
    if (first) msg.error(first);
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await gameStore.login(username.value, password.value);
      msg.success('登录成功，欢迎回来！');
    } else {
      await gameStore.register(username.value, password.value);
      msg.success('账号创建成功！');
    }
    emit('success');
    router.push('/');
  } catch (err) {
    msg.error((err as Error).message || '操作失败，请稍后再试');
  } finally {
    loading.value = false;
  }
}

async function playAsGuest() {
  loading.value = true;
  try {
    await gameStore.loginVisitor();
    emit('success');
    router.push('/');
  } catch (err) {
    msg.error((err as Error).message || '游客进入失败，请稍后再试');
  } finally {
    loading.value = false;
  }
}
</script>
