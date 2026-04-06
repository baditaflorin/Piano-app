/**
 * Song Visualizer — Piano Roll
 *
 * Renders a standard piano-roll view:
 *   • Left margin  : mini vertical piano keyboard so the user can map rows → keys
 *   • Main area    : horizontal note blocks, width ∝ note duration
 *   • Y axis       : pitch (B5 at top, C4 at bottom)
 *   • X axis       : steps (scrolls to keep current note visible)
 *   • Hold fill    : green fill inside the current block grows as Paul holds
 *   • Played notes : green tint on completed steps, correct/wrong result shown
 */

import { EventMap, NoteDuration, Song } from './types';

type EventBusLike = {
  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void;
};

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_NOTES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
const IS_BLACK   = [false,true,false,true,false,false,true,false,true,false,true,false];
const MIN_OCT    = 4;   // C4 = bottom row
const MAX_OCT    = 5;   // B5 = top row
const TOTAL_ROWS = (MAX_OCT - MIN_OCT + 1) * 12; // 24 semitones
const LEFT_W     = 40;  // width of keyboard label column (px)

/** Duration → quarter-note beats */
const BEATS: Record<NoteDuration, number> = {
  whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "G4", "C#5" → semitones above C4 (0 = C4, 23 = B5) */
function toSemi(noteName: string): number {
  const m = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!m) return 0;
  const semi = ALL_NOTES.indexOf(m[1] as typeof ALL_NOTES[number]);
  return (parseInt(m[2]) - MIN_OCT) * 12 + (semi < 0 ? 0 : semi);
}

/** Semitone above C4 → row index from top (0 = B5, 23 = C4) */
function semiToRow(semi: number): number { return TOTAL_ROWS - 1 - semi; }

// ── Internal types ───────────────────────────────────────────────────────────

interface RollNote {
  note:   string;
  beats:  number;
  xBeat:  number;   // cumulative beat offset at which this note starts
}

interface PlayedResult {
  step:    number;
  correct: boolean;
}

// ── Class ────────────────────────────────────────────────────────────────────

export class SongVisualizer {
  static readonly NOTE_COLORS: Record<string, string> = {
    'C': '#FF4444', 'C#': '#FF7766',
    'D': '#FF8844', 'D#': '#FFAA66',
    'E': '#FFDD44', 'F':  '#44DD44',
    'F#':'#66EE66', 'G':  '#44DDDD',
    'G#':'#66DDDD', 'A':  '#4488FF',
    'A#':'#6699FF', 'B':  '#AA44FF',
  };

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx:    CanvasRenderingContext2D;

  private rollNotes:    RollNote[];
  private totalBeats:   number;
  private currentStep:  number;
  private playedResults: PlayedResult[];

  private animFrame:  number;
  public  holdPct:    number;   // 0–1, set by PianoApp animation loop

  constructor(eventBus: EventBusLike | null, canvas: HTMLCanvasElement) {
    this.canvas       = canvas;
    this.ctx          = canvas.getContext('2d')!;
    this.rollNotes    = [];
    this.totalBeats   = 0;
    this.currentStep  = 0;
    this.playedResults = [];
    this.animFrame    = 0;
    this.holdPct      = 0;

    eventBus?.on('song:step', d => {
      this.currentStep = d.step;
      this.holdPct     = 0;
    });

    eventBus?.on('note:result', d => {
      this.playedResults.push({ step: d.step, correct: d.correct });
    });

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    this.canvas.width  = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  setSong(song: Song): void {
    this.rollNotes   = [];
    this.totalBeats  = 0;
    this.currentStep = 0;
    this.playedResults = [];

    let xBeat = 0;
    for (const n of song.notes) {
      const beats = BEATS[n.duration] ?? 1;
      this.rollNotes.push({ note: n.note, beats, xBeat });
      xBeat += beats;
    }
    this.totalBeats = xBeat;
  }

  clear(): void {
    this.rollNotes    = [];
    this.totalBeats   = 0;
    this.currentStep  = 0;
    this.playedResults = [];
    this.holdPct      = 0;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(): void {
    this.animFrame++;
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#120820';
    ctx.fillRect(0, 0, W, H);

    if (this.rollNotes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font      = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pick a song! 📚', W / 2, H / 2);
      return;
    }

    const rowH      = H / TOTAL_ROWS;
    const pxPerBeat = this._pxPerBeat(W);

    // Scroll: keep current note's X visible at 25% from the left of the roll area
    const rollW    = W - LEFT_W;
    const curBeat  = this.rollNotes[Math.min(this.currentStep, this.rollNotes.length - 1)]?.xBeat ?? 0;
    const scrollX  = Math.max(0, curBeat * pxPerBeat - rollW * 0.25);

    this._drawKeyboard(ctx, H, rowH);
    this._drawGrid(ctx, W, H, rowH, scrollX, pxPerBeat);
    this._drawNotes(ctx, H, rowH, scrollX, pxPerBeat);
    this._drawCurrentCursor(ctx, H, rowH, scrollX, pxPerBeat);
  }

  // ── Private drawing helpers ───────────────────────────────────────────────

  private _pxPerBeat(W: number): number {
    // Fit all beats in ~2× the roll width; minimum 30px, maximum 80px per beat
    const rollW = W - LEFT_W;
    const auto  = (rollW * 2) / Math.max(this.totalBeats, 1);
    return Math.min(80, Math.max(30, auto));
  }

  /** Left strip: mini vertical piano keyboard */
  private _drawKeyboard(ctx: CanvasRenderingContext2D, H: number, rowH: number): void {
    for (let semi = 0; semi < TOTAL_ROWS; semi++) {
      const row     = semiToRow(semi);
      const y       = row * rowH;
      const semiMod = semi % 12;
      const isBlack = IS_BLACK[semiMod];

      // Background of the key strip
      ctx.fillStyle = isBlack ? '#1a0a2e' : '#2d1b50';
      ctx.fillRect(0, y, LEFT_W - 1, rowH - 1);

      // Note name on C notes only
      if (semiMod === 0) {
        const octave = MIN_OCT + Math.floor(semi / 12);
        ctx.fillStyle  = '#ccc';
        ctx.font       = `bold ${Math.max(8, rowH * 0.55)}px monospace`;
        ctx.textAlign  = 'center';
        ctx.fillText(`C${octave}`, LEFT_W / 2, y + rowH * 0.72);
      }

      // Small indicator line on black key rows
      if (isBlack) {
        ctx.fillStyle = '#ffffff18';
        ctx.fillRect(LEFT_W - 6, y + 1, 5, rowH - 2);
      }
    }

    // Divider line
    ctx.fillStyle = '#ffffff33';
    ctx.fillRect(LEFT_W - 1, 0, 1, H);
  }

  /** Horizontal grid lines (one per semitone, subtle) */
  private _drawGrid(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    rowH: number,
    _scrollX: number,
    _pxPerBeat: number,
  ): void {
    for (let semi = 0; semi < TOTAL_ROWS; semi++) {
      const row     = semiToRow(semi);
      const y       = row * rowH;
      const semiMod = semi % 12;
      const isBlack = IS_BLACK[semiMod];

      // Row background in the note area
      ctx.fillStyle = isBlack ? '#0d051e' : '#1a0a2e';
      ctx.fillRect(LEFT_W, y, W - LEFT_W, rowH - 1);
    }

    // Octave divider (stronger line at C notes)
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth   = 1;
    for (let semi = 0; semi <= TOTAL_ROWS; semi += 12) {
      const row = semiToRow(semi - 1);  // line above each C
      const y   = row * rowH;
      ctx.beginPath();
      ctx.moveTo(LEFT_W, y);
      ctx.lineTo(W,      y);
      ctx.stroke();
    }
  }

  /** Note blocks: target notes + correct/wrong overlays */
  private _drawNotes(
    ctx: CanvasRenderingContext2D,
    H:   number,
    rowH: number,
    scrollX: number,
    pxPerBeat: number,
  ): void {
    const rollW = this.canvas.width - LEFT_W;

    for (let i = 0; i < this.rollNotes.length; i++) {
      const rn      = this.rollNotes[i];
      const semi    = toSemi(rn.note);
      if (semi < 0 || semi >= TOTAL_ROWS) continue;

      const row   = semiToRow(semi);
      const x     = LEFT_W + rn.xBeat * pxPerBeat - scrollX;
      const bw    = rn.beats * pxPerBeat - 2;   // 2px gap between blocks
      const y     = row * rowH + 1;
      const bh    = rowH - 2;

      // Clip to roll area
      if (x + bw < LEFT_W || x > LEFT_W + rollW) continue;

      const noteLetter = rn.note.includes('#') ? rn.note.slice(0, 2) : rn.note[0];
      const color      = SongVisualizer.NOTE_COLORS[noteLetter] ?? '#888';
      const isDone     = i < this.currentStep;
      const isCurrent  = i === this.currentStep;

      const result = this.playedResults.find(r => r.step === i);

      if (isDone) {
        // Completed — bright if correct, faded red if wrong
        const correct = result?.correct ?? true;
        ctx.fillStyle = correct ? color + 'cc' : '#FF444466';
        ctx.fillRect(x, y, bw, bh);

        // Correct tick
        if (correct) {
          ctx.strokeStyle = '#51E898';
          ctx.lineWidth   = 2;
          ctx.lineCap     = 'round';
          ctx.beginPath();
          ctx.moveTo(x + bw * 0.2, y + bh * 0.55);
          ctx.lineTo(x + bw * 0.45, y + bh * 0.8);
          ctx.lineTo(x + bw * 0.8,  y + bh * 0.2);
          ctx.stroke();
        }

      } else if (isCurrent) {
        // Active — full color + pulsing border + hold fill
        const pulse = 1 + Math.sin(this.animFrame * 0.13) * 0.06;
        ctx.fillStyle = color + 'aa';
        ctx.fillRect(x, y, bw, bh);

        // Hold fill (green, grows left→right)
        if (this.holdPct > 0) {
          ctx.fillStyle = '#51E898bb';
          ctx.fillRect(x, y, bw * this.holdPct, bh);
        }

        // Pulsing border
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2 * pulse;
        ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);

      } else {
        // Future — very dim outline only
        ctx.fillStyle   = color + '22';
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeStyle = color + '55';
        ctx.lineWidth   = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      }
    }
  }

  /** Vertical "now" cursor at the current step's left edge */
  private _drawCurrentCursor(
    ctx: CanvasRenderingContext2D,
    H:   number,
    _rowH: number,
    scrollX: number,
    pxPerBeat: number,
  ): void {
    if (this.currentStep >= this.rollNotes.length) return;
    const rn  = this.rollNotes[this.currentStep];
    const x   = LEFT_W + rn.xBeat * pxPerBeat - scrollX;

    const alpha = 0.5 + 0.5 * Math.sin(this.animFrame * 0.15);
    ctx.strokeStyle = `rgba(255,230,109,${alpha})`;  // yellow
    ctx.lineWidth   = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small label "NOW"
    ctx.fillStyle  = `rgba(255,230,109,${alpha})`;
    ctx.font       = 'bold 9px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText('▼ NOW', x, 10);
  }
}
