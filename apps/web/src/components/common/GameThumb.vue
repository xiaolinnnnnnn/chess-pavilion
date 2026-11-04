<template>
  <svg v-if="type === 'gomoku'" viewBox="0 0 320 160" class="h-full w-full" role="img" aria-label="五子棋棋盘示意">
    <rect width="320" height="160" fill="#e6c795" />
    <g stroke="#8a6b3f" stroke-width="1" opacity="0.55">
      <line v-for="i in 9" :key="'gv' + i" :x1="20 + (i - 1) * 35" y1="12" :x2="20 + (i - 1) * 35" y2="148" />
      <line v-for="i in 5" :key="'gh' + i" x1="20" :y1="12 + (i - 1) * 34" x2="300" :y2="12 + (i - 1) * 34" />
    </g>
    <g>
      <circle cx="127" cy="80" r="13" fill="#1a1a1a" />
      <circle cx="162" cy="80" r="13" fill="#f7f3ea" stroke="#b7a88d" />
      <circle cx="197" cy="80" r="13" fill="#1a1a1a" />
      <circle cx="144.5" cy="46" r="13" fill="#f7f3ea" stroke="#b7a88d" />
      <circle cx="179.5" cy="114" r="13" fill="#1a1a1a" />
      <line x1="127" y1="80" x2="197" y2="80" stroke="#c0392b" stroke-width="2.5" opacity="0.8" />
    </g>
  </svg>

  <svg v-else-if="type === 'go'" viewBox="0 0 320 160" class="h-full w-full" role="img" aria-label="围棋棋盘示意">
    <rect width="320" height="160" fill="#dcb877" />
    <g stroke="#6b522d" stroke-width="1" opacity="0.6">
      <line v-for="i in 9" :key="'dv' + i" :x1="20 + (i - 1) * 35" y1="12" :x2="20 + (i - 1) * 35" y2="148" />
      <line v-for="i in 5" :key="'dh' + i" x1="20" :y1="12 + (i - 1) * 34" x2="300" :y2="12 + (i - 1) * 34" />
    </g>
    <g fill="#6b522d" opacity="0.7">
      <circle cx="127" cy="46" r="2.5" /><circle cx="197" cy="46" r="2.5" />
      <circle cx="127" cy="114" r="2.5" /><circle cx="197" cy="114" r="2.5" />
    </g>
    <g>
      <circle cx="127" cy="46" r="14" fill="#141414" />
      <circle cx="162" cy="80" r="14" fill="#f7f3ea" stroke="#a8997c" />
      <circle cx="197" cy="46" r="14" fill="#141414" />
      <circle cx="162" cy="46" r="14" fill="#f7f3ea" stroke="#a8997c" />
      <circle cx="197" cy="114" r="14" fill="#141414" />
      <circle cx="162" cy="114" r="14" fill="#f7f3ea" stroke="#a8997c" />
    </g>
  </svg>

  <svg v-else-if="type === 'xiangqi'" viewBox="0 0 320 160" class="h-full w-full" role="img" aria-label="象棋棋盘示意">
    <rect width="320" height="160" fill="#ecc796" />
    <g stroke="#7a5a33" stroke-width="1" opacity="0.6">
      <line v-for="i in 9" :key="'xv' + i" :x1="20 + (i - 1) * 35" y1="14" :x2="20 + (i - 1) * 35" y2="146" />
      <line v-for="i in 4" :key="'xt' + i" x1="20" :y1="14 + (i - 1) * 28" x2="300" :y2="14 + (i - 1) * 28" />
      <line v-for="i in 4" :key="'xb' + i" x1="20" :y1="104 + (i - 1) * 14" x2="300" :y2="104 + (i - 1) * 14" />
      <line x1="125" y1="14" x2="195" y2="70" /><line x1="195" y1="14" x2="125" y2="70" />
      <line x1="125" y1="146" x2="195" y2="90" /><line x1="195" y1="146" x2="125" y2="90" />
    </g>
    <rect x="20" y="72" width="280" height="16" fill="#ecc796" />
    <text x="86" y="85" font-size="12" fill="#7a5a33" opacity="0.75" class="font-kai">楚 河</text>
    <text x="196" y="85" font-size="12" fill="#7a5a33" opacity="0.75" class="font-kai">汉 界</text>
    <g>
      <circle cx="90" cy="98" r="15" fill="#f4e3c6" stroke="#c0392b" stroke-width="2" />
      <text x="90" y="103" text-anchor="middle" font-size="14" font-weight="700" fill="#c0392b" class="font-kai">炮</text>
      <circle cx="230" cy="132" r="15" fill="#f4e3c6" stroke="#1e7a46" stroke-width="2" />
      <text x="230" y="137" text-anchor="middle" font-size="14" font-weight="700" fill="#1e7a46" class="font-kai">砲</text>
      <circle cx="160" cy="30" r="15" fill="#f4e3c6" stroke="#c0392b" stroke-width="2" />
      <text x="160" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="#c0392b" class="font-kai">帅</text>
    </g>
  </svg>

  <svg v-else viewBox="0 0 320 160" class="h-full w-full" role="img" aria-label="棋盘示意">
    <rect width="320" height="160" fill="#e6c795" />
    <g stroke="#8a6b3f" stroke-width="1" opacity="0.5">
      <line v-for="i in 9" :key="'nv' + i" :x1="20 + (i - 1) * 35" y1="12" :x2="20 + (i - 1) * 35" y2="148" />
      <line v-for="i in 5" :key="'nh' + i" x1="20" :y1="12 + (i - 1) * 34" x2="300" :y2="12 + (i - 1) * 34" />
    </g>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ type: string }>();
</script>
