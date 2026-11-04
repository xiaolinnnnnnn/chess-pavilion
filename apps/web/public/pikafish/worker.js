/* eslint-disable no-undef */
/**
 * Pikafish WASM Worker（UCI 协议）
 * 单线程 SIMD128 构建，资源位于同目录。
 * 引擎 API：Pikafish(options) -> Promise<Module>；Module.read_stdout 逐行回调；Module.send_command 下发 UCI。
 *
 * 注意：send_command 不能在 read_stdout 回调内同步调用，否则会重入引擎的输入/输出流导致输出错乱，
 * 因此对 isready 的响应一律延迟到事件循环下一轮。
 */
importScripts('pikafish.js');

const BASE = (self.location.pathname || '/').replace(/[^/]*$/, '');

let engine = null;
let ready = false;
let pendingId = 0;
let handshaking = false;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function send(command) {
  if (!engine) return;
  try {
    engine.send_command(command);
  } catch (error) {
    post('error', { message: String(error?.message || error) });
  }
}

Pikafish({ locateFile: (path) => BASE + path })
  .then((module) => {
    engine = module;
    module.read_stdout = (line) => {
      const text = String(line || '').trim();
      if (!text) return;
      if (text.includes('uciok')) {
        if (!handshaking) {
          handshaking = true;
          setTimeout(() => send('isready'), 0);
        }
      } else if (text.includes('readyok')) {
        if (!ready) {
          ready = true;
          post('ready');
        }
      } else {
        const match = /^bestmove\s+(\S+)/.exec(text);
        if (match) post('bestmove', { id: pendingId, move: match[1] });
      }
    };
    send('uci');
  })
  .catch((error) => post('error', { message: String(error?.message || error) }));

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type !== 'search') return;
  if (!ready || !engine) {
    post('error', { message: 'engine-not-ready' });
    return;
  }
  pendingId = Number(data.id) || 0;
  const movetime = Math.max(50, Math.min(3000, Number(data.movetime) || 600));
  send('position fen ' + data.fen);
  send('go movetime ' + movetime);
};
