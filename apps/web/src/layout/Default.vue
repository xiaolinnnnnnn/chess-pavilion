<template>
  <div class="flex flex-col h-dvh w-full bg-base-100 text-base-content">
    <header class="flex flex-none items-center gap-2 border-b border-base-content/10 bg-base-100 px-3 py-2 md:gap-4 md:px-5">
      <div class="flex min-w-0 cursor-pointer items-center gap-2.5" @click="router.push('/')" title="回到首页">
        <img src="/logo.svg" alt="弈阁" class="h-8 w-8 shrink-0" />
        <p class="truncate text-base font-semibold">弈阁</p>
      </div>

      <nav class="ml-2 hidden items-center gap-1 md:flex">
        <RouterLink to="/" class="app-nav-link flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors">
          <Icon icon="mingcute:home-3-line" class="text-base" />
          首页
        </RouterLink>
        <button class="app-nav-link flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors" :class="{ 'is-active': isSidebarOpen }" @click="isSidebarOpen = !isSidebarOpen">
          <Icon icon="mdi:chess-knight" class="text-base" />
          游戏大厅
        </button>
        <RouterLink to="/leaderboard" class="app-nav-link flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors">
          <Icon icon="mdi:trophy-outline" class="text-base" />
          排行榜
        </RouterLink>
        <RouterLink v-if="gameStore.player?.isAdmin" to="/admin" class="app-nav-link flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors">
          <Icon icon="mingcute:settings-3-line" class="text-base" />
          房间管理
        </RouterLink>
      </nav>

      <div class="flex-1"></div>

      <div class="flex items-center gap-1.5 md:gap-3">
        <button @click="isSidebarOpen = !isSidebarOpen" class="btn btn-ghost btn-sm btn-square md:hidden" aria-label="游戏大厅" :class="{ 'btn-active': isSidebarOpen }" title="游戏大厅">
          <Icon icon="mdi:chess-knight" class="text-lg" />
        </button>

        <ThemeController />

        <div v-if="gameStore.player" class="dropdown dropdown-end dropdown-hover hidden lg:block">
          <div
            tabindex="0"
            role="button"
            class="flex cursor-pointer items-center gap-2 rounded-full border border-base-content/10 bg-base-200/60 py-1 pl-1 pr-2.5"
            :title="`ID: ${gameStore.player.id}`"
          >
            <span class="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-base-300 text-xs font-bold">
              <img v-if="gameStore.player.avatar" :src="gameStore.player.avatar" alt="头像" class="h-full w-full object-cover" />
              <span v-else>{{ gameStore.player.nickname.slice(0, 1) }}</span>
            </span>
            <span class="max-w-[12em] truncate text-sm">
              欢迎回来，<span class="font-medium">{{ gameStore.player.nickname }}</span>
              <span v-if="gameStore.player.isVisitor" class="badge badge-ghost badge-sm ml-1">游客</span>
            </span>
            <Icon icon="mdi:chevron-down" class="text-base text-base-content/50" />
          </div>
          <ul tabindex="0" class="dropdown-content menu z-50 w-52 rounded-xl bg-base-100 p-1 pt-2 shadow-lg">
            <li><button class="gap-2" @click="openUsernameModal"><Icon icon="mdi:account-edit-outline" />修改用户名</button></li>
            <li><button class="gap-2" @click="openPasswordModal"><Icon icon="mdi:lock-reset" />修改密码</button></li>
            <li class="my-1 h-px bg-base-content/10"></li>
            <li><button class="gap-2" @click="router.push('/my-games')"><Icon icon="mdi:history" />我的对局</button></li>
          </ul>
        </div>

        <button
          v-if="gameStore.player?.isVisitor"
          @click="gameStore.showLoginModal = true"
          class="btn btn-primary btn-sm min-w-[5.5em] gap-1.5"
        >
          <Icon icon="mdi:login" class="text-base" />
          登录
        </button>
        <button
          v-else-if="gameStore.player"
          @click="handleLogout"
          :disabled="gameStore.playerStatus === 'playing'"
          :title="gameStore.playerStatus === 'playing' ? '对局进行中，请先退出房间' : '退出登录'"
          class="btn btn-ghost btn-sm gap-1.5"
        >
          <Icon icon="mingcute:exit-line" class="text-base" />
          退出登录
        </button>
      </div>
    </header>

    <section class="relative flex flex-1 flex-row overflow-hidden">
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/40"
        @click="isSidebarOpen = false"
      ></div>

      <aside
        class="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[90vw] flex-col content-start gap-2 overflow-auto bg-base-200/95 pt-3 shadow-xl backdrop-blur transition-transform duration-300 ease-in-out border-r border-base-content/10"
        :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex items-center justify-between px-3 pb-1">
          <p class="flex items-center gap-2 text-sm font-semibold text-base-content/70">
            <Icon icon="mdi:chess-knight" class="text-base" />
            游戏大厅
          </p>
          <button @click="isSidebarOpen = false" class="btn btn-ghost btn-sm btn-square" aria-label="关闭">
            <Icon icon="mdi:close" class="text-base" />
          </button>
        </div>

        <!-- Tabs -->
        <div role="tablist" class="tabs tabs-lift grid flex-none grid-cols-2 px-2">
          <a
            role="tab" class="tab h-auto py-2 gap-2"
            :class="{ 'tab-active': activeTab === 'rooms' }"
            @click="activeTab = 'rooms'"
          >
            <Icon icon="fluent:chess-16-filled" class="text-lg" />
            在线房间 {{ gameStore.rooms.length }}
          </a>
          <a
            role="tab" class="tab h-auto py-2 gap-2"
            :class="{ 'tab-active': activeTab === 'players' }"
            @click="activeTab = 'players'"
          >
            <Icon icon="fluent:people-16-filled" class="text-lg" />
            在线玩家 {{ gameStore.players.length }}
          </a>
        </div>

        <div class="min-h-0 flex-1 overflow-auto bg-base-100/60">
          <div v-show="activeTab === 'rooms'" class="flex h-full flex-col gap-2 p-2">
            <el-select v-model="gameType" class="w-full" aria-label="按游戏筛选房间">
              <el-option label="全部游戏" value="all" />
              <el-option v-for="(game, key) in gameStore.games" :key="key" :label="game.name" :value="key" />
            </el-select>

            <ul class="space-y-1.5 pb-3">
              <li
                v-for="r in roomList" :key="r.id"
                class="panel-inset px-2.5 py-2"
                :class="{ 'ring-1 ring-success/50 bg-success/5': isMyRoom(r) }"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
                    <Icon icon="solar:lock-linear" class="flex-none text-sm text-base-content/50" v-if="r.attrs.passwd" title="需要密码" />
                    <Icon v-if="r.attrs?.point" icon="ph:coins-duotone" class="flex-none text-yellow-400" :title="`单局积分: ${r.attrs.point}`" />
                    <span class="truncate text-sm" :class="{ 'font-bold': isMyRoom(r) }">
                      【{{ gameStore.games[r.attrs.type]?.name }}】{{ r.name }}
                    </span>
                    <span
                      v-if="isMyRoom(r)"
                      class="flex-none whitespace-nowrap rounded-full border border-success/40 bg-success/20 px-2 py-0.5 text-[11px] font-medium text-white"
                    >我的房间</span>
                  </div>
                </div>

                <div class="mt-1.5 flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2 text-xs text-base-content/55">
                    <span class="flex items-center gap-1 whitespace-nowrap">
                      <span class="h-1.5 w-1.5 rounded-full" :class="r.status === 'playing' ? 'bg-warning' : 'bg-success'"></span>
                      {{ r.status === 'playing' ? '对局中' : '等待中' }}
                    </span>
                    <span class="whitespace-nowrap">{{ seatText(r) }}</span>
                    <span v-if="watcherCount(r)" class="whitespace-nowrap">👁 {{ watcherCount(r) }}</span>
                  </div>
                  <div class="flex flex-none items-center gap-1.5">
                    <template v-if="isMyRoom(r)">
                      <button class="btn btn-xs btn-primary" @click.stop="enterRoom(r)">
                        <Icon icon="mdi:login" class="text-sm" />
                        回到房间
                      </button>
                    </template>
                    <template v-else>
                      <button class="btn btn-xs btn-ghost" @click.stop="spectateRoom(r)" title="进入房间观战">
                        <Icon icon="mdi:eye-outline" class="text-sm" />
                        观战
                      </button>
                      <button
                        class="btn btn-xs btn-primary"
                        @click.stop="seatRoom(r)"
                      >{{ seatLabel(r) }}</button>
                    </template>
                  </div>
                </div>
              </li>
            </ul>

            <div v-if="roomList.length === 0" class="flex flex-col items-center gap-2 py-10 text-center">
              <Icon icon="mdi:chess-knight" class="text-3xl text-base-content/30" />
              <p class="text-sm text-base-content/50">{{ gameType && gameType !== 'all' ? `暂无${gameStore.games[gameType]?.name ?? ''}房间` : '暂无房间' }}</p>
            </div>

            <p v-if="gameStore.player?.isVisitor" class="rounded-lg bg-base-content/5 px-3 py-2 text-xs leading-relaxed text-base-content/60">
              游客可以观战与体验人机；
              <button class="link link-primary cursor-pointer font-medium" @click="gameStore.showLoginModal = true">登录或注册</button>
              后即可落座对局、创建房间。
            </p>
          </div>

          <div v-show="activeTab === 'players'" class="h-full overflow-auto p-2">
            <ul class="space-y-1 pb-4">
              <li
                v-for="p in gameStore.players"
                :key="p.id"
                class="panel-inset flex cursor-pointer items-center gap-2 p-2 text-sm text-base-content/80 transition-colors hover:bg-base-300/60"
                @click="$router.push(`/u/${p.attributes.username}`)"
              >
                <div class="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-full border border-base-content/10 bg-base-300 text-xs">
                  <img v-if="p.attributes.avatar" :src="p.attributes.avatar" class="h-full w-full object-cover" />
                  <span v-else>{{ p.name[0] }}</span>
                </div>
                <span class="truncate">{{ p.name }}</span>
                <Icon icon="mdi:github" v-if="p.attributes.from == 'github'" />
                <Icon icon="mdi:steam" v-if="p.attributes.from == 'steam'" />
                <span class="ml-auto flex-none text-xs text-base-content/45">{{ statusText(p.status) }}</span>
              </li>
            </ul>
            <p v-if="!gameStore.players.length" class="py-10 text-center text-sm text-base-content/50">暂时没有其他人在线</p>
          </div>
        </div>
      </aside>

      <div class="min-w-0 flex-1 overflow-auto">
        <router-view />
      </div>
    </section>

    <footer class="flex flex-none flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-base-content/10 py-1.5 text-[11px] text-base-content/40">
      <span class="flex items-center gap-1">
        <span>开源许可 ·</span>
        <a href="https://github.com/official-pikafish/Pikafish" target="_blank" rel="noopener noreferrer" class="footer-link">Pikafish</a>
        <span class="text-base-content/25">/</span>
        <a href="https://github.com/dhbloo/rapfi" target="_blank" rel="noopener noreferrer" class="footer-link">Rapfi</a>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-px bg-base-content/20"></span>
        <span>Powered by <span class="font-medium text-base-content/60">朱诗雅</span></span>
      </span>
    </footer>

    <dialog class="modal" :class="{ 'modal-open': joinTarget }">
      <div v-if="joinTarget" class="modal-box max-w-sm p-0">
        <form method="dialog" @submit.prevent="confirmJoinRoom">
          <div class="border-b border-base-content/10 px-5 py-4">
            <h3 class="text-base font-semibold">进入房间</h3>
            <p class="mt-0.5 truncate text-xs text-base-content/55">
              【{{ gameStore.games[joinTarget.room.attrs.type]?.name }}】{{ joinTarget.room.name }} 设置了密码
            </p>
          </div>
          <div class="field field-row px-5 py-4">
            <label class="label" for="join-room-passwd">房间密码</label>
            <el-input
              id="join-room-passwd"
              ref="passwdInputRef"
              v-model="joinPasswd"
              type="password"
              show-password
              class="w-full"
              placeholder="请输入房间密码"
              autocomplete="off"
              :aria-invalid="!!joinError"
              @keyup.enter="confirmJoinRoom"
            />
            <p v-if="joinError" class="field-error"><Icon icon="mdi:alert-circle-outline" />{{ joinError }}</p>
          </div>
          <div class="flex justify-end gap-2 border-t border-base-content/10 px-5 py-3">
            <button type="button" class="btn btn-sm btn-ghost" @click="closeJoinDialog">取消</button>
            <button type="submit" class="btn btn-sm btn-primary min-w-[6em]" :disabled="!joinPasswd">
              {{ joinTarget.mode === 'watch' ? '观战进入' : '加入房间' }}
            </button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop bg-black/50" @click="closeJoinDialog"></div>
    </dialog>

    <LoginModal v-model="gameStore.showLoginModal" />

    <dialog class="modal" :class="{ 'modal-open': usernameModal }">
      <div class="modal-box max-w-sm p-0">
        <div class="border-b border-base-content/10 px-5 py-4">
          <h3 class="text-base font-semibold">修改用户名</h3>
        </div>
        <form class="space-y-4 px-5 py-4" @submit.prevent="submitUsername">
          <div class="field field-row">
            <label class="label" for="new-username">用户名</label>
            <el-input id="new-username" v-model.trim="newUsername" class="w-full" autocomplete="off" placeholder="3-20 位字母、数字、下划线或中文" />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-sm btn-ghost" @click="usernameModal = false">取消</button>
            <button type="submit" class="btn btn-sm btn-primary" :disabled="saving || !newUsername">保存</button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop bg-black/50" @click="usernameModal = false"></div>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': passwordModal }">
      <div class="modal-box max-w-sm p-0">
        <div class="border-b border-base-content/10 px-5 py-4">
          <h3 class="text-base font-semibold">修改密码</h3>
        </div>
        <form class="space-y-4 px-5 py-4" @submit.prevent="submitPassword">
          <PasswordField v-model="oldPassword" label="原密码" placeholder="请输入原密码" autocomplete="current-password" />
          <PasswordField v-model="newPassword" label="新密码" placeholder="8-16 位，包含字母和数字" autocomplete="new-password" />
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" class="btn btn-sm btn-ghost" @click="passwordModal = false">取消</button>
            <button type="submit" class="btn btn-sm btn-primary" :disabled="saving || !oldPassword || !newPassword">保存</button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop bg-black/50" @click="passwordModal = false"></div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { InputInstance } from 'element-plus'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import type { Room } from '@yige/engine/client'
import { md5 } from 'js-md5'
import { confirm } from '@/components/msgbox'
import msg from '@/components/msg'
import { api } from '@/api'
import PasswordField from '@/components/common/PasswordField.vue'

const router = useRouter()
const gameStore = useGameStore()

// 账号菜单：修改用户名 / 密码
const usernameModal = ref(false)
const passwordModal = ref(false)
const newUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const saving = ref(false)

function openUsernameModal() {
  newUsername.value = gameStore.player?.username || ''
  usernameModal.value = true
}
function openPasswordModal() {
  oldPassword.value = ''
  newPassword.value = ''
  passwordModal.value = true
}

async function submitUsername() {
  if (saving.value) return
  saving.value = true
  try {
    await gameStore.updateUsername(newUsername.value)
    msg.success('用户名已更新')
    usernameModal.value = false
  } catch (err) {
    msg.error((err as Error).message || '修改失败')
  } finally {
    saving.value = false
  }
}

async function submitPassword() {
  if (saving.value) return
  saving.value = true
  try {
    await api.changePassword(oldPassword.value, newPassword.value)
    msg.success('密码已修改')
    passwordModal.value = false
  } catch (err) {
    msg.error((err as Error).message || '修改失败')
  } finally {
    saving.value = false
  }
}

const isSidebarOpen = ref(false)
const activeTab = ref<'rooms' | 'players'>('rooms')

const gameType = ref('all')
const roomList = computed(() => {
  if (gameType.value === 'all' || !gameType.value) return gameStore.rooms
  return gameStore.rooms.filter(r => r.attrs.type === gameType.value)
})

function isRoomFull(r: Room) {
  return r.size !== 0 && r.players.filter((p) => p.role === 'player').length >= r.size
}

function myRoomPlayer(r: Room) {
  return r.players.find((p) => p.id === gameStore.player?.id)
}

function isMyRoom(r: Room) {
  return Boolean(myRoomPlayer(r))
}

function seatText(r: Room) {
  const seated = r.players.filter((p) => p.role === 'player').length
  return r.size === 0 ? `${seated} 人在座` : `${seated}/${r.size} 座位`
}

function watcherCount(r: Room) {
  return r.players.filter((p) => p.role === 'watcher').length
}

function statusText(status: string) {
  return status === 'playing' ? '对局中' : '在线'
}

function seatLabel(r: Room) {
  if (gameStore.player?.isVisitor) return '登录后加入'
  if (r.status === 'playing') return '对局中'
  if (isRoomFull(r)) return '已满员'
  return '加入'
}

function gotoRoom(r: Room, mode: 'seat' | 'watch') {
  if (r.attrs?.passwd) {
    openJoinDialog(r, mode)
    return
  }
  router.push(mode === 'watch' ? `/r/${r.id}?watch=1` : `/r/${r.id}`)
  isSidebarOpen.value = false
}

function seatRoom(r: Room) {
  if (gameStore.player?.isVisitor) {
    gameStore.showLoginModal = true
    msg.info('游客仅支持观战，登录后可落座对局')
    return
  }
  // 已在房间内：直接回到房间，无需再次输入密码
  if (isMyRoom(r)) {
    enterRoom(r)
    return
  }
  if (r.status === 'playing') {
    msg.warning('房间对局进行中，请选择观战或等待下一局')
    return
  }
  if (isRoomFull(r)) {
    msg.error('房间座位已满，请选择观战或等待下一局')
    return
  }
  gotoRoom(r, 'seat')
}

function spectateRoom(r: Room) {
  gotoRoom(r, 'watch')
}

function enterRoom(r: Room) {
  router.push(`/r/${r.id}`)
  isSidebarOpen.value = false
}

// ---------------- 房间密码独立弹窗 ----------------
const joinTarget = ref<{ room: Room; mode: 'seat' | 'watch' } | null>(null)
const joinPasswd = ref('')
const joinError = ref('')
const passwdInputRef = ref<InputInstance | null>(null)

function openJoinDialog(room: Room, mode: 'seat' | 'watch') {
  joinTarget.value = { room, mode }
  joinPasswd.value = ''
  joinError.value = ''
  isSidebarOpen.value = false
  nextTick(() => passwdInputRef.value?.focus())
}

function closeJoinDialog() {
  joinTarget.value = null
}

function confirmJoinRoom() {
  const target = joinTarget.value
  if (!target) return
  if (target.room.attrs.passwd !== md5(joinPasswd.value)) {
    joinError.value = '密码错误，请重新输入'
    return
  }
  // 验证通过后暂存，useRoom 加入时直接消费，不再二次提问
  gameStore.setJoinPasswd(target.room.id, joinPasswd.value)
  router.push(target.mode === 'watch' ? `/r/${target.room.id}?watch=1` : `/r/${target.room.id}`)
  closeJoinDialog()
}

async function handleLogout() {
  const ok = await confirm('退出后需要重新登录才能落座对局，确定退出吗？', '退出登录', { confirmText: '退出登录' })
  if (!ok) return
  await gameStore.logout()
  router.push('/')
}

onMounted(() => {
  gameStore.initGame()
})
</script>

<style scoped>
.app-nav-link {
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
}
.app-nav-link:hover {
  background: color-mix(in oklab, var(--color-base-content) 5%, transparent);
  color: var(--color-base-content);
}
.app-nav-link.router-link-exact-active,
.app-nav-link.is-active {
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  font-weight: 500;
  color: var(--color-primary);
}

/* 页脚外链：经典超链接蓝 + 悬停下划线 */
.footer-link {
  color: #5b9dff;
  text-decoration: none;
  transition: color 0.15s ease;
}
.footer-link:hover {
  color: #8bbcff;
  text-decoration: underline;
}
.footer-link:focus-visible {
  outline: 2px solid color-mix(in oklab, #5b9dff 60%, transparent);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>
