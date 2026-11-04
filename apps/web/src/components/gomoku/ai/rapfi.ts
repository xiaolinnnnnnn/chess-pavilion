import type { Board, Coord } from '@games/gomoku/rules';

interface PendingRequest {
  resolve: (coord: Coord) => void;
  reject: (error: Error) => void;
  timer: number;
}

const READY_TIMEOUT = 12_000;
const SEARCH_GRACE = 1_500;

/**
 * Rapfi Web Worker 客户端。
 * 单线程 WASM，无需 SharedArrayBuffer；加载失败时调用方自动降级到内置棋力。
 */
export class RapfiClient {
  private worker: Worker | null = null;
  private loading: Promise<void> | null = null;
  private pending = new Map<number, PendingRequest>();
  private seq = 0;
  private failed = false;

  get failedPermanently() {
    return this.failed;
  }

  load(): Promise<void> {
    if (this.loading) return this.loading;
    if (this.failed) return Promise.reject(new Error('engine-unavailable'));

    this.loading = new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (error) {
          this.failed = true;
          this.loading = null;
          this.worker?.terminate();
          this.worker = null;
          reject(error);
        } else {
          resolve();
        }
      };

      const timer = window.setTimeout(() => finish(new Error('engine-load-timeout')), READY_TIMEOUT);

      try {
        this.worker = new Worker(`${import.meta.env.BASE_URL}rapfi/worker.js`);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      this.worker.onmessage = (event: MessageEvent) => {
        const data = event.data ?? {};
        if (data.type === 'ready') {
          finish();
          return;
        }
        if (data.type === 'error') {
          if (typeof data.id === 'number' && this.pending.has(data.id)) {
            const request = this.pending.get(data.id)!;
            this.pending.delete(data.id);
            window.clearTimeout(request.timer);
            request.reject(new Error(String(data.message || 'engine-error')));
          } else if (!settled) {
            finish(new Error(String(data.message || 'engine-error')));
          }
          return;
        }
        if (data.type === 'result') {
          const request = this.pending.get(Number(data.id));
          if (!request) return;
          this.pending.delete(Number(data.id));
          window.clearTimeout(request.timer);
          request.resolve({ row: Number(data.row), col: Number(data.col) });
        }
      };

      this.worker.onerror = (event) => {
        const error = new Error(event.message || 'worker-error');
        if (!settled) finish(error);
      };
    });

    return this.loading;
  }

  async think(board: Board, timeoutMs: number): Promise<Coord> {
    if (!this.worker) await this.load();
    if (!this.worker) throw new Error('engine-unavailable');

    const id = ++this.seq;
    const worker = this.worker;
    // Vue 的响应式数组是 Proxy，结构化克隆会抛错，发送前转成普通数组
    const snapshot = board.map((row) => row.slice());

    return new Promise<Coord>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('engine-think-timeout'));
      }, timeoutMs + SEARCH_GRACE);

      this.pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ type: 'search', id, board: snapshot, timeout: timeoutMs });
      } catch (error) {
        window.clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  dispose() {
    this.pending.forEach((request) => {
      window.clearTimeout(request.timer);
      request.reject(new Error('engine-disposed'));
    });
    this.pending.clear();
    this.worker?.postMessage({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.loading = null;
  }
}
