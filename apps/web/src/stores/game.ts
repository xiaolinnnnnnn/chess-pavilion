import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Player, Room } from '@yige/engine/client';
import { GameCore } from '@/core/game';
import { api, User } from '@/api';
import msg from '@/components/msg';
import router from '@/router';
import type { GameConfig } from '@/types';

export const useGameStore = defineStore('game', () => {
  const game = ref<GameCore | null>(null);
  const player = ref<User | null>(null);
  const players = ref<Player[]>([]);
  const rooms = ref<Room[]>([]);
  const games = ref<Record<string, GameConfig>>({});
  const globalMessages = ref<{ content: string; sender?: Player; createdAt: number }[]>([]);
  const showLoginModal = ref(false);
  const booted = ref(false);
  /** 当前我所在房间 id，用于识别“房间被解散”与主动离开的区别 */
  const myRoomId = ref('');

  /** 列表弹窗验证通过的房间密码，供 useRoom 加入时消费，避免二次弹窗 */
  const pendingPasswds = new Map<string, string>();
  /** 从列表点“观战”进入的房间，落座后自动离座转为观众 */
  const watchIntents = new Set<string>();
  /** 主动退出中的房间：leave 事件不视为被踢，避免重复提示与强制跳转 */
  const selfLeaves = new Set<string>();

  function markSelfLeave(roomId: string) {
    selfLeaves.add(roomId);
  }

  function setJoinPasswd(roomId: string, passwd: string) {
    pendingPasswds.set(roomId, passwd);
  }

  function takeJoinPasswd(roomId: string) {
    const value = pendingPasswds.get(roomId);
    pendingPasswds.delete(roomId);
    return value;
  }

  function markWatchIntent(roomId: string) {
    watchIntents.add(roomId);
  }

  function consumeWatchIntent(roomId: string) {
    const has = watchIntents.has(roomId);
    watchIntents.delete(roomId);
    return has;
  }

  const roomPlayer = computed(() => {
    if (!player.value) return null;
    for (const room of rooms.value) {
      const found = room.players.find((item) => item.id === player.value!.id);
      if (found) return { ...found, room };
    }
    return null;
  });

  const playerStatus = computed(
    () =>
      roomPlayer.value?.status ??
      players.value.find((item) => item.id === player.value?.id)?.status ??
      'offline',
  );

  async function initConfig() {
    try {
      const data = await api.getConfig();
      const cfg = data.games ?? {};
      // 去除历史遗留的“（标准）”等后缀，保证前端各处显示统一
      for (const key of Object.keys(cfg)) {
        cfg[key].name = String(cfg[key].name ?? key).replace(/（标准）/g, '').trim();
      }
      games.value = cfg;
    } catch (error) {
      console.error('加载游戏配置失败', error);
    }
  }

  async function checkSession() {
    if (booted.value) return Boolean(player.value);
    booted.value = true;
    const user = await api.me();
    if (user) player.value = user;
    else await loginVisitor();
    initGame();
    return Boolean(player.value);
  }

  /** 引擎只在建/离房时广播全量房间，准备状态靠 player-ready 增量同步 */
  function syncPlayerReady(data: any) {
    const room = rooms.value.find((item) => item.id === data.roomId);
    const target = room?.players.find((item) => item.id === data.id);
    if (target) target.isReady = data.isReady;
  }

  function initGame(): GameCore {
    if (game.value) return game.value;
    game.value = new GameCore(location.origin.replace(/^http/, 'ws') + '/ws');

    game.value
      .run()
      .on('global.error', (error: any) => error?.message && msg.error(error.message))
      .on('player.error', (error: any) => error?.message && msg.error(error.message))
      .on('room.join', (joined: any) => {
        if (joined.id !== player.value?.id) return;
        myRoomId.value = joined.roomId;
        game.value?.init(joined.roomId, player.value!.player);
        // 观战意图：若被自动分配为选手，立即离座转为观众
        if (consumeWatchIntent(joined.roomId) && joined.role === 'player') {
          game.value?.leaveSeat(joined.roomId);
        }
      })
      .on('room.close', (closed: any) => {
        // 房主解散房间：非主动离开的成员被强制退出并提示
        const id = closed?.id ?? closed?.roomId ?? myRoomId.value;
        if (myRoomId.value && id === myRoomId.value) {
          myRoomId.value = '';
          msg.warning('房间已解散');
          router.push('/');
        }
      })
      .on('room.leave', (left: any) => {
        const isSelf = left.id === player.value?.id;
        // 自己离开：清空当前房间标记，避免误报解散
        if (isSelf && left.roomId === myRoomId.value) myRoomId.value = '';
        // 被动移出（被踢）：房间仍在但自己已被剔除，强制回大厅，避免卡在房间页无法操作
        if (isSelf && !selfLeaves.delete(left.roomId)) {
          window.setTimeout(() => {
            const stillIn = rooms.value.some(
              (r) => r.id === left.roomId && r.players.some((p) => p.id === player.value?.id),
            );
            if (stillIn) return; // 离座转观众等仍在房间，不处理
            if (router.currentRoute.value.path.startsWith('/r/')) {
              msg.error('你已被房主移出房间');
              router.push('/');
            }
          }, 400);
        }
        // 对方退出房间时给在线成员明确提示（自己离开不提示）
        if (!roomPlayer.value || left.roomId !== roomPlayer.value.room.id) return;
        if (isSelf) return;
        if (left.role !== 'player') return;
        msg.warning(`${left.name || '对手'} 退出了房间`);
      })
      .onReady(() => {
        if (player.value) game.value!.login(player.value.player);
      })
      .onPlayerStatus((status: any) => {
        const target = players.value.find((item) => item.id === player.value?.id);
        if (target) target.status = status;
      })
      .onPlayerList((list) => {
        players.value = [...list];
      })
      .onRoomList((list) => {
        rooms.value = [...list];
      })
      .onPlayerReady((data: any) => syncPlayerReady(data))
      .onPlayerUnready((data: any) => syncPlayerReady(data))
      .onRoomCreate((room) => {
        if (room.players.some((item) => item.id === player.value?.id)) router.push('/r/' + room.id);
      })
      .onMessage(({ content, sender }) => {
        globalMessages.value.push({ content, sender, createdAt: Date.now() });
        if (globalMessages.value.length > 200) globalMessages.value.shift();
      });

    return game.value;
  }

  /** 房主主动解散房间：自己不再收“已解散”提示，成员端由 room.close 广播触发 */
  function disbandRoom(roomId: string) {
    myRoomId.value = '';
    game.value?.closeRoom(roomId);
    msg.success('房间已解散');
    router.push('/');
  }

  async function login(username: string, password: string) {
    const user = await api.login(username, password);
    player.value = user;
    // 登录会话已更换，WebSocket 需要用新会话重新握手
    reconnect();
    return user;
  }

  async function register(username: string, password: string) {
    const user = await api.register(username, password);
    player.value = user;
    reconnect();
    return user;
  }

  async function loginVisitor() {
    const user = await api.loginVisitor();
    player.value = user;
    reconnect();
    return user;
  }

  /** 会话身份变化后重建 WebSocket 连接 */
  function reconnect() {
    if (!game.value) return;
    game.value.close();
    game.value = null;
    rooms.value = [];
    players.value = [];
    initGame();
  }

  /** 修改用户名后刷新本地会话身份 */
  async function updateUsername(username: string) {
    const user = await api.updateUsername(username);
    player.value = user;
    return user;
  }

  async function logout() {
    await api.logout();
    player.value = null;
    game.value?.close();
    game.value = null;
    rooms.value = [];
    players.value = [];
    // 退出后立即回落为游客身份并重连大厅，避免页面失去入口
    const user = await api.loginVisitor();
    player.value = user;
    booted.value = true;
    initGame();
    return user;
  }

  return {
    game,
    player,
    players,
    rooms,
    games,
    globalMessages,
    roomPlayer,
    playerStatus,
    showLoginModal,
    myRoomId,
    disbandRoom,
    setJoinPasswd,
    takeJoinPasswd,
    markWatchIntent,
    markSelfLeave,
    consumeWatchIntent,
    initConfig,
    checkSession,
    initGame,
    login,
    register,
    loginVisitor,
    updateUsername,
    logout,
  };
});
