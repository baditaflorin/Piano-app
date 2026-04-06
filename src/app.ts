/**
 * PianoApp — orchestrator only.
 *
 * This file wires modules together. It contains NO game logic.
 * All song-progression decisions live in SongProgressionController.
 */

import { PitchEngine }                from './pitch-engine';
import { AudioManager }               from './audio-manager';
import { SongLibrary }                from './song-library';
import { RecordingManager }           from './recording-manager';
import { SongVisualizer }             from './song-visualizer';
import { UIManager }                  from './ui-manager';
import { SongProgressionController }  from './song-progression-controller';
import { EventMap }                   from './types';

// ── EventBus ─────────────────────────────────────────────────────────────────

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
}

// ── PianoApp ──────────────────────────────────────────────────────────────────

class PianoApp {
  private readonly bus:          EventBus;
  private readonly audio:        AudioManager;
  private readonly pitch:        PitchEngine;
  private readonly library:      SongLibrary;
  private readonly recorder:     RecordingManager;
  private readonly visualizer:   SongVisualizer;
  private readonly ui:           UIManager;
  private readonly progression:  SongProgressionController;

  private isMicActive    = false;
  private currentSongId  = 'free';
  private voicePianoMode = false;

  constructor() {
    this.bus        = new EventBus();
    this.audio      = new AudioManager(this.bus);
    this.pitch      = new PitchEngine(this.bus);
    this.library    = new SongLibrary();
    this.recorder   = new RecordingManager(this.bus, this.audio);
    this.visualizer = new SongVisualizer(
      this.bus,
      document.getElementById('timeline-canvas') as HTMLCanvasElement,
    );
    this.ui          = new UIManager(this.bus, this.audio);
    this.progression = new SongProgressionController(this.bus, this.ui);

    void this.init();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  private async init(): Promise<void> {
    await this.library.load();
    this.ui.renderSongGrid(this.library.getAllSongs());
    this._wire();
    this._wireSettings();
    this._selectSong('free');
    this._startLoop();
  }

  // ── Event wiring ───────────────────────────────────────────────────────────

  private _wire(): void {
    this.bus.on('mic:toggle',      ()       => void this._toggleMic());
    this.bus.on('song:selected',   ({ songId }) => this._selectSong(songId));
    this.bus.on('note:down',       ({ note })   => this.bus.emit('note:played', { note, source: 'keyboard' }));
    this.bus.on('note:detected',   ({ note })   => this._onMicNote(note));
    this.bus.on('volume:changed',  ({ volume }) => this.audio.setVolume(volume));
    this.bus.on('playback:request',()       => void this.recorder.playRecording());
    this.bus.on('home:clicked',    ()       => { this.recorder.stopRecording(); this._selectSong('free'); });
    this.bus.on('song:complete',   ({ score, correctNotes, totalNotes }) =>
      this._celebrate(score, correctNotes, totalNotes),
    );
  }

  // ── Settings panel controls ────────────────────────────────────────────────

  private _wireSettings(): void {
    // Frequency range sliders
    const freqMinEl    = document.getElementById('freq-min-control') as HTMLInputElement | null;
    const freqMaxEl    = document.getElementById('freq-max-control') as HTMLInputElement | null;
    const freqMinLabel = document.getElementById('freq-min-label');
    const freqMaxLabel = document.getElementById('freq-max-label');

    const hzToNote = (hz: number): string => {
      const midi  = Math.round(12 * Math.log2(hz / 440) + 69);
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
    };

    freqMinEl?.addEventListener('input', () => {
      const hz = parseInt(freqMinEl.value);
      if (hz >= this.pitch.FREQ_MAX) { freqMinEl.value = String(this.pitch.FREQ_MAX - 10); return; }
      this.pitch.FREQ_MIN = hz;
      if (freqMinLabel) freqMinLabel.textContent = `${hz} Hz (${hzToNote(hz)})`;
    });

    freqMaxEl?.addEventListener('input', () => {
      const hz = parseInt(freqMaxEl.value);
      if (hz <= this.pitch.FREQ_MIN) { freqMaxEl.value = String(this.pitch.FREQ_MIN + 10); return; }
      this.pitch.FREQ_MAX = hz;
      if (freqMaxLabel) freqMaxLabel.textContent = `${hz} Hz (${hzToNote(hz)})`;
    });

    // Voice-to-piano experimental toggle
    const voiceToggle = document.getElementById('voice-piano-toggle') as HTMLInputElement | null;
    voiceToggle?.addEventListener('change', () => {
      this.voicePianoMode = voiceToggle.checked;
      if (this.voicePianoMode && !this.isMicActive) void this._toggleMic();
    });
  }

  // ── Mic note handler (separate from progression) ───────────────────────────

  private _onMicNote(note: string): void {
    this.ui.animateKey(note, 'listening');
    if (this.voicePianoMode && this.currentSongId === 'free') {
      this.audio.playSound(note);
    }
  }

  // ── Song selection ─────────────────────────────────────────────────────────

  private _selectSong(songId: string): void {
    this.currentSongId = songId;
    this.recorder.clear();
    this.visualizer.clear();

    const song = songId === 'free'
      ? null
      : (this.library.getSong(songId) ?? null);

    if (song) this.visualizer.setSong(song);

    // Hand off to progression controller — it handles highlight + step reset
    this.progression.selectSong(song);

    if (!this.isMicActive) void this._toggleMic();
  }

  // ── Microphone ─────────────────────────────────────────────────────────────

  private async _toggleMic(): Promise<void> {
    if (!this.isMicActive) {
      try {
        await this.pitch.start();
        this.isMicActive = true;
        this.recorder.startRecording();
        this.ui.updateMicUI(true);
      } catch (err) {
        const msg = err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Please allow microphone access in your browser settings.'
          : err instanceof Error ? `Microphone error: ${err.message}` : 'Could not start microphone.';
        alert(msg);
      }
    } else {
      this.pitch.stop();
      this.isMicActive = false;
      this.recorder.stopRecording();
      this.ui.updateMicUI(false);
    }
  }

  // ── Celebration ────────────────────────────────────────────────────────────

  private _celebrate(score: number, _correct: number, _total: number): void {
    this.recorder.stopRecording();
    this.pitch.stop();
    this.isMicActive = false;
    this.ui.updateMicUI(false);

    const songTitle = this.library.getSong(this.currentSongId)?.title ?? 'the song';
    this.ui.showCelebration(songTitle, score);

    const hearBtn    = document.getElementById('hear-btn')!;
    const againBtn   = document.getElementById('again-btn')!;
    const newSongBtn = document.getElementById('new-song-btn')!;

    const cleanup = (): void => {
      hearBtn.removeEventListener('click', onHear);
      againBtn.removeEventListener('click', onAgain);
      newSongBtn.removeEventListener('click', onNew);
    };
    const onHear  = (): void => { void this.recorder.playRecording(); };
    const onAgain = (): void => { this.ui.hideCelebration(); this._selectSong(this.currentSongId); cleanup(); };
    const onNew   = (): void => { this.ui.hideCelebration(); this.ui.showSongPicker(); cleanup(); };

    hearBtn.addEventListener('click', onHear);
    againBtn.addEventListener('click', onAgain);
    newSongBtn.addEventListener('click', onNew);
  }

  // ── Animation loop ─────────────────────────────────────────────────────────

  private _startLoop(): void {
    const tick = (): void => {
      this.visualizer.holdPct = this.progression.getHoldPct();
      this.visualizer.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  (window as Window & typeof globalThis & { pianoApp?: PianoApp }).pianoApp = new PianoApp();
});
