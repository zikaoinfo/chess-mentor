export type SoundEffect = 'move' | 'capture' | 'check' | 'hint' | 'success' | 'error' | 'gameOver';

type Material = 'wood' | 'felt' | 'glass';
interface Strike {
  at: number;
  frequency: number;
  strength: number;
  decay: number;
  material: Material;
}
interface Sound {
  duration: number;
  peak: number;
  strikes: readonly Strike[];
}

// Inharmonic partials and a filtered contact transient give each strike a
// material texture. No pitch slides, square waves, or external audio files.
const SOUNDS: Record<SoundEffect, Sound> = {
  move: {
    duration: 0.16,
    peak: 0.46,
    strikes: [
      { at: 0, frequency: 235, strength: 1, decay: 0.022, material: 'wood' },
      { at: 0.009, frequency: 510, strength: 0.23, decay: 0.012, material: 'wood' },
    ],
  },
  capture: {
    duration: 0.23,
    peak: 0.58,
    strikes: [
      { at: 0, frequency: 175, strength: 1, decay: 0.029, material: 'wood' },
      { at: 0.032, frequency: 390, strength: 0.55, decay: 0.021, material: 'wood' },
    ],
  },
  error: {
    duration: 0.3,
    peak: 0.32,
    strikes: [
      { at: 0, frequency: 293.66, strength: 1, decay: 0.032, material: 'felt' },
      { at: 0.105, frequency: 246.94, strength: 0.8, decay: 0.04, material: 'felt' },
    ],
  },
  check: {
    duration: 0.38,
    peak: 0.38,
    strikes: [
      { at: 0, frequency: 587.33, strength: 1, decay: 0.05, material: 'glass' },
      { at: 0.085, frequency: 783.99, strength: 0.7, decay: 0.06, material: 'glass' },
    ],
  },
  hint: {
    duration: 0.43,
    peak: 0.27,
    strikes: [
      { at: 0, frequency: 659.25, strength: 1, decay: 0.065, material: 'glass' },
      { at: 0.09, frequency: 987.77, strength: 0.55, decay: 0.07, material: 'glass' },
    ],
  },
  success: {
    duration: 0.7,
    peak: 0.36,
    strikes: [
      { at: 0, frequency: 523.25, strength: 1, decay: 0.085, material: 'glass' },
      { at: 0.075, frequency: 659.25, strength: 0.8, decay: 0.09, material: 'glass' },
      { at: 0.15, frequency: 783.99, strength: 0.7, decay: 0.095, material: 'glass' },
      { at: 0.22, frequency: 1046.5, strength: 0.38, decay: 0.1, material: 'glass' },
    ],
  },
  gameOver: {
    duration: 0.64,
    peak: 0.33,
    strikes: [
      { at: 0, frequency: 392, strength: 1, decay: 0.08, material: 'felt' },
      { at: 0.12, frequency: 329.63, strength: 0.8, decay: 0.085, material: 'felt' },
      { at: 0.24, frequency: 261.63, strength: 0.7, decay: 0.095, material: 'felt' },
    ],
  },
};

/** Render once per effect at the device sample rate, then cache for playback.
 * Pure PCM generation also lets previews use exactly the game's samples.
 */
export function renderSound(effect: SoundEffect, sampleRate: number): Float32Array<ArrayBuffer> {
  const sound = SOUNDS[effect];
  const samples = new Float32Array(Math.round(sound.duration * sampleRate));
  let seed = 173;
  for (const strike of sound.strikes) {
    const offset = Math.round(strike.at * sampleRate);
    const wood = strike.material === 'wood';
    const glass = strike.material === 'glass';
    const attack = wood ? 0.0008 : glass ? 0.0025 : 0.006;
    const ratios = wood ? [1, 2.37, 4.13] : glass ? [1, 2.01, 4.18] : [1, 2.76, 5.4];
    const weights = wood ? [0.65, 0.26, 0.09] : glass ? [0.78, 0.18, 0.04] : [0.9, 0.085, 0.015];
    // A one-pole low-pass removes harsh high frequencies from the contact.
    const filter = 1 - Math.exp((-2 * Math.PI * (wood ? 1700 : 900)) / sampleRate);
    let contact = 0;
    for (let i = offset; i < samples.length; i++) {
      const t = (i - offset) / sampleRate;
      const onset = 1 - Math.exp(-t / attack);
      let tone = 0;
      for (let partial = 0; partial < 3; partial++) {
        tone +=
          weights[partial] *
          Math.sin(2 * Math.PI * strike.frequency * ratios[partial] * t) *
          Math.exp((-t * (1 + partial * 0.8)) / strike.decay);
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      contact += filter * (seed / 2147483648 - contact);
      const noise = contact * Math.exp(-t / (wood ? 0.009 : 0.005)) * (wood ? 0.75 : 0.07);
      samples[i] += strike.strength * onset * (tone + noise);
    }
  }
  // Smooth the final 18 ms, remove any residual DC, and leave mixing headroom.
  let average = 0;
  for (const value of samples) average += value;
  average /= samples.length;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const fadeIn = Math.min(1, i / (sampleRate * 0.001));
    const fadeOut = Math.min(1, (samples.length - 1 - i) / (sampleRate * 0.018));
    samples[i] = (samples[i] - average) * fadeIn * fadeOut;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak > 0) {
    const gain = sound.peak / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  }
  return samples;
}
