/**
 * Minimal UCI driver for the vendored single-threaded Stockfish (runs inside a
 * Web Worker — never on the main thread). Not an Angular service; the
 * InstructorService owns the lifecycle. All failures resolve to `null` so the
 * caller can fall back gracefully.
 */
export interface EngineLimit {
  /** Stockfish "Skill Level" (0–20). */
  readonly skill: number;
  /** Search budget in ms (used for bot moves). */
  readonly movetime?: number;
  /** Fixed search depth (used for hints). Takes precedence over movetime. */
  readonly depth?: number;
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private pending: ((uci: string | null) => void) | null = null;
  private failed = false;

  constructor(
    private readonly scriptUrl: string,
    private readonly wasmUrl: string,
  ) {}

  /** Lazily spawn the worker; returns false if Workers are unavailable. */
  private ensureWorker(): boolean {
    if (this.worker) return true;
    if (this.failed || typeof Worker === 'undefined') return false;
    try {
      // The hash tells the engine where to fetch its .wasm (see stockfish.js).
      this.worker = new Worker(`${this.scriptUrl}#${this.wasmUrl}`);
      this.worker.addEventListener('message', (e: MessageEvent) =>
        this.onLine(typeof e.data === 'string' ? e.data : String(e.data)),
      );
      this.worker.addEventListener('error', () => this.resolvePending(null));
      this.worker.postMessage('uci');
      this.worker.postMessage('isready');
      return true;
    } catch {
      this.failed = true;
      this.worker = null;
      return false;
    }
  }

  private onLine(line: string): void {
    if (line.startsWith('bestmove')) {
      const move = line.split(/\s+/)[1];
      this.resolvePending(move && move !== '(none)' ? move : null);
    }
  }

  private resolvePending(uci: string | null): void {
    const cb = this.pending;
    this.pending = null;
    cb?.(uci);
  }

  /** Ask the engine for the best move from `fen`. Resolves null on any failure. */
  bestMove(fen: string, limit: EngineLimit): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.ensureWorker() || !this.worker) {
        resolve(null);
        return;
      }
      this.pending = resolve;
      this.worker.postMessage(`setoption name Skill Level value ${limit.skill}`);
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(limit.depth ? `go depth ${limit.depth}` : `go movetime ${limit.movetime ?? 600}`);

      // Safety net: never hang the UI if the engine never replies.
      const budget = (limit.movetime ?? 1500) + 5000;
      setTimeout(() => {
        if (this.pending === resolve) this.resolvePending(null);
      }, budget);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
