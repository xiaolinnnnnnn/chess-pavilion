<template>
  <section class="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">用户管理</h1>
        <p class="text-xs text-base-content/50">角色、封禁与积分调整</p>
      </div>
      <div class="flex items-center gap-2">
        <el-input v-model="keyword" class="w-44" placeholder="搜索用户名" @keyup.enter="load(1)" />
        <button class="btn btn-sm" @click="load(1)">搜索</button>
      </div>
    </header>

    <div class="overflow-x-auto rounded-xl border border-base-content/10">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>用户</th>
            <th>角色</th>
            <th>状态</th>
            <th class="text-right">积分</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in users" :key="row.id" class="hover">
            <td>
              <div class="font-medium">{{ row.nickname }}</div>
              <div class="text-xs text-base-content/40">@{{ row.username }}</div>
            </td>
            <td>
              <span class="badge badge-sm" :class="row.role === 'admin' ? 'badge-primary' : 'badge-ghost'">
                {{ row.role === 'admin' ? '管理员' : '用户' }}
              </span>
            </td>
            <td>
              <span class="badge badge-sm" :class="row.status === 'banned' ? 'badge-error' : 'badge-ghost'">
                {{ row.status === 'banned' ? '已封禁' : '正常' }}
              </span>
            </td>
            <td class="text-right font-mono tabular-nums">{{ row.points }}</td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <button class="btn btn-xs btn-ghost" @click="toggleRole(row)">
                  {{ row.role === 'admin' ? '降为用户' : '设为管理员' }}
                </button>
                <button class="btn btn-xs btn-ghost" :class="row.status === 'banned' ? 'text-success' : 'text-error'" @click="toggleBan(row)">
                  {{ row.status === 'banned' ? '解封' : '封禁' }}
                </button>
                <button class="btn btn-xs btn-ghost" @click="adjust(row)">调分</button>
              </div>
            </td>
          </tr>
          <tr v-if="!users.length">
            <td colspan="5" class="py-8 text-center text-sm text-base-content/40">没有匹配的用户</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between text-xs text-base-content/50">
      <span>共 {{ total }} 位用户</span>
      <div class="join">
        <button class="btn btn-xs join-item" :disabled="page <= 1" @click="load(page - 1)">上一页</button>
        <button class="btn btn-xs join-item" :disabled="page * pageSize >= total" @click="load(page + 1)">下一页</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '@/api';
import msg from '@/components/msg';

const keyword = ref('');
const users = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

async function load(next = 1) {
  page.value = next;
  try {
    const data = await api.adminUsers({ keyword: keyword.value, page: next, pageSize });
    users.value = data.rows;
    total.value = data.total;
  } catch (error) {
    msg.error((error as Error).message);
  }
}

async function patch(row: any, payload: Record<string, any>) {
  try {
    await api.adminPatchUser(row.id, payload);
    await load(page.value);
  } catch (error) {
    msg.error((error as Error).message);
  }
}

function toggleRole(row: any) {
  patch(row, { role: row.role === 'admin' ? 'user' : 'admin' });
}

function toggleBan(row: any) {
  patch(row, { status: row.status === 'banned' ? 'active' : 'banned', reason: '管理员操作' });
}

function adjust(row: any) {
  const input = window.prompt('调整积分（正数增加，负数扣减）', '10');
  if (input === null) return;
  const delta = Number(input);
  if (!Number.isFinite(delta) || delta === 0) return;
  patch(row, { pointsDelta: delta, reason: '管理员调整' });
}

onMounted(() => load(1));
</script>
