# Rapfi WebAssembly 资源说明

本目录下的三个文件是 **Rapfi** 的 WebAssembly 构建产物，用于浏览器端人机对战：

- `rapfi-single-simd128.js`：Emscripten 胶水代码
- `rapfi-single-simd128.wasm`：引擎主体
- `rapfi-single-simd128.data`：NNUE 权重（约 10MB，仅在普通/困难难度按需加载）
- `worker.js`：本项目的 Worker 封装（Piskvork 协议：`START 15` + `BOARD ... DONE`）

## 许可证

Rapfi 以 **GPL-3.0** 分发。上述引擎产物来自开源仓库 https://github.com/lich4/Gomoku 的预编译版本，**未修改**。
Rapfi 源码：https://github.com/dhbloo/rapfi

分发本项目时，必须同时提供：

1. Rapfi 的完整源码或其公开仓库地址（见上）；
2. 本项目对应源码的公开地址（部署时请修改 `frontend/src/components/gomoku/ai/compliance.ts` 中的 `PROJECT_SOURCE`）；
3. 如修改了 Rapfi 或其构建参数，需一并提供对应源码与构建说明。

## 构建方式（不使用预编译产物时）

```bash
git clone https://github.com/dhbloo/rapfi.git
cd rapfi/Rapfi
mkdir -p build/wasm-single-simd128 && cd build/wasm-single-simd128
emcmake cmake ../.. -DCMAKE_BUILD_TYPE=Release \
  -DNO_COMMAND_MODULES=ON \
  -DUSE_WASM_SIMD=ON -DUSE_WASM_SIMD_RELAXED=OFF \
  -DNO_MULTI_THREADING=ON
emmake cmake --build .
```

将生成的 `rapfi-single-simd128.{js,wasm,data}` 覆盖到本目录即可。
单线程构建不依赖 `SharedArrayBuffer`，因此静态站点无需配置 COOP/COEP 响应头。
