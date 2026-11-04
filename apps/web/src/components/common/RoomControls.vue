<template>
  <div class="flex flex-row items-center gap-2 md:gap-3">
    <!-- Waiting: Player Actions -->
    <template v-if="!isPlaying && roomPlayer.role === PlayerRole.player">
      <button class="btn btn-circle md:btn-lg btn-soft tooltip tooltip-left"
        @click="game?.leaveSeat(roomPlayer.room.id)"
        :disabled="roomPlayer.isReady"
        data-tip="离开座位"
      >
        <Icon icon="mdi:gamepad-off" />
      </button>
      <button class="btn btn-accent md:btn-lg btn-circle tooltip tooltip-left"
        @click="game?.ready(roomPlayer.room.id, !roomPlayer.isReady)"
        :data-tip="roomPlayer.isReady ? '取消' : '准备'"
      >
        <Icon :icon="roomPlayer.isReady ? 'mdi:close' : 'mdi:check'" />
      </button>
      <button class="btn btn-primary md:btn-lg btn-circle tooltip tooltip-left"
        @click="game?.startGame(roomPlayer.room.id)"
        :disabled="!isAllReady"
        data-tip="开始游戏"
      >
        <Icon icon="mdi:play" />
      </button>
    </template>

    <!-- Watcher Actions -->
    <template v-if="roomPlayer.role === PlayerRole.watcher">
      <button class="btn btn-circle md:btn-lg btn-soft tooltip tooltip-left"
        v-if="!isRoomFull && !isPlaying && !gameStore.player?.isVisitor"
        @click="game?.joinRoom(roomPlayer.room.id)"
        data-tip="加入游戏"
      >
        <Icon icon="mdi:google-gamepad" />
      </button>
    </template>

    <button
      v-if="!gameStore.player?.isVisitor"
      class="btn btn-circle md:btn-lg btn-primary tooltip tooltip-left"
      @click="shareRoom"
      data-tip="分享房间"
    >
      <Icon icon="mdi:share-variant" />
    </button>

    <!-- Extra Slot -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { GameCore } from '@/core/game';
import { RoomPlayer, Room, PlayerRole, RoomStatus } from '@yige/engine/client';
import { useGameStore } from '@/stores/game';
import { computed } from 'vue';
import msg from '@/components/msg';

const props = defineProps<{
  roomPlayer: RoomPlayer & { room: Room },
  game: GameCore,
}>();

const gameStore = useGameStore();
const isPlaying = computed(() => props.roomPlayer.room.status === RoomStatus.playing);
const isAllReady = computed(() => {
  if (!props.roomPlayer) return false;
  const minPlayers = props.roomPlayer.room.minSize === 0 ? 1 : props.roomPlayer.room.minSize;
  const hasEnoughPlayers = props.roomPlayer.room.players.filter((p: any) => p.role === 'player').length >= minPlayers;
  if (!props.roomPlayer.room.requireAllReadyToStart) return hasEnoughPlayers;
  return hasEnoughPlayers && props.roomPlayer.room.players.every((p: any) => p.isReady || p.role === 'watcher');
});
const isRoomFull = computed(() => {
  if (!props.roomPlayer) return true;
  if (props.roomPlayer.room.size === 0) return false;
  return props.roomPlayer.room.players.filter((p: any) => p.role === 'player').length >= props.roomPlayer.room.size;
});

/** 分享房间网页链接：点击自动进入房间，有密码弹窗输入，无密码直接加入 */
async function shareRoom() {
  const id = gameStore.roomPlayer?.room.id ?? props.roomPlayer.room.id;
  const link = `${location.origin}${location.pathname}#/r/${id}`;
  try {
    await navigator.clipboard.writeText(link);
    msg.success('房间链接已复制，好友点击链接即可进入房间');
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = link;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    msg.success('房间链接已复制');
  }
}
</script>

<style lang="less" scoped>
  .btn {
    --size: 2em;
  }
  :deep(.btn) {
    --size: 2em;
  }
</style>
