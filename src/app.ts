/**
 * Piano App - Main Entry Point
 * Orchestrates all modules via EventBus
 */

import { PitchEngine }      from './pitch-engine';
import { AudioManager }     from './audio-manager';
import { SongLibrary }      from './song-library';
import { RecordingManager } from './recording-manager';
import { SongVisualizer }   from './song-visualizer';
import { UIManager }        from './ui-manager';
import { EventMap, Song, NoteDuration } from './types';

// ── EventBus ────────────────────────────────────────────────────────────────

class EventBus {
  private listeners: Partial<{ [K in keyof EventMap]: Array<(data: EventMap[K]) => void> }> = {};

  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [] as never;
    (this.listeners[event] as Array<(data: EventMap[K]) => void>).push(fn);
  }

  off<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void {
    const list = this.listeners[event];
    if (list) this.listeners[event] = list.filter(f => f !== fn) as never;
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners[event]?.forEach(fn => (fn as (data: EventMap[K]) => void)(data));
  }

  removeAllListeners(): void {
    this.listeners = {};
  }
}

// ── Duration map ─────────────────────────────────────────────────────────────

const DURATION_MAP: Record<NoteDuration, number> = {
  whole:     4,
  half:      2,
  quarter:   1,
  eighth:    0.5,
  sixteenth: 0.25
};

// ── PianoApp ─────────────────────────────────────────────────────────────────

class PianoApp {
  private readonly eventBus: EventBus;
  private readonly audioManager: AudioManager;
  private readonly pitchEngine: PitchEngine;
  private readonly songLibrary: SongLibrary;
  private readonly recordingManager: RecordingManager;
  private readonly songVisualizer: SongVisualizer;
  private readonly uiManager: UIManager;

  // State
  private currentSong: Song | null;
  private currentSongId: string;
  private currentStep: number;
  private isMicActive: boolean;
  private isRecording: boolean;

  // Hold-duration state
  private _holdNote: string | null;
  private _holdTimer: ReturnType<typeof setTimeout> | null;
  private _holdStart: number;
  private _holdDurationMs: number;

  // Scoring — track real accuracy
  private _correctNotes: number;
  private _wrongNotes: number;

  // Voice-to-piano experimental mode
  private _voicePianoMode: boolean;

  constructor() {
    this.eventBus = new EventBus();

    // Initialize modules
    this.audioManager     = new AudioManager(this.eventBus);
    this.pitchEngine      = new PitchEngine(this.eventBus);
    this.songLibrary      = new SongLibrary();
    this.recordingManager = new RecordingManager(this.eventBus, this.audioManager);

    // non-null assertion: canvas element is required in piano.html
    const timelineCanvas  = document.getElementById('timeline-canvas') as HTMLCanvasElement;
    this.songVisualizer   = new SongVisualizer(this.eventBus, timelineCanvas);
    this.uiManager        = new UIManager(this.eventBus, this.audioManager);

    // State
    this.currentSong   = null;
    this.currentSongId = 'free';
    this.currentStep   = 0;
    this.isMicActive   = false;
    this.isRecording   = false;

    // Hold-duration state
    this._holdNote       = null;
    this._holdTimer      = null;
    this._holdStart      = 0;
    this._holdDurationMs = 0;

    // Scoring
    this._correctNotes = 0;
    this._wrongNotes   = 0;

    // Voice-to-piano mode
    this._voicePianoMode = false;

    // Initialize
    void this.init();
  }

  private async init(): Promise<void> {
    console.log('Piano App initializing...');

    // Load songs
    await this.songLibrary.load();
    console.log(`Loaded ${this.songLibrary.getAllSongs().length} songs`);

    // Render initial UI
    this.uiManager.renderSongGrid(this.songLibrary.getAllSongs());

    // Setup event listeners
    this.setupEventListeners();

    // Start with free play
    this.selectSong('free');

    // Start animation loop
    this.startAnimationLoop();

    console.log('Piano App ready!');
  }

  private setupEventListeners(): void {
    // Mic toggle
    this.eventBus.on('mic:toggle', () => void this.toggleMicrophone());

    // Song selection
    this.eventBus.on('song:selected', (data) => this.selectSong(data.songId));

    // Note detection from mic
    this.eventBus.on('note:detected', (data) => this.onNoteDetected(data));

    // Keyboard note down / up
    this.eventBus.on('note:down', (data) => this.onNoteDown(data));
    this.eventBus.on('note:up',   (data) => this.onNoteUp(data));

    // Volume changed
    this.eventBus.on('volume:changed', (data) => {
      this.audioManager.setVolume(data.volume);
    });

    // Playback requests
    this.eventBus.on('playback:request', () => void this.recordingManager.playRecording());

    // Home button
    this.eventBus.on('home:clicked', () => {
      this.recordingManager.stopRecording();
      this.selectSong('free');
    });

    // Recording events
    this.eventBus.on('recording:stop', (data) => {
      console.log(`Recording stopped: ${data.noteCount} notes, ${data.duration}ms`);
    });

    // Frequency range sliders
    const freqMinControl = document.getElementById('freq-min-control') as HTMLInputElement | null;
    const freqMaxControl = document.getElementById('freq-max-control') as HTMLInputElement | null;
    const freqMinLabel   = document.getElementById('freq-min-label');
    const freqMaxLabel   = document.getElementById('freq-max-label');

    const freqToNoteName = (hz: number): string => {
      const midi = Math.round(12 * Math.log2(hz / 440) + 69);
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
    };

    freqMinControl?.addEventListener('input', () => {
      const hz = parseInt(freqMinControl.value);
      // Clamp so min never exceeds max
      if (hz >= this.pitchEngine.FREQ_MAX) {
        freqMinControl.value = String(this.pitchEngine.FREQ_MAX - 10);
        return;
      }
      this.pitchEngine.FREQ_MIN = hz;
      if (freqMinLabel) freqMinLabel.textContent = `${hz} Hz (${freqToNoteName(hz)})`;
    });

    freqMaxControl?.addEventListener('input', () => {
      const hz = parseInt(freqMaxControl.value);
      if (hz <= this.pitchEngine.FREQ_MIN) {
        freqMaxControl.value = String(this.pitchEngine.FREQ_MIN + 10);
        return;
      }
      this.pitchEngine.FREQ_MAX = hz;
      if (freqMaxLabel) freqMaxLabel.textContent = `${hz} Hz (${freqToNoteName(hz)})`;
    });

    // Voice-to-piano toggle
    const voiceToggle = document.getElementById('voice-piano-toggle') as HTMLInputElement | null;
    voiceToggle?.addEventListener('change', () => {
      this._voicePianoMode = voiceToggle.checked;
      // Auto-start mic when enabling voice-piano mode
      if (this._voicePianoMode && !this.isMicActive) {
        void this.toggleMicrophone();
      }
    });
  }

  async toggleMicrophone(): Promise<void> {
    if (!this.isMicActive) {
      try {
        await this.pitchEngine.start();
        this.isMicActive = true;
        this.recordingManager.startRecording();
        this.isRecording = true;
        this.uiManager.updateMicUI(true);
        console.log('Microphone activated');
      } catch (err) {
        const msg = err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Please allow microphone access in your browser settings.'
          : err instanceof Error
            ? `Microphone error: ${err.message}`
            : 'Could not start microphone.';
        console.error('[Mic]', err);
        alert(msg);
      }
    } else {
      this.pitchEngine.stop();
      this.isMicActive = false;
      this.recordingManager.stopRecording();
      this.isRecording = false;
      this.uiManager.updateMicUI(false);
      console.log('Microphone deactivated');
    }
  }

  private onNoteDetected(data: EventMap['note:detected']): void {
    const { note } = data;

    this.uiManager.animateKey(note, 'listening');

    // Voice-to-piano experimental mode: play the detected note as piano sound
    if (this._voicePianoMode && this.currentSongId === 'free') {
      this.audioManager.playSound(note);
      return;
    }

    // Mic pitch = same hold system as keyboard, but only start if not already holding this note
    if (this.currentSong && this.currentSongId !== 'free') {
      const target = this.currentSong.notes[this.currentStep];
      if (target && note === target.note && this._holdNote !== note) {
        this._startHold(note, target.duration, this.currentSong.bpm);
      }
    }
  }

  private onNoteDown(data: EventMap['note:down']): void {
    const { note } = data;

    // Record for playback
    this.eventBus.emit('note:played', { note, source: 'keyboard' });

    if (!this.currentSong || this.currentSongId === 'free') return;

    const target = this.currentSong.notes[this.currentStep];
    if (!target) return;

    if (note === target.note) {
      // Correct note pressed — start hold timer
      this._startHold(note, target.duration, this.currentSong.bpm);
    } else {
      // Wrong note — count it, mark in visualizer, but don't punish Paul
      this._wrongNotes++;
      this.eventBus.emit('note:result', { step: this.currentStep, note, correct: false });
    }
  }

  private onNoteUp(data: EventMap['note:up']): void {
    const { note } = data;
    if (note !== this._holdNote) return;
    // Any press+release of the correct note advances — hold bar is visual only
    this._completeHold();
  }

  private _startHold(note: string, duration: NoteDuration, bpm: number): void {
    if (this._holdTimer !== null) clearTimeout(this._holdTimer);
    this._holdNote  = note;
    this._holdStart = Date.now();

    const quarter    = 60000 / (bpm || 90);
    const raw        = quarter * (DURATION_MAP[duration] ?? 1);
    // Scale down so it's fun, not frustrating for a 5-year-old
    this._holdDurationMs = Math.round(raw * 0.65);

    // Show the fill bar rising inside the key
    this.uiManager.startHoldFill(note, this._holdDurationMs);

    // No auto-advance — Paul must release the key to trigger completion.
    // The fill bar reaching 100% is the visual cue to release.
  }

  private _completeHold(): void {
    if (this._holdTimer !== null) clearTimeout(this._holdTimer);
    const note = this._holdNote;
    this._holdNote = null;
    if (!note) return;

    this._correctNotes++;
    this.eventBus.emit('note:result', { step: this.currentStep, note, correct: true });

    this.uiManager.flashCorrect(note);
    this.uiManager.cancelHoldFill(note);
    this._advanceSong(note);
  }

  private _advanceSong(completedNote: string): void {
    this.currentStep++;
    this.eventBus.emit('song:step', {
      step: this.currentStep,
      playedSteps: Array.from({ length: this.currentStep }, (_, i) => i)
    });

    const song = this.currentSong;
    if (!song) return;

    const notes = song.notes;
    if (this.currentStep >= notes.length) {
      this.uiManager.clearAllHighlights();
      const total = this._correctNotes + this._wrongNotes;
      const score = total > 0 ? Math.round((this._correctNotes / total) * 100) : 100;
      this.showCelebration(song.title, score);
    } else {
      const nextNote = notes[this.currentStep].note;
      if (nextNote === completedNote) {
        // Same note: brief gap so Paul knows to press again
        this.uiManager.clearAllHighlights();
        setTimeout(() => this.uiManager.highlightNote(nextNote), 250);
      } else {
        this.uiManager.highlightNote(nextNote);
      }
    }
  }

  private selectSong(songId: string): void {
    this.currentSongId = songId;
    this.recordingManager.clear();
    this.songVisualizer.clear();
    this.uiManager.clearAllHighlights();

    this.currentStep   = 0;
    this._correctNotes = 0;
    this._wrongNotes   = 0;

    if (songId === 'free') {
      this.currentSong = null;
      this.uiManager.clearAllHighlights();
      console.log('Free play mode');
    } else {
      this.currentSong = this.songLibrary.getSong(songId) ?? null;
      if (this.currentSong) {
        this.songVisualizer.setSong(this.currentSong);
        // Tell visualizer we're at step 0
        this.eventBus.emit('song:step', { step: 0, playedSteps: [] });
        // Highlight the first note on the piano
        const firstNote = this.currentSong.notes[0]?.note;
        if (firstNote) this.uiManager.highlightNote(firstNote);
        console.log(`Selected song: ${this.currentSong.title}`);
      }
    }

    // Auto-start mic
    if (!this.isMicActive) {
      void this.toggleMicrophone();
    }
  }

  private showCelebration(songTitle: string, score: number): void {
    this.recordingManager.stopRecording();
    this.pitchEngine.stop();
    this.isMicActive = false;
    this.isRecording = false;
    this.uiManager.updateMicUI(false);

    // Show celebration
    this.uiManager.showCelebration(songTitle, Math.round(score));

    // Setup celebration buttons
    const hearBtn    = document.getElementById('hear-btn')!;
    const againBtn   = document.getElementById('again-btn')!;
    const newSongBtn = document.getElementById('new-song-btn')!;

    const cleanup = (): void => {
      hearBtn.removeEventListener('click', playHandler);
      againBtn.removeEventListener('click', againHandler);
      newSongBtn.removeEventListener('click', newHandler);
    };

    const playHandler = (): void => {
      void this.recordingManager.playRecording();
    };
    const againHandler = (): void => {
      this.uiManager.hideCelebration();
      this.selectSong(this.currentSongId);
      cleanup();
    };
    const newHandler = (): void => {
      this.uiManager.hideCelebration();
      this.uiManager.showSongPicker();
      cleanup();
    };

    hearBtn.addEventListener('click', playHandler);
    againBtn.addEventListener('click', againHandler);
    newSongBtn.addEventListener('click', newHandler);
  }

  private startAnimationLoop(): void {
    const renderTimeline = (): void => {
      // Update hold-arc progress in visualizer
      if (this._holdNote && this._holdDurationMs > 0) {
        const elapsed = Date.now() - this._holdStart;
        this.songVisualizer.holdPct = Math.min(1, elapsed / this._holdDurationMs);
      } else {
        this.songVisualizer.holdPct = 0;
      }
      this.songVisualizer.render();
      requestAnimationFrame(renderTimeline);
    };
    requestAnimationFrame(renderTimeline);
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  (window as Window & typeof globalThis & { pianoApp?: PianoApp }).pianoApp = new PianoApp();
});
