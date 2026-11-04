<template>
  <div class="panel p-5">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-base font-semibold">创建房间</h2>
      <span v-if="game?.name" class="rounded-full bg-base-content/5 px-2.5 py-0.5 text-xs text-base-content/50">{{ game.name }}</span>
    </div>

    <form class="space-y-4" novalidate autocomplete="off" @submit.prevent="createRoom">
      <div class="field field-row">
        <label class="label" for="room-name">房间名称</label>
        <el-input
          id="room-name"
          v-model.trim="form.name"
          class="w-full"
          placeholder="请输入房间名称"
          autocomplete="off"
          :aria-invalid="!!nameError"
          @blur="validateName"
        />
        <p v-if="nameError" class="field-error"><Icon icon="mdi:alert-circle-outline" />{{ nameError }}</p>
      </div>

      <div v-if="!fixedType" class="field field-row">
        <label class="label" for="room-game">游戏</label>
        <el-select id="room-game" v-model="form.type" class="w-full" @change="applyDefaults">
          <el-option v-for="(item, key) in gameStore.games" :key="key" :label="item.name" :value="key" />
        </el-select>
      </div>

      <p v-if="game?.description" class="rounded-lg bg-base-content/5 px-3 py-2 text-xs leading-relaxed text-base-content/60">
        {{ game.description }}
      </p>

      <div v-if="fields.length" class="grid gap-4 sm:grid-cols-2">
        <div v-for="field in fields" :key="field.key" class="field field-row">
          <label class="label" :for="'room-field-' + field.key">{{ field.label }}</label>
          <el-select v-if="field.type === 'select'" :id="'room-field-' + field.key" v-model="form.attrs[field.key]" class="w-full">
            <el-option v-for="option in field.options" :key="String(option.value)" :label="option.label" :value="option.value" />
          </el-select>
          <el-input
            v-else-if="field.type === 'number'"
            :id="'room-field-' + field.key"
            v-model.number="form.attrs[field.key]"
            type="number"
            class="w-full"
          />
          <input
            v-else
            :id="'room-field-' + field.key"
            v-model="form.attrs[field.key]"
            type="checkbox"
            class="toggle toggle-sm"
            :checked="Boolean(form.attrs[field.key])"
            @change="form.attrs[field.key] = ($event.target as HTMLInputElement).checked"
          />
          <span v-if="field.help" class="field-hint">{{ field.help }}</span>
        </div>
      </div>

      <PasswordField
        v-model="form.passwd"
        label="房间密码"
        placeholder="留空则公开，创建后不可修改"
        autocomplete="new-password"
      />

      <button class="btn btn-primary btn-block" type="submit">创建房间</button>

      <p v-if="gameStore.player?.isVisitor" class="field-hint text-center">创建房间需要登录账号，游客可体验人机对战。</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useGameStore } from '@/stores/game';
import msg from '@/components/msg';
import PasswordField from './PasswordField.vue';
import type { GameSettingField } from '@/types';

const props = defineProps<{ fixedType?: string }>();
const emit = defineEmits<{ (e: 'created'): void }>();

const gameStore = useGameStore();

const form = reactive({
  name: '',
  type: props.fixedType ?? '',
  passwd: '',
  attrs: {} as Record<string, any>,
});

const nameError = ref('');

const game = computed(() => gameStore.games[form.type]);
const fields = computed<GameSettingField[]>(() => game.value?.settings ?? []);

/**
 * 字段初始值：下拉栏一律取「该下拉栏的第一项」，其余类型沿用服务端 schema 的 default。
 * 与 el-select 的选项顺序保持一致，避免出现 Select 占位符。
 */
function fieldDefault(field: GameSettingField) {
  if (field.type === 'select' && field.options?.length) return field.options[0].value;
  return field.default;
}

function applyDefaults() {
  const next: Record<string, any> = {};
  for (const field of fields.value) next[field.key] = fieldDefault(field);
  form.attrs = next;
}

// fields 异步就绪（游戏列表晚于 type 初始化）时补齐默认值，避免 select 无选中项
watch(
  fields,
  () => {
    for (const field of fields.value) if (form.attrs[field.key] === undefined) form.attrs[field.key] = fieldDefault(field);
  },
  { immediate: true },
);

function validateName() {
  if (!form.name.trim()) nameError.value = '请填写房间名称';
  else if (form.name.length > 20) nameError.value = '房间名称最多 20 个字符';
  else nameError.value = '';
  return !nameError.value;
}

watch(
  () => Object.keys(gameStore.games).length,
  () => {
    if (!form.type && Object.keys(gameStore.games).length) {
      form.type = props.fixedType ?? Object.keys(gameStore.games)[0];
      applyDefaults();
    }
  },
  { immediate: true },
);

watch(
  () => props.fixedType,
  (val) => {
    if (val) {
      form.type = val;
      applyDefaults();
    }
  },
);

async function createRoom() {
  if (!validateName()) {
    if (nameError.value) msg.error(nameError.value);
    return;
  }
  if (gameStore.player?.isVisitor) {
    msg.warning('当前无法创建房间，请先登录账号');
    return;
  }
  if (gameStore.roomPlayer) {
    msg.warning('你已在房间中，请先在首页顶部退出当前房间');
    return;
  }
  if (gameStore.rooms.some((room) => room.name === form.name)) {
    nameError.value = '同名房间已存在，请换个名称';
    return;
  }

  await gameStore.game?.createRoom({
    name: form.name,
    size: game.value?.maxSize ?? 2,
    minSize: game.value?.minSize ?? 2,
    attrs: { type: form.type, passwd: form.passwd, ...form.attrs },
  });
  msg.success(`房间「${form.name}」已创建，等待对手加入`);
  emit('created');
}
</script>
