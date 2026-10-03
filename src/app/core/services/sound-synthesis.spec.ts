import { describe, expect, it } from 'vitest';
import { renderSound, type SoundEffect } from './sound-synthesis';

const effects: SoundEffect[] = ['move', 'capture', 'error', 'check', 'hint', 'success', 'gameOver'];

describe('game sound rendering', () => {
  it.each(effects)(
    '%s produces finite, audible samples with headroom and silent edges',
    (effect) => {
      const samples = renderSound(effect, 48000);
      let peak = 0;
      let energy = 0;
      for (const sample of samples) {
        expect(Number.isFinite(sample)).toBe(true);
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      expect(peak).toBeGreaterThan(0.05);
      expect(peak).toBeLessThanOrEqual(0.8);
      expect(Math.sqrt(energy / samples.length)).toBeGreaterThan(0.008);
      expect(Math.abs(samples[0])).toBe(0);
      expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.0001);
    },
  );

  it('preserves timing at different hardware sample rates', () => {
    const low = renderSound('error', 24000);
    const high = renderSound('error', 48000);
    expect(high.length).toBe(low.length * 2);
  });
});
