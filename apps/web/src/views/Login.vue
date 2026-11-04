<template>
  <div class="flex min-h-screen items-center justify-center bg-base-200/60 px-4 py-10">
    <div class="w-full max-w-sm">
      <LoginCard />
      <p class="mt-6 text-center text-xs text-base-content/40">
        弈阁 · 安静下棋的地方
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import LoginCard from '@/components/common/LoginCard.vue';
</script>
