<script setup lang="ts">
import { onMounted } from 'vue';

const attrs = defineModel<{ countDownWay?: number; firstMoveWay?: string }>('attrs', {
  default: () => ({ countDownWay: 0, firstMoveWay: 'random' }),
});

onMounted(() => {
  if (attrs.value.countDownWay === undefined) attrs.value.countDownWay = 0;
  if (!attrs.value.firstMoveWay) attrs.value.firstMoveWay = 'random';
});
</script>

<template>
  <div class="form-control w-full">
    <label class="label"><span class="label-text">每步限时</span></label>
    <el-select v-model="attrs.countDownWay" class="w-full">
      <el-option :value="0" label="不限时" />
      <el-option :value="30" label="30 秒 / 步" />
      <el-option :value="60" label="60 秒 / 步" />
    </el-select>
  </div>
  <div class="form-control w-full">
    <label class="label"><span class="label-text">先后手</span></label>
    <el-select v-model="attrs.firstMoveWay" class="w-full">
      <el-option value="random" label="随机" />
      <el-option value="creator" label="房主先手" />
      <el-option value="joiner" label="加入者先手" />
    </el-select>
  </div>
</template>
