/**
 * SongProgressionController
 *
 * Single responsibility: given a loaded song, track which note Paul
 * must play next and advance the step when he presses + releases it.
 *
 * Input  → note:down / note:up events on the EventBus
 * Output → song:step, note:result, song:complete events + UIManager calls
 *
 * Deliberately has NO knowledge of mic, recording, or audio playback.
 */

import { EventMap, Song, NoteDuration } from './types';

// ── Interfaces ───────────────────────────────────────────────────────────────

type EventBusLike = {
  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
};

// Only the UIManager methods this controller actually needs
type UILike = {
  highlightNote(note: string): void;
  clearAllHighlights(): void;
  flashCorrect(note: string): void;
  startHoldFill(note: string, durationMs: number): void;
  cancelHoldFill(note: string | null): void;
};

// ── Duration map (beats → ms multiplier) ────────────────────────────────────

const BEATS: Record<NoteDuration, number> = {
  whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25,
};

// ── Controller ───────────────────────────────────────────────────────────────

export class SongProgressionController {
  private song: Song | null = null;
  private step = 0;

  // The note currently being held down (waiting for release to advance)
  private pendingNote: string | null = null;

  // Hold-fill visual state (read by the animation loop via getHoldPct)
  private holdStart = 0;
  private holdDurationMs = 0;

  // Pending same-note re-highlight timer — must be cancelled before each new advance
  private sameNoteTimer: ReturnType<typeof setTimeout> | null = null;

  // Scoring
  private correctCount = 0;
  private wrongCount = 0;

  constructor(
    private readonly bus: EventBusLike,
    private readonly ui: UILike,
  ) {
    bus.on('note:down', ({ note }) => this._onDown(note));
    bus.on('note:up',   ({ note }) => this._onUp(note));
    bus.on('note:detected', ({ note }) => this._onMicDetected(note));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Load a song (or null = free play). Resets all state. */
  selectSong(song: Song | null): void {
    if (this.sameNoteTimer !== null) { clearTimeout(this.sameNoteTimer); this.sameNoteTimer = null; }
    this.song         = song;
    this.step         = 0;
    this.pendingNote  = null;
    this.correctCount = 0;
    this.wrongCount   = 0;
    this.holdStart     = 0;
    this.holdDurationMs = 0;
    this.ui.clearAllHighlights();

    if (!song) {
      console.log('[Progression] Free play');
      return;
    }

    this.bus.emit('song:step', { step: 0, playedSteps: [] });
    const first = song.notes[0]?.note;
    if (first) this.ui.highlightNote(first);
    console.log(`[Progression] Song loaded: "${song.title}" — ${song.notes.length} notes`);
  }

  /** 0–1 fill fraction for the hold-bar animation, driven by elapsed time. */
  getHoldPct(): number {
    if (!this.pendingNote || this.holdDurationMs <= 0) return 0;
    return Math.min(1, (Date.now() - this.holdStart) / this.holdDurationMs);
  }

  getStep(): number    { return this.step; }
  isFreePlay(): boolean { return this.song === null; }

  // ── Private handlers ───────────────────────────────────────────────────────

  /**
   * Mic detected a note — instant advance, no hold required.
   * Skips if keyboard is already holding (pendingNote set).
   */
  private _onMicDetected(note: string): void {
    if (!this.song) return;
    if (this.pendingNote) return; // keyboard has priority

    const target = this.song.notes[this.step];
    if (!target) return;

    if (note === target.note) {
      // Set pendingNote temporarily so _advance can read it
      this.pendingNote = note;
      this._advance();
    }
  }

  private _onDown(note: string): void {
    if (!this.song) return;

    const target = this.song.notes[this.step];
    if (!target) return;

    console.log(`[Progression] note:down "${note}" — target "${target.note}" at step ${this.step}`);

    if (note === target.note) {
      this.pendingNote    = note;
      const quarterMs     = 60000 / (this.song.bpm || 90);
      this.holdDurationMs = Math.round(quarterMs * (BEATS[target.duration] ?? 1) * 0.65);
      this.holdStart      = Date.now();
      this.ui.startHoldFill(note, this.holdDurationMs);
    } else {
      this.wrongCount++;
      this.bus.emit('note:result', { step: this.step, note, correct: false });
    }
  }

  private _onUp(note: string): void {
    console.log(`[Progression] note:up "${note}" — pendingNote "${this.pendingNote}"`);
    if (note !== this.pendingNote) return;
    this._advance();
  }

  private _advance(): void {
    // Cancel any stale same-note re-highlight — it would overwrite the new step's highlight
    if (this.sameNoteTimer !== null) { clearTimeout(this.sameNoteTimer); this.sameNoteTimer = null; }

    const note       = this.pendingNote!;
    this.pendingNote = null;
    this.correctCount++;

    this.bus.emit('note:result', { step: this.step, note, correct: true });
    this.ui.flashCorrect(note);
    this.ui.cancelHoldFill(note);

    this.step++;
    this.bus.emit('song:step', {
      step:        this.step,
      playedSteps: Array.from({ length: this.step }, (_, i) => i),
    });

    console.log(`[Progression] Advanced → step ${this.step} / ${this.song!.notes.length}`);

    if (this.step >= this.song!.notes.length) {
      this.ui.clearAllHighlights();
      const total = this.correctCount + this.wrongCount;
      this.bus.emit('song:complete', {
        score:        total > 0 ? Math.round((this.correctCount / total) * 100) : 100,
        correctNotes: this.correctCount,
        totalNotes:   total,
      });
      return;
    }

    const next = this.song!.notes[this.step].note;
    if (next === note) {
      // Same note back-to-back: brief gap so Paul knows to press again.
      // Timer is stored so the NEXT advance can cancel it if Paul presses quickly.
      this.ui.clearAllHighlights();
      this.sameNoteTimer = setTimeout(() => {
        this.sameNoteTimer = null;
        this.ui.highlightNote(next);
      }, 200);
    } else {
      this.ui.highlightNote(next);
    }
  }
}
