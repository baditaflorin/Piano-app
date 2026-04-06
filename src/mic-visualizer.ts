/**
 * MicVisualizer — real-time audio spectrum for free-play mode.
 *
 * Uses audioMotion-analyzer (production-grade, zero-dependency) to render
 * a radial frequency spectrum from the PitchEngine's AnalyserNode.
 * Overlays a large note name whenever the pitch engine detects a note.
 */

import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { EventMap } from './types';

// Synesthesia gradient stops — one colour per pitch class, matching the key colours
const GRADIENT_STOPS = [
  { color: '#FF4444', pos: 0    }, // C  – red
  { color: '#FF8844', pos: 0.14 }, // D  – orange
  { color: '#FFDD44', pos: 0.28 }, // E  – yellow
  { color: '#44DD44', pos: 0.42 }, // F  – green
  { color: '#44DDDD', pos: 0.57 }, // G  – cyan
  { color: '#4488FF', pos: 0.71 }, // A  – blue
  { color: '#AA44FF', pos: 0.85 }, // B  – purple
  { color: '#FF4444', pos: 1    }, // C  – red (wrap)
];

// Pitch class → synesthesia hex
const NOTE_COLOR: Record<string, string> = {
  'C': '#FF4444', 'C#': '#FF6655', 'D': '#FF8844', 'D#': '#FFAA66',
  'E': '#FFDD44', 'F':  '#44DD44', 'F#': '#66EE66',
  'G': '#44DDDD', 'G#': '#66DDDD', 'A': '#4488FF', 'A#': '#6699FF',
  'B': '#AA44FF',
};

type BusLike = {
  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void;
};

export class MicVisualizer {
  private motion:    AudioMotionAnalyzer | null = null;
  private noteEl:    HTMLElement | null;
  private noteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly container: HTMLElement,
    bus: BusLike,
  ) {
    this.noteEl = container.querySelector<HTMLElement>('.freeplay-note-name');
    bus.on('note:detected', ({ note }) => this._showNote(note));
  }

  /**
   * Call once the mic is running.
   * Pass the live AnalyserNode and AudioContext from PitchEngine.
   */
  connect(analyser: AnalyserNode, ctx: AudioContext): void {
    if (this.motion) return; // already connected

    this.motion = new AudioMotionAnalyzer(this.container, {
      audioCtx:        ctx,
      connectSpeakers: false,  // do NOT route mic audio to speakers
      start:           true,
    });

    this.motion.registerGradient('paul', {
      bgColor:    '#120820',
      colorStops: GRADIENT_STOPS,
    });

    this.motion.setOptions({
      mode:           2,      // 1/12th-octave bands — nice density for a piano range
      radial:         true,   // circular / star shape
      frequencyScale: 'log',
      fftSize:        8192,
      smoothing:      0.82,
      minFreq:        80,
      maxFreq:        2200,
      showPeaks:      false,
      lumiBars:       true,   // bars fade when quiet
      gradient:       'paul',
    });

    this.motion.connectInput(analyser);
  }

  /** Show the visualizer container (called when entering free play). */
  show(): void { this.container.style.display = 'block'; }

  /** Hide the visualizer container (called when a song is selected). */
  hide(): void { this.container.style.display = 'none'; }

  /** Stop and release all resources. */
  destroy(): void {
    if (this.motion) {
      this.motion.disconnectInput();
      this.motion.stop();
      this.motion = null;
    }
  }

  private _showNote(note: string): void {
    if (!this.noteEl) return;
    const letter = note.replace(/\d/, '');
    const color  = NOTE_COLOR[letter] ?? '#fff';

    this.noteEl.textContent  = note;
    this.noteEl.style.color  = color;
    this.noteEl.style.textShadow = `0 0 32px ${color}, 0 0 64px ${color}88`;
    this.noteEl.style.opacity = '1';

    if (this.noteTimer !== null) clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => {
      if (this.noteEl) this.noteEl.style.opacity = '0';
      this.noteTimer = null;
    }, 600);
  }
}
