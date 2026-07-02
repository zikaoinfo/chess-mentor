/**
 * Minimal UCI driver for the vendored single-threaded Stockfish (runs inside a
 * Web Worker — never on the main thread). Not an Angular service; the
 * InstructorService owns the lifecycle. All failures resolve to a null result
 * so callers can fall back gracefully.
 */
export interface EngineGoOptions {
  /** Stockfish "Skill Level" (0–20). */
  readonly skill: number;
  /** Search budget in ms (bot moves). */
  readonly movetime?: number;
  /** Fixed search depth (hints, analysis). Takes precedence over movetime. */
  readonly depth?: number;
  /** UCI Contempt (-100..100) — used by bot personalities. */
  readonly contempt?: number;
}

/** Result of a search. `cp`/`mate` are from the side-to-move perspective. */
export interface EngineResult {
  readonly uci: string | null;
  readonly cp: number | null;
  readonly mate: number | null;
}

const NULL_RESULT: EngineResult = { uci: null, cp: null, mate: null };

export class StockfishEngine {
  private worker: Worker | null = null;
  private pending: ((result: EngineResult) => void) | null = null;
  private failed = false;
  private lastCp: number | null = null;
  private lastMate: number | null = null;

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
      this.worker.addEventListener('error', () => this.resolvePending(NULL_RESULT));
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
    if (line.startsWith('info ')) {
      const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
      if (score) {
        if (score[1] === 'cp') {
          this.lastCp = Number(score[2]);
          this.lastMate = null;
        } else {
          this.lastMate = Number(score[2]);
          this.lastCp = null;
        }
      }
      return;
    }
    if (line.startsWith('bestmove')) {
      const move = line.split(/\s+/)[1];
      this.resolvePending({
        uci: move && move !== '(none)' ? move : null,
        cp: this.lastCp,
        mate: this.lastMate,
      });
    }
  }

  private resolvePending(result: EngineResult): void {
    const cb = this.pending;
    this.pending = null;
    cb?.(result);
  }

  /** Search `fen`; resolves a null result on any failure — never rejects. */
  go(fen: string, options: EngineGoOptions): Promise<EngineResult> {
    return new Promise((resolve) => {
      if (!this.ensureWorker() || !this.worker) {
        resolve(NULL_RESULT);
        return;
      }
      this.pending = resolve;
      this.lastCp = null;
      this.lastMate = null;
      this.worker.postMessage(`setoption name Skill Level value ${options.skill}`);
      this.worker.postMessage(`setoption name Contempt value ${options.contempt ?? 0}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(
        options.depth ? `go depth ${options.depth}` : `go movetime ${options.movetime ?? 600}`,
      );

      // Safety net: never hang the UI if the engine never replies.
      const budget = options.movetime ? options.movetime + 5000 : 30000;
      setTimeout(() => {
        if (this.pending === resolve) this.resolvePending(NULL_RESULT);
      }, budget);
    });
  }

  /** Best move only (UCI), or null. */
  async bestMove(fen: string, options: EngineGoOptions): Promise<string | null> {
    return (await this.go(fen, options)).uci;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
