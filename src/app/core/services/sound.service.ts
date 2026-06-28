import { Injectable, signal } from '@angular/core';

interface Step {
  readonly freq: number;
  readonly dur: number;
  readonly type?: OscillatorType;
  readonly gain?: number;
  readonly delay?: number; // seconds, relative to now
}

type AudioCtor = typeof AudioContext;

/**
 * Lightweight game sound effects, synthesized with the Web Audio API — no
 * audio assets to vendor, works offline and on GitHub Pages. The AudioContext
 * is created lazily on first play (a user gesture), and every method is a safe
 * no-op when audio is muted or unavailable (e.g. jsdom under tests).
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  /** User mute toggle (app-wide). */
  readonly muted = signal(false);

  private ctx: AudioContext | null = null;

  toggleMute(): void {
    this.muted.update((m) => !m);
  }

  // ─── Effects ────────────────────────────────────────────────────────────
  move(): void {
    this.play([{ freq: 300, dur: 0.08, type: 'triangle', gain: 0.05 }]);
  }

  capture(): void {
    this.play([
      { freq: 200, dur: 0.06, type: 'sawtooth', gain: 0.06 },
      { freq: 130, dur: 0.1, type: 'sawtooth', gain: 0.06, delay: 0.04 },
    ]);
  }

  check(): void {
    this.play([
      { freq: 520, dur: 0.07, type: 'square', gain: 0.04 },
      { freq: 660, dur: 0.1, type: 'square', gain: 0.04, delay: 0.07 },
    ]);
  }

  hint(): void {
    this.play([
      { freq: 440, dur: 0.08, type: 'sine', gain: 0.05 },
      { freq: 660, dur: 0.12, type: 'sine', gain: 0.05, delay: 0.08 },
    ]);
  }

  success(): void {
    this.play([
      { freq: 523, dur: 0.1, type: 'sine', gain: 0.05 },
      { freq: 659, dur: 0.1, type: 'sine', gain: 0.05, delay: 0.09 },
      { freq: 784, dur: 0.16, type: 'sine', gain: 0.05, delay: 0.18 },
    ]);
  }

  error(): void {
    this.play([{ freq: 160, dur: 0.18, type: 'sawtooth', gain: 0.05 }]);
  }

  gameOver(): void {
    this.play([
      { freq: 392, dur: 0.14, type: 'triangle', gain: 0.05 },
      { freq: 294, dur: 0.22, type: 'triangle', gain: 0.05, delay: 0.13 },
    ]);
  }

  // ─── Synthesis ──────────────────────────────────────────────────────────
  private ensureContext(): AudioContext | null {
    if (this.muted()) return null;
    const Ctor: AudioCtor | undefined =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (globalThis as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private play(steps: readonly Step[]): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const start = ctx.currentTime;
    for (const step of steps) {
      const at = start + (step.delay ?? 0);
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const peak = step.gain ?? 0.05;
      osc.type = step.type ?? 'sine';
      osc.frequency.setValueAtTime(step.freq, at);
      // Quick attack, smooth exponential decay — avoids clicks.
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(peak, at + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, at + step.dur);
      osc.connect(env).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + step.dur + 0.02);
    }
  }
}
