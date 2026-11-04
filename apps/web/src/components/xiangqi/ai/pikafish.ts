interface Pending {
  resolve: (move: string) => void;
  reject: (error: Error) => void;
  timer: number;
}

const READY_TIMEOUT = 20_000;
const GRACE = 2_000;

/** Pikafish WASM（UCI 协议）客户端 */
export class PikafishClient {
  private worker: Worker | null = null;
  private loading: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private failed = false;

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
        this.worker = new Worker(`${import.meta.env.BASE_URL}pikafish/worker.js`);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      this.worker.onmessage = (event: MessageEvent) => {
        const data = event.data ?? {};
        if (data.type === 'ready') return finish();
        if (data.type === 'error') {
          if (!settled) return finish(new Error(String(data.message || 'engine-error')));
          return;
        }
        if (data.type === 'bestmove') {
          const request = this.pending.get(Number(data.id));
          if (!request) return;
          this.pending.delete(Number(data.id));
          window.clearTimeout(request.timer);
          request.resolve(String(data.move));
        }
      };

      this.worker.onerror = (event) => {
        if (!settled) finish(new Error(event.message || 'worker-error'));
      };
    });

    return this.loading;
  }

  async think(fen: string, movetime = 800): Promise<string> {
    if (!this.worker) await this.load();
    if (!this.worker) throw new Error('engine-unavailable');

    const id = ++this.seq;
    const worker = this.worker;
    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('engine-think-timeout'));
      }, movetime + GRACE);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'search', id, fen, movetime });
    });
  }

  dispose() {
    this.pending.forEach((request) => {
      window.clearTimeout(request.timer);
      request.reject(new Error('engine-disposed'));
    });
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.loading = null;
  }
}
