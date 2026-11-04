<template>
  <main v-if="!gameStore.roomPlayer" class="flex w-full flex-1 items-center justify-center bg-base-100">
    <span class="text-sm text-base-content/40">正在加载房间…</span>
  </main>
  <section v-else class="flex h-full w-full flex-col">
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-base-content/10 px-3 py-2 md:px-4">
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="truncate text-base font-medium">{{ gameStore.roomPlayer.room.name }}</h3>
        <span class="rounded-full bg-base-200 px-2 py-0.5 text-[11px] text-base-content/50">
          {{ gameStore.roomPlayer.room.attrs?.type ? gameStore.games[gameStore.roomPlayer.room.attrs.type]?.name : '' }}
        </span>
      </div>
      <RoomControls v-if="gameStore.game" :game="gameStore.game" :room-player="gameStore.roomPlayer">
        <component
          v-if="gameStore.roomPlayer && ComponentRoomControls"
          :is="ComponentRoomControls"
          :game="gameStore.game"
          :room-player="gameStore.roomPlayer"
        />
        <button class="btn btn-sm btn-outline btn-error ml-1" @click="handleExit">
          <Icon icon="mdi:logout" class="text-sm" />
          退出房间
        </button>
      </RoomControls>
    </header>

    <div class="flex-1 overflow-auto md:p-4">
      <component
        v-if="gameStore.roomPlayer.room.attrs?.type && ComponentRoom"
        :is="ComponentRoom"
        :game="gameStore.game"
        :room-player="gameStore.roomPlayer"
        @loaded="loaded"
      />
    </div>
  </section>

  <dialog class="modal" :class="{ 'modal-open': !!passwdPending }">
    <div v-if="passwdPending" class="modal-box max-w-sm p-0">
      <form method="dialog" @submit.prevent="submitRoomPasswd">
        <div class="border-b border-base-content/10 px-5 py-4">
          <h3 class="text-base font-semibold">进入房间</h3>
          <p class="mt-0.5 truncate text-xs text-base-content/55">
            【{{ gameStore.games[passwdPending.room.attrs?.type]?.name }}】{{ passwdPending.room.name }} 设置了密码
          </p>
        </div>
        <div class="field field-row px-5 py-4">
          <label class="label" for="room-passwd-input">房间密码</label>
          <el-input
            id="room-passwd-input"
            ref="roomPasswdRef"
            v-model="roomPasswd"
            type="password"
            show-password
            class="w-full"
            placeholder="请输入房间密码"
            autocomplete="off"
            :aria-invalid="!!roomPasswdError"
            @keyup.enter="submitRoomPasswd"
          />
          <p v-if="roomPasswdError" class="field-error"><Icon icon="mdi:alert-circle-outline" />{{ roomPasswdError }}</p>
        </div>
        <div class="flex justify-end gap-2 border-t border-base-content/10 px-5 py-3">
          <button type="button" class="btn btn-sm btn-ghost" @click="dismissPasswd">取消</button>
          <button type="submit" class="btn btn-sm btn-primary min-w-[6em]" :disabled="!roomPasswd">加入房间</button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop bg-black/50" @click="dismissPasswd"></div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { InputInstance } from 'element-plus';
import { useRouter } from 'vue-router';
import { getComponent } from '@/components';
import { useRoom } from '@/hook/useRoom';
import RoomControls from '@/components/common/RoomControls.vue';
import Icon from '@/components/common/Icon.vue';
import { confirm } from '@/components/msgbox';

const router = useRouter();
const { gameStore, passwdPending, submitPasswd, cancelPasswd } = useRoom();

const roomPasswd = ref('');
const roomPasswdError = ref('');
const roomPasswdRef = ref<InputInstance | null>(null);

watch(passwdPending, (pending) => {
  if (!pending) return;
  roomPasswd.value = '';
  roomPasswdError.value = '';
  nextTick(() => roomPasswdRef.value?.focus());
});

function submitRoomPasswd() {
  if (!roomPasswd.value) return;
  if (!submitPasswd(roomPasswd.value)) {
    roomPasswdError.value = '密码错误，请重新输入';
    return;
  }
  roomPasswd.value = '';
  roomPasswdError.value = '';
}

function dismissPasswd() {
  cancelPasswd();
}

const ComponentRoom = computed(() => getComponent(gameStore.roomPlayer?.room.attrs?.type, 'Room'));
const ComponentRoomControls = computed(() => getComponent(gameStore.roomPlayer?.room.attrs?.type, 'RoomControls'));

function loaded() {
  gameStore.game!.init(gameStore.roomPlayer!.room.id, gameStore.player!.player);
}

async function handleExit() {
  const rp = gameStore.roomPlayer;
  const room = rp?.room;
  if (!room || !rp) return;
  // 房主退出 = 解散房间：成员全部强制移出
  if ((rp as any).isCreator) {
    const ok = await confirm(
      '你当前为房主，退出后该房间将解散，所有成员会被强制移出，确定退出吗？',
      '退出房间',
      { confirmText: '退出并解散', danger: true },
    );
    if (!ok) return;
    gameStore.disbandRoom(room.id);
    return;
  }
  const isPlaying = room.status === 'playing' && rp.role === 'player';
  const message = isPlaying
    ? '对局进行中，退出房间将判负，确定退出吗？'
    : '确定退出当前房间吗？';
  const ok = await confirm(message, '退出房间', { confirmText: '退出房间', danger: isPlaying });
  if (!ok) return;
  // 标记主动退出，避免 leave 事件被误判为被踢而重复提示
  gameStore.markSelfLeave(room.id);
  gameStore.game?.leaveRoom(room.id);
  router.push('/');
}
</script>
