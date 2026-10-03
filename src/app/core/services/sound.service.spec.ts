import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundService } from './sound.service';

// Web Audio is absent in jsdom. Record the actual audio graph commands issued
// by the service, including lifecycle and scheduling, rather than mocking it.
class Param {
  value = 1;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class Gain {
  gain = new Param();
  connect = vi.fn((target) => target);
  disconnect = vi.fn();
}
class Source {
  buffer: unknown = null;
  connect = vi.fn((target) => target);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
class Audio {
  static latest: Audio;
  currentTime = 10;
  state = 'running';
  destination = {};
  gains: Gain[] = [];
  sources: Source[] = [];
  sampleRate = 48000;
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  constructor() {
    Audio.latest = this;
  }
  createBuffer(_channels: number, length: number, _rate: number) {
    const data = new Float32Array(length);
    return { copyToChannel: (samples: Float32Array) => data.set(samples) };
  }
  createGain() {
    const node = new Gain();
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const node = new Source();
    this.sources.push(node);
    return node;
  }
}

describe('SoundService', () => {
  beforeEach(() => vi.stubGlobal('AudioContext', Audio));
  afterEach(() => vi.unstubAllGlobals());

  it('suppresses repeated errors but lets another event play, and allows a later error', () => {
    const sound = new SoundService();
    sound.error();
    const audio = Audio.latest;
    const initial = audio.sources.length;
    sound.error();
    expect(audio.sources.length).toBe(initial);
    sound.move();
    expect(audio.sources.length).toBeGreaterThan(initial);
    const afterMove = audio.sources.length;
    audio.currentTime += 1;
    sound.error();
    expect(audio.sources.length).toBe(afterMove + initial);
  });

  it('fades and stops already scheduled notes when muted, and blocks new effects', () => {
    const sound = new SoundService();
    sound.success();
    const audio = Audio.latest;
    sound.toggleMute();
    expect(audio.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.012);
    for (const osc of audio.sources) expect(osc.stop).toHaveBeenLastCalledWith(10.015);
    const count = audio.sources.length;
    sound.error();
    expect(audio.sources.length).toBe(count);
  });

  it('disconnects the source and envelope after a sound ends', () => {
    const sound = new SoundService();
    sound.move();
    const audio = Audio.latest;
    for (const osc of audio.sources) {
      osc.onended?.();
      expect(osc.disconnect).toHaveBeenCalled();
    }
    for (const gain of audio.gains.slice(1)) expect(gain.disconnect).toHaveBeenCalled();
  });

  it('does not replay pending audio after mute then unmute during resume', async () => {
    const sound = new SoundService();
    sound.move();
    const audio = Audio.latest;
    audio.state = 'suspended';
    let finish!: () => void;
    audio.resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const count = audio.sources.length;
    sound.success();
    expect(audio.sources.length).toBe(count);
    sound.toggleMute();
    sound.toggleMute();
    finish();
    await Promise.resolve();
    expect(audio.sources.length).toBe(count);
  });

  it('handles a rejected resume and lets a later gesture retry', async () => {
    const sound = new SoundService();
    sound.move();
    const audio = Audio.latest;
    audio.state = 'suspended';
    audio.resume = vi.fn(async () => {
      throw new Error('autoplay blocked');
    });
    const count = audio.sources.length;
    sound.error();
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.sources.length).toBe(count);
    audio.resume = vi.fn(async () => {
      audio.state = 'running';
    });
    sound.error();
    await Promise.resolve();
    expect(audio.sources.length).toBeGreaterThan(count);
  });

  it('plays only the latest event after a delayed audio unlock', async () => {
    const sound = new SoundService();
    sound.move();
    const audio = Audio.latest;
    audio.state = 'suspended';
    let finish!: () => void;
    audio.resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            audio.state = 'running';
            resolve();
          };
        }),
    );
    const count = audio.sources.length;
    sound.hint();
    sound.error();
    sound.success();
    expect(audio.resume).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    expect(audio.sources.length).toBe(count + 1);
  });

  it('is safe when audio is unavailable or construction is blocked', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => new SoundService().error()).not.toThrow();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    expect(() => new SoundService().move()).not.toThrow();
  });
});
