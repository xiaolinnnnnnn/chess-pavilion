<template>
  <main class="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-auto p-4 md:p-8">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold">开始一局</h1>
        <p class="mt-1.5 text-sm text-base-content/55">选择棋类，立即人机开战；或创建房间，等待好友落座</p>
      </div>
      <div v-if="gameStore.player && !gameStore.player.isVisitor" class="flex items-center gap-2 rounded-xl bg-base-200 px-4 py-2">
        <span class="text-xs text-base-content/55">积分</span>
        <span class="font-mono text-lg tabular-nums">{{ gameStore.player.points }}</span>
      </div>
    </header>

    <div v-if="gameStore.roomPlayer" class="panel flex flex-wrap items-center gap-3 px-4 py-3">
      <Icon icon="fluent:board-game-20-filled" class="text-2xl text-primary" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">你当前在房间「{{ gameStore.roomPlayer.room.name }}」</p>
        <p class="text-xs text-base-content/55">{{ myRoomStatusText }}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-primary" @click="enterMyRoom">进入房间</button>
        <button v-if="isMyRoomCreator" class="btn btn-sm" @click="manageVisible = true">管理房间</button>
        <button v-if="isMyRoomCreator" class="btn btn-sm btn-ghost btn-error" @click="disband">解散房间</button>
        <button v-if="!isMyRoomCreator" class="btn btn-sm btn-ghost" @click="leaveMyRoom">退出房间</button>
      </div>
    </div>

    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="(game, key) in gameStore.games"
        :key="key"
        class="panel group flex flex-col overflow-hidden transition-shadow duration-200 hover:shadow-[var(--shadow-popover)]"
      >
        <div class="h-32 w-full overflow-hidden border-b border-base-content/10 sm:h-28 md:h-32">
          <GameThumb :type="key" />
        </div>
        <div class="flex flex-1 flex-col gap-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">{{ game.name }}</h2>
            <span class="rounded-full bg-base-200 px-2.5 py-0.5 text-[11px] text-base-content/55">{{ game.minSize }} 人对局</span>
          </div>
          <p class="line-clamp-2 flex-1 text-sm leading-relaxed text-base-content/60">{{ game.description }}</p>
          <div class="mt-1 flex gap-2.5">
            <RouterLink
              v-if="game.ai === 'client'"
              :to="`/ai/${key}`"
              class="btn btn-sm btn-primary flex-1 gap-1.5"
            >
              <Icon icon="mdi:robot-happy-outline" class="text-base" />
              人机对战
            </RouterLink>
            <button
              v-else
              class="btn btn-sm flex-1"
              disabled
              title="该游戏暂不支持人机对战"
            >暂无人机</button>
            <button
              class="btn btn-sm flex-1 gap-1.5"
              @click="openJoin(key)"
            >
              <Icon icon="mdi:login-variant" class="text-base" />
              加入房间
            </button>
            <button
              class="btn btn-sm btn-primary flex-1 gap-1.5"
              @click="openCreate(key)"
            >
              <Icon icon="mdi:plus-circle-outline" class="text-base" />
              创建房间
            </button>
          </div>
        </div>
      </article>
    </div>

    <dialog class="modal" :class="{ 'modal-open': joinVisible }">
      <div class="modal-box max-w-sm p-0">
        <div class="flex items-center justify-between border-b border-base-content/10 px-5 py-4">
          <div>
            <h3 class="text-base font-semibold">加入房间</h3>
            <p v-if="joinGameName" class="mt-0.5 text-xs text-base-content/55">{{ joinGameName }}</p>
          </div>
          <button class="btn btn-sm btn-ghost btn-square" aria-label="关闭" @click="closeJoin">✕</button>
        </div>
        <form class="space-y-4 px-5 py-4" @submit.prevent="submitJoin">
          <div class="field field-row">
            <label class="label" for="join-room-name">房间名称</label>
            <el-input
              id="join-room-name"
              ref="joinNameRef"
              v-model.trim="joinName"
              class="w-full"
              placeholder="请输入房间名称"
              autocomplete="off"
            />
          </div>
          <PasswordField v-model="joinPwd" label="房间密码" placeholder="可选" autocomplete="off" />
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" class="btn btn-sm btn-ghost" @click="closeJoin">取消</button>
            <button type="submit" class="btn btn-sm btn-primary min-w-[6em]" :disabled="!joinName">加入房间</button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop bg-black/50" @click="closeJoin"></div>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': !!createType }">
      <div v-if="createGame" class="modal-box max-h-[85vh] max-w-lg p-0">
        <div class="flex items-center justify-between border-b border-base-content/10 px-5 py-4">
          <h3 class="text-base font-semibold">创建房间 · {{ createGame.name }}</h3>
          <button class="btn btn-sm btn-ghost btn-square" aria-label="关闭" @click="createType = ''">✕</button>
        </div>
        <div class="overflow-y-auto p-5" style="max-height: calc(85vh - 7rem)">
          <CreateRoom :fixed-type="createType" @created="createType = ''" />
        </div>
      </div>
      <div class="modal-backdrop bg-black/50" @click="createType = ''"></div>
    </dialog>

    <RoomManagementDrawer v-model:visible="manageVisible" :room="gameStore.roomPlayer?.room ?? null" />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { InputInstance } from 'element-plus';
import { useRouter } from 'vue-router';
import { md5 } from 'js-md5';
import { useGameStore } from '@/stores/game';
import msg from '@/components/msg';
import { confirm } from '@/components/msgbox';
import RoomManagementDrawer from '@/components/common/RoomManagementDrawer.vue';
import PasswordField from '@/components/common/PasswordField.vue';

const router = useRouter();
const gameStore = useGameStore();

const createType = ref('');
const manageVisible = ref(false);
const createGame = computed(() => (createType.value ? gameStore.games[createType.value] : null));
const isMyRoomCreator = computed(() => Boolean((gameStore.roomPlayer as any)?.isCreator));

// ---------------- 加入房间弹窗（首页入口：房间名称 + 密码，密码可留空） ----------------
const joinVisible = ref(false);
const joinType = ref('');
const joinName = ref('');
const joinPwd = ref('');
const joinNameRef = ref<InputInstance | null>(null);
const joinGameName = computed(() => (joinType.value ? gameStore.games[joinType.value]?.name ?? '' : ''));

function openJoin(key: string) {
  if (gameStore.player?.isVisitor) {
    msg.info('游客仅支持观战与人机，登录后即可加入房间');
    gameStore.showLoginModal = true;
    return;
  }
  if (gameStore.roomPlayer) {
    msg.warning('你已在房间中，请先退出当前房间');
    return;
  }
  joinType.value = key;
  joinName.value = '';
  joinPwd.value = '';
  joinVisible.value = true;
  nextTick(() => joinNameRef.value?.focus());
}

function closeJoin() {
  joinVisible.value = false;
}

function submitJoin() {
  const input = joinName.value;
  if (!input) return;
  // 同名房间唯一：仅按房间名称在对应棋类内查找（已去除房间码机制）
  const target = gameStore.rooms.find(
    (r) => r.attrs?.type === joinType.value && r.name === input,
  );
  if (!target) {
    msg.error('房间不存在，请检查房间名称');
    return;
  }
  if (target.attrs?.passwd && target.attrs.passwd !== md5(joinPwd.value)) {
    msg.error('房间密码错误，请重新输入');
    return;
  }
  if (target.status === 'playing') {
    msg.error('该房间对局进行中，可前往游戏大厅观战');
    return;
  }
  const seated = target.players.filter((p) => p.role === 'player').length;
  if (target.size !== 0 && seated >= target.size) {
    msg.error('该房间已满员，可前往游戏大厅观战');
    return;
  }
  // 验证通过后预存密码，useRoom 加入时不再二次弹窗
  gameStore.setJoinPasswd(target.id, joinPwd.value);
  closeJoin();
  router.push(`/r/${target.id}`);
}

async function disband() {
  const rp = gameStore.roomPlayer;
  if (!rp) return;
  const ok = await confirm('解散房间将把房间从大厅移除，所有成员会被移出，确定解散吗？', '解散房间', { confirmText: '解散房间', danger: true });
  if (!ok) return;
  manageVisible.value = false;
  gameStore.disbandRoom(rp.room.id);
}

function openCreate(key: string) {
  if (gameStore.player?.isVisitor) {
    msg.info('游客仅支持人机对战，登录后即可创建房间');
    gameStore.showLoginModal = true;
    return;
  }
  if (gameStore.roomPlayer) {
    msg.warning('你已在房间中，请先在退出当前房间后再新建');
    return;
  }
  createType.value = key;
}

const myRoomStatusText = computed(() => {
  const rp = gameStore.roomPlayer;
  if (!rp) return '';
  const typeName = gameStore.games[rp.room.attrs?.type]?.name ?? '对战';
  if (rp.role === 'watcher') return `${typeName} · 正在观战，可随时落座或退出`;
  if (rp.room.status === 'playing') return `${typeName} · 对局进行中`;
  return `${typeName} · 等待对手加入，可分享房间邀请好友`;
});

function enterMyRoom() {
  if (!gameStore.roomPlayer) return;
  router.push(`/r/${gameStore.roomPlayer.room.id}`);
}

async function leaveMyRoom() {
  const rp = gameStore.roomPlayer;
  if (!rp) return;
  const isPlaying = rp.room.status === 'playing' && rp.role === 'player';
  const ok = await confirm(isPlaying ? '对局进行中，退出房间将判负，确定退出吗？' : `确定退出房间「${rp.room.name}」吗？`, '退出房间', { confirmText: '退出房间', danger: isPlaying });
  if (!ok) return;
  // 标记主动退出，避免 leave 事件被误判为被踢
  gameStore.markSelfLeave(rp.room.id);
  gameStore.game?.leaveRoom(rp.room.id);
  msg.success(`已退出房间「${rp.room.name}」`);
}
</script>
