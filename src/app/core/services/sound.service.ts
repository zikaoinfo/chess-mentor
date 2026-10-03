import { Injectable, signal } from '@angular/core';
import { renderSound, type SoundEffect } from './sound-synthesis';

type AudioCtor = typeof AudioContext;
const COOLDOWN: Partial<Record<SoundEffect, number>> = { error: 0.38, success: 0.7, gameOver: 0.7 };

/** Cached material sounds, synthesized locally and available offline. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal(false);
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly active = new Set<AudioBufferSourceNode>();
  private readonly buffers = new Map<SoundEffect, AudioBuffer>();
  private readonly lastPlayed = new Map<SoundEffect, number>();
  private generation = 0;
  private resuming = false;
  private pending: { effect: SoundEffect; generation: number } | null = null;

  toggleMute(): void {
    this.muted.update((m) => !m);
    this.generation++;
    this.pending = null;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(this.muted() ? 0 : 0.7, now + 0.012);
    if (this.muted()) {
      for (const source of this.active) source.stop(now + 0.015);
    }
    this.lastPlayed.clear();
  }

  move(): void {
    this.play('move');
  }
  capture(): void {
    this.play('capture');
  }
  check(): void {
    this.play('check');
  }
  hint(): void {
    this.play('hint');
  }
  success(): void {
    this.play('success');
  }
  error(): void {
    this.play('error');
  }
  gameOver(): void {
    this.play('gameOver');
  }

  private ensureContext(): AudioContext | null {
    if (this.muted()) return null;
    const Ctor: AudioCtor | undefined =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (globalThis as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.7, ctx.currentTime);
        master.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
        this.generation++;
        this.pending = null;
        this.resuming = false;
        this.buffers.clear();
        this.active.clear();
        this.lastPlayed.clear();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private play(effect: SoundEffect): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.schedule(ctx, effect);
      return;
    }
    // Keep only the latest feedback while a browser is unlocking audio.
    this.pending = { effect, generation: this.generation };
    if (this.resuming) return;
    this.resuming = true;
    void ctx
      .resume()
      .then(() => {
        if (this.ctx !== ctx) return;
        const pending = this.pending;
        this.pending = null;
        this.resuming = false;
        if (
          pending &&
          pending.generation === this.generation &&
          !this.muted() &&
          ctx.state === 'running'
        ) {
          this.schedule(ctx, pending.effect);
        }
      })
      .catch(() => {
        if (this.ctx === ctx) {
          this.pending = null;
          this.resuming = false;
        }
      });
  }

  private schedule(ctx: AudioContext, effect: SoundEffect): void {
    const previous = this.lastPlayed.get(effect);
    if (previous !== undefined && ctx.currentTime - previous < (COOLDOWN[effect] ?? 0.09)) return;
    let buffer = this.buffers.get(effect);
    if (!buffer) {
      const samples = renderSound(effect, ctx.sampleRate);
      buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(effect, buffer);
    }
    const source = ctx.createBufferSource();
    const envelope = ctx.createGain();
    source.buffer = buffer;
    source.connect(envelope).connect(this.master!);
    this.active.add(source);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
      this.active.delete(source);
    };
    this.lastPlayed.set(effect, ctx.currentTime);
    source.start(ctx.currentTime + 0.005);
  }
}
