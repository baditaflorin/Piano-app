/**
 * Audio Manager
 * Web Audio API piano synthesis — no MP3 files needed.
 * Creates a realistic piano-like sound using harmonics + ADSR envelope.
 */

import { EventMap } from './types';

export class AudioManager {
  private eventBus: { emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void } | null;
  public volume: number;
  private _ctx: AudioContext | null;

  private readonly _semitones: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };

  constructor(eventBus: { emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void } | null) {
    this.eventBus = eventBus;
    this.volume = 0.6;
    this._ctx = null;
  }

  get ctx(): AudioContext {
    if (!this._ctx) {
      this._ctx = new AudioContext();
    }
    return this._ctx;
  }

  /** Convert note name like "C4", "G#5" → Hz */
  noteToFreq(noteName: string): number {
    const m = noteName.match(/^([A-Gb#]+)(\d+)$/);
    if (!m) return 440;
    const semitone = this._semitones[m[1]];
    if (semitone === undefined) return 440;
    const octave = parseInt(m[2], 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Play a piano-like note.
   * sustainMs controls how long the note is held before release decay.
   */
  playNote(noteName: string, sustainMs: number = 800): void {
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();

    const freq    = this.noteToFreq(noteName);
    const vol     = this.volume;
    const now     = ctx.currentTime;
    const sustain = Math.max(sustainMs / 1000, 0.15);

    // Frequencies decay faster at higher pitches — mimic real piano strings
    const decayFactor = Math.max(0.3, 1 - (freq - 130) / 2000);
    const totalDur    = sustain + 1.2 * decayFactor;

    const master = ctx.createGain();
    master.connect(ctx.destination);

    // ── Attack transient (the "thump" of the hammer hitting the string) ──
    const thump     = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.value = freq * 1.4;
    thumpGain.gain.setValueAtTime(vol * 0.4, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.06);

    // ── Fundamental (sine) ── persists the longest
    this._addOsc(ctx, master, 'sine', freq, now, [
      [0,        0],
      [0.006,    vol * 0.7],
      [0.10,     vol * 0.38],
      [sustain,  vol * 0.22 * decayFactor],
      [totalDur, 0.0001]
    ], totalDur);

    // ── 2nd harmonic ── decays faster
    this._addOsc(ctx, master, 'sine', freq * 2, now, [
      [0,              0],
      [0.006,          vol * 0.18],
      [0.08,           vol * 0.08],
      [totalDur * 0.5, 0.0001]
    ], totalDur * 0.5);

    // ── 3rd harmonic ── very short
    this._addOsc(ctx, master, 'sine', freq * 3, now, [
      [0,     0],
      [0.006, vol * 0.07],
      [0.04,  0.0001]
    ], 0.05);
  }

  /** Helper: create an oscillator with a gain envelope */
  private _addOsc(
    ctx: AudioContext,
    destination: GainNode,
    type: OscillatorType,
    freq: number,
    now: number,
    envelope: [number, number][],
    stopAfter: number
  ): void {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(envelope[0][1], now + envelope[0][0]);
    for (let i = 1; i < envelope.length; i++) {
      const [t, v] = envelope[i];
      if (v <= 0) {
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t);
      } else if (i === 1) {
        gain.gain.linearRampToValueAtTime(v, now + t);
      } else {
        gain.gain.exponentialRampToValueAtTime(v, now + t);
      }
    }

    osc.connect(gain);
    gain.connect(destination);
    osc.start(now);
    osc.stop(now + stopAfter + 0.05);
  }

  /** Shorthand for immediate single-press play (free play / key click) */
  playSound(noteName: string): void {
    this.playNote(noteName, 600);
  }

  setVolume(value: number): void {
    this.volume = value;
  }
}
