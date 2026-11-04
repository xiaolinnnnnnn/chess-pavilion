/* eslint-disable no-undef */
/**
 * Rapfi WASM Worker（Piskvork 协议）
 *
 * 资源来自 Rapfi GPL-3.0 的 WebAssembly 构建（预编译产物由 lich4/Gomoku 提供），
 * 与 rapfi-single-simd128.js/.wasm/.data 放在同一目录，单线程运行，无需 COOP/COEP。
 * 源码与构建说明见 ./NOTICE.md
 */
importScripts('rapfi-single-simd128.js');

let engine = null;
let ready = false;
let pendingId = 0;
let lastResultId = 0;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function parseLine(line) {
  // Rapfi 在 Piskvork 协议下用 "col,row" 输出落子
  const match = /^\s*(\d{1,2})\s*,\s*(\d{1,2})\s*$/.exec(line);
  if (!match) return;
  const col = Number(match[1]);
  const row = Number(match[2]);
  if (row < 0 || row > 14 || col < 0 || col > 14) return;
  lastResultId = pendingId;
  post('result', { id: lastResultId, row, col });
}

Rapfi({
  onReceiveStdout: parseLine,
  onReceiveStderr: (line) => console.warn('[rapfi]', line),
  onExit: (code) => post('error', { message: `Rapfi 退出，code=${code}` }),
})
  .then((module) => {
    engine = module;
    engine.sendCommand('START 15');
    engine.sendCommand('INFO timeout_match 0');
    engine.sendCommand('INFO time_left 2147483647');
    ready = true;
    post('ready');
  })
  .catch((error) => post('error', { message: String(error?.message || error) }));

self.onmessage = (event) => {
  const data = event.data || {};

  if (data.type === 'search') {
    if (!ready || !engine) {
      post('error', { id: data.id, message: 'engine-not-ready' });
      return;
    }

    pendingId = Number(data.id) || 0;
    const timeout = Math.max(50, Math.min(5000, Number(data.timeout) || 800));
    engine.sendCommand(`INFO timeout_turn ${timeout}`);

    let board = 'BOARD\n';
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const stone = data.board?.[row]?.[col];
        if (stone) board += `${col},${row},${stone}\n`;
      }
    }
    board += 'DONE';
    engine.sendCommand(board);
    return;
  }

  if (data.type === 'dispose') {
    try {
      engine?.sendCommand('END');
    } catch {
      /* ignore */
    }
    self.close();
  }
};
