import { md5 } from 'js-md5';
import msg from "@/components/msg";
import { useGameEvents } from "@/hook/useGameEvents";
import { useGameStore } from "@/stores/game";
import { resetInteraction } from "@/stores/interaction";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Room } from "@yige/engine/client";

/** 链接直达时的房间密码挂起请求，由 Room.vue 渲染大厅同款精致弹窗消费 */
const passwdPending = ref<{ room: Room; resolve: (passwd: string | null) => void } | null>(null);

/** 房间查找的超时保护：失效链接不会再卡在「正在加载房间…」 */
const ROOM_LOOKUP_TIMEOUT = 3000;

export function useRoom() {
  const gameStore = useGameStore();
  const route = useRoute();
  const router = useRouter();

  const roomId = computed(() => (route.params.id as string));
  /** 已判定房间不存在，避免重复 toast / 重复跳转 */
  const aborted = ref(false);
  let lookupTimer: number | null = null;

  function clearLookupTimer() {
    if (lookupTimer !== null) {
      window.clearTimeout(lookupTimer);
      lookupTimer = null;
    }
  }

  /** 房间已解散/链接失效：提示后强制回大厅 */
  function failToLobby(message = '房间已解散或链接已失效') {
    if (aborted.value) return;
    aborted.value = true;
    clearLookupTimer();
    passwdPending.value = null;
    resetInteraction();
    msg.error(message);
    router.replace(route.name === 'lite-room' ? '/lite' : '/');
  }

  async function init() {
    if (aborted.value) return;
    if (roomId.value) {
      if (
        gameStore.roomPlayer &&
        gameStore.roomPlayer.room.id !== roomId.value
      ) {
        if (gameStore.roomPlayer.role !== "player") {
          gameStore.game?.leaveRoom(gameStore.roomPlayer.room.id);
        } else {
          msg.warning("您正在游戏中，无法切换房间！");
          router.replace(route.name == 'lite-room' ? '/lite' : '/');
          return;
        }
      }
      const room = gameStore.rooms.find((r) => r.id === roomId.value);
      if (!room) {
        // 房间列表可能尚未到达：转为等待列表并带超时兜底，避免误伤刚进站的首帧
        load();
        return;
      }
      let passwd: string | undefined;
      if (room.attrs?.passwd && !room.players.some(p => p.id == gameStore.player?.id)) {
        // 列表入口的独立密码弹窗已验证过，直接消费，避免重复提问
        const saved = gameStore.takeJoinPasswd(room.id);
        if (saved !== undefined && md5(saved) === room.attrs.passwd) {
          passwd = saved;
        } else {
          // 链接直达：挂起等待页面弹窗提交正确密码（null = 取消离开）
          if (passwdPending.value?.room.id === room.id) return;
          const entered = await new Promise<string | null>((resolve) => {
            passwdPending.value = { room, resolve };
          });
          passwdPending.value = null;
          if (!entered) return room.players.some(p => p.id == gameStore.player?.id) ? undefined : router.back();
          passwd = entered;
        }
      }
      // 带 ?watch=1 进入时，落座后自动离座转为观众
      const watchIntent = Boolean(route.query.watch);
      if (watchIntent) gameStore.markWatchIntent(room.id);
      resetInteraction();
      // 显式声明观战意图，服务端据此不做落座/满员校验
      gameStore.game?.joinRoom(room.id, { passwd, role: watchIntent ? 'watcher' : 'player' });
    }
  }
  const room = computed(() => gameStore.roomPlayer?.room)

  function load() {
    clearLookupTimer();
    // 主动请求一次房间列表：room.list 有响应即可立刻判断房间是否还存在
    gameStore.game?.send({ type: 'room.list' as any });
    // 失效链接：房间列表里永远等不到该房间，超时后直接回大厅
    lookupTimer = window.setTimeout(() => {
      if (aborted.value || gameStore.roomPlayer) return;
      failToLobby('房间已解散或链接已失效');
    }, ROOM_LOOKUP_TIMEOUT);
    gameStore.game?.getRoomOneTime(roomId.value).then(() => {
      clearLookupTimer();
      init();
    });
  }

  if (gameStore.game) {
    useGameEvents(gameStore.game, {
      'onRoomList': () => {
        if (!route.params.id || aborted.value) return;
        // 已在房间中：房间列表变化交给 store 的 room.close 处理，此处不重复提示
        if (gameStore.roomPlayer?.room.id === roomId.value) return;
        if (!gameStore.rooms.find((r) => r.id === roomId.value)) {
          // 列表已到达且不含目标房间 → 立即判失效，无需等待超时
          window.setTimeout(() => {
            if (!aborted.value && !gameStore.roomPlayer) failToLobby('房间已解散或链接已失效');
          }, 150);
        }
      }
    });
  }

  watch(
    () => route.params.id,
    (val, old) => {
      if (val && val !== old && old) init();
    },
    { immediate: true }
  );

  onMounted(() => {
    if (gameStore.rooms.find((r) => r.id === roomId.value)) {
      init();
    } else {
      load();
    }
  });

  onBeforeUnmount(() => {
    clearLookupTimer();
    resetInteraction();
  });

  function submitPasswd(input: string) {
    const pending = passwdPending.value;
    if (!pending?.room.attrs?.passwd) return false;
    if (md5(input) !== pending.room.attrs.passwd) return false;
    pending.resolve(input);
    return true;
  }

  function cancelPasswd() {
    passwdPending.value?.resolve(null);
    passwdPending.value = null;
  }

  return {
    room,
    gameStore,
    roomId,
    passwdPending,
    submitPasswd,
    cancelPasswd,
  }
}