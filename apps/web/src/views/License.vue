<template>
  <section class="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
    <header>
      <h1 class="text-xl font-semibold">开源许可</h1>
      <p class="mt-1 text-xs text-base-content/50">本项目使用的第三方引擎与许可信息</p>
    </header>

    <article class="space-y-2 rounded-xl border border-base-content/10 p-4">
      <h2 class="text-sm font-semibold">Rapfi（五子棋人机引擎）</h2>
      <p class="text-sm leading-relaxed text-base-content/70">
        以 WebAssembly 形式在浏览器中运行，用于五子棋人机对战。引擎以 GPL-3.0 分发，构建产物未做修改。
      </p>
      <div class="flex flex-wrap gap-3 text-xs">
        <a class="link link-hover text-primary" href="https://github.com/dhbloo/rapfi" target="_blank" rel="noopener noreferrer">源码</a>
        <a class="link link-hover text-primary" href="https://github.com/lich4/Gomoku" target="_blank" rel="noopener noreferrer">WASM 构建来源</a>
      </div>
    </article>

    <article class="space-y-2 rounded-xl border border-base-content/10 p-4">
      <h2 class="text-sm font-semibold">Pikafish（象棋人机引擎）</h2>
      <p class="text-sm leading-relaxed text-base-content/70">
        以 WebAssembly 形式在浏览器中运行，用于中国象棋人机对战。引擎以 GPL-3.0 分发，NNUE 权重遵循其附加许可，仅用于合法对弈。
      </p>
      <div class="flex flex-wrap gap-3 text-xs">
        <a class="link link-hover text-primary" href="https://github.com/official-pikafish/Pikafish" target="_blank" rel="noopener noreferrer">源码</a>
        <a class="link link-hover text-primary" href="https://pikafish.org/wiki" target="_blank" rel="noopener noreferrer">许可说明</a>
      </div>
    </article>

    <article class="space-y-2 rounded-xl border border-base-content/10 p-4">
      <h2 class="text-sm font-semibold">实时房间引擎</h2>
      <p class="text-sm leading-relaxed text-base-content/70">
        房间、玩家与消息通信层基于 MIT 许可的开源实现，版权归原作者所有，完整许可见仓库 <code class="rounded bg-base-200 px-1">packages/engine/LICENSE</code>。
      </p>
    </article>

    <article class="space-y-2 rounded-xl border border-base-content/10 p-4">
      <h2 class="text-sm font-semibold">本项目源码</h2>
      <p class="text-sm leading-relaxed text-base-content/70">
        部署时请把这里替换为对应版本的公开仓库地址，以满足 GPL-3.0 的源码可获取要求。
      </p>
    </article>
  </section>
</template>
