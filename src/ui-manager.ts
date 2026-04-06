/**
 * UI Manager
 * Piano keyboard interactions, animations, modals, hold-fill bars.
 */

import { EventMap, Song } from './types';
import { AudioManager } from './audio-manager';

type EventBusLike = {
  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
};

export class UIManager {
  private readonly eventBus: EventBusLike | null;
  private readonly audioManager: AudioManager | null;
  private readonly keys: NodeListOf<HTMLElement>;

  // non-null: these elements are required in the HTML
  private readonly micToggle: HTMLElement;
  private readonly settingsToggle: HTMLElement;
  private readonly homeBtn: HTMLElement;
  private readonly playbackBtn: HTMLElement;
  private readonly songsBtn: HTMLElement;
  private readonly volumeControl: HTMLInputElement | null;

  private readonly songPickerModal: HTMLElement | null;
  private readonly parentModeModal: HTMLElement | null;
  private readonly celebrationScreen: HTMLElement;
  private readonly modalCloseButtons: NodeListOf<Element>;
  private readonly closeParentModeBtn: HTMLElement | null;

  private readonly _heldKeys: Set<string>;

  constructor(eventBus: EventBusLike | null, audioManager: AudioManager | null) {
    this.eventBus     = eventBus;
    this.audioManager = audioManager;
    this.keys         = document.querySelectorAll<HTMLElement>('.key');

    // non-null assertions: these elements must exist in piano.html
    this.micToggle      = document.getElementById('mic-toggle')!;
    this.settingsToggle = document.getElementById('settings-toggle')!;
    this.homeBtn        = document.getElementById('home-btn')!;
    this.playbackBtn    = document.getElementById('playback-btn')!;
    this.songsBtn       = document.getElementById('songs-btn')!;
    this.volumeControl  = document.getElementById('volume-control') as HTMLInputElement | null;

    this.songPickerModal    = document.getElementById('song-picker-modal');
    this.parentModeModal    = document.getElementById('parent-mode-modal');
    this.celebrationScreen  = document.getElementById('celebration-screen')!;
    this.modalCloseButtons  = document.querySelectorAll('.modal-close');
    this.closeParentModeBtn = document.getElementById('close-parent-mode');

    // Add fill bars inside every key for the hold-duration visual
    this.keys.forEach(k => {
      const fill       = document.createElement('div');
      fill.className   = 'key-fill';
      k.appendChild(fill);
    });

    this._heldKeys = new Set<string>();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // ── Keyboard ──────────────────────────────────────────────
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      const keyEl = document.querySelector<HTMLElement>(`[data-key="${e.key.toLowerCase()}"]`);
      if (keyEl) this._pressKey(keyEl);
    });
    document.addEventListener('keyup', (e: KeyboardEvent) => {
      const keyEl = document.querySelector<HTMLElement>(`[data-key="${e.key.toLowerCase()}"]`);
      if (keyEl) this._releaseKey(keyEl);
    });

    // ── Mouse / Touch ─────────────────────────────────────────
    this.keys.forEach(key => {
      key.addEventListener('mousedown',  () => this._pressKey(key));
      key.addEventListener('mouseup',    () => this._releaseKey(key));
      key.addEventListener('mouseleave', () => this._releaseKey(key));

      key.addEventListener('touchstart', (e: Event) => {
        e.preventDefault();
        this._pressKey(key);
      }, { passive: false });
      key.addEventListener('touchend', (e: Event) => {
        e.preventDefault();
        this._releaseKey(key);
      }, { passive: false });
    });

    // ── Buttons ───────────────────────────────────────────────
    this.songsBtn.addEventListener('click',    () => this.showSongPicker());
    this.playbackBtn.addEventListener('click', () => this.eventBus?.emit('playback:request', {}));
    this.homeBtn.addEventListener('click',     () => this.eventBus?.emit('home:clicked', {}));
    this.micToggle.addEventListener('click',   () => this.eventBus?.emit('mic:toggle', {}));

    // Settings: hold 3 s to enter parent mode
    let holdStart = 0;
    const onHoldStart = (): void => { holdStart = Date.now(); };
    const onHoldEnd   = (): void => {
      if (Date.now() - holdStart >= 3000) this.showParentMode();
      holdStart = 0;
    };
    this.settingsToggle.addEventListener('mousedown',  onHoldStart);
    this.settingsToggle.addEventListener('mouseup',    onHoldEnd);
    this.settingsToggle.addEventListener('touchstart', onHoldStart, { passive: true });
    this.settingsToggle.addEventListener('touchend',   onHoldEnd,   { passive: true });

    // Volume
    this.volumeControl?.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.eventBus?.emit('volume:changed', { volume: parseFloat(target.value) });
    });

    // Modal close buttons
    this.modalCloseButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = (btn as HTMLElement).closest('.modal') as HTMLElement | null;
        this.closeModal(modal);
      });
    });
    this.closeParentModeBtn?.addEventListener('click', () => this.closeModal(this.parentModeModal));

    [this.songPickerModal, this.parentModeModal].forEach(modal => {
      modal?.addEventListener('click', (e: Event) => {
        if (e.target === modal) this.closeModal(modal);
      });
    });
  }

  // ── Key press / release ──────────────────────────────────────────────────

  private _pressKey(keyEl: HTMLElement): void {
    const note = keyEl.dataset['note'];
    if (!note || this._heldKeys.has(note)) return;
    this._heldKeys.add(note);

    this.audioManager?.playSound(note);
    this.animateKey(note, 'active');

    this.eventBus?.emit('note:down', { note, source: 'keyboard', time: Date.now() });
  }

  private _releaseKey(keyEl: HTMLElement): void {
    const note = keyEl.dataset['note'];
    if (!note || !this._heldKeys.has(note)) return;
    this._heldKeys.delete(note);

    this.eventBus?.emit('note:up', { note, source: 'keyboard', time: Date.now() });
  }

  // ── Key animations ───────────────────────────────────────────────────────

  animateKey(note: string, type: string = 'active'): void {
    const keyEl = document.querySelector<HTMLElement>(`[data-note="${note}"]`);
    if (!keyEl) return;
    keyEl.classList.add(type);
    setTimeout(() => keyEl.classList.remove(type), 350);
  }

  flashCorrect(note: string): void {
    const keyEl = document.querySelector<HTMLElement>(`[data-note="${note}"]`);
    if (!keyEl) return;
    keyEl.classList.remove('target');
    keyEl.classList.add('correct');
    setTimeout(() => keyEl.classList.remove('correct'), 220);
  }

  /**
   * Start the hold-fill animation on a key.
   * durationMs = how long Paul needs to hold before we advance.
   */
  startHoldFill(note: string, durationMs: number): void {
    const keyEl = document.querySelector<HTMLElement>(`[data-note="${note}"]`);
    if (!keyEl) return;
    const fill = keyEl.querySelector<HTMLElement>('.key-fill');
    if (!fill) return;
    // Reset first (in case of retry)
    fill.style.transition = 'none';
    fill.style.height     = '0%';
    // Force reflow so transition triggers
    fill.getBoundingClientRect();
    fill.style.transition = `height ${durationMs}ms linear`;
    fill.style.height     = '100%';
  }

  /** Cancel / drain the hold-fill (key released too early) */
  cancelHoldFill(note: string | null): void {
    if (!note) return;
    const keyEl = document.querySelector<HTMLElement>(`[data-note="${note}"]`);
    if (!keyEl) return;
    const fill = keyEl.querySelector<HTMLElement>('.key-fill');
    if (!fill) return;
    fill.style.transition = 'height 180ms ease-out';
    fill.style.height     = '0%';
  }

  // ── Highlight / target ───────────────────────────────────────────────────

  highlightNote(note: string): void {
    this.clearAllHighlights();
    const keyEl = document.querySelector<HTMLElement>(`[data-note="${note}"]`);
    if (keyEl) keyEl.classList.add('target');
  }

  clearAllHighlights(): void {
    this.keys.forEach(k => {
      k.classList.remove('target');
      // also drain any in-progress fill
      const fill = k.querySelector<HTMLElement>('.key-fill');
      if (fill) { fill.style.transition = 'none'; fill.style.height = '0%'; }
    });
  }

  updateMicUI(isActive: boolean): void {
    this.micToggle.style.opacity = isActive ? '1' : '0.5';
    this.micToggle.textContent   = isActive ? '🎤' : '🎙️';
  }

  // ── Modals ───────────────────────────────────────────────────────────────

  showSongPicker(): void  { this.songPickerModal?.classList.remove('hidden'); }
  showParentMode(): void  { this.parentModeModal?.classList.remove('hidden'); }
  closeModal(modal: HTMLElement | null): void { modal?.classList.add('hidden'); }

  showCelebration(songTitle: string, score: number): void {
    this.celebrationScreen.classList.remove('hidden');
    const nameEl  = document.getElementById('celebration-song-name');
    const scoreEl = document.getElementById('celebration-score');
    if (nameEl)  nameEl.textContent  = `You played ${songTitle}!`;
    if (scoreEl) scoreEl.textContent = `${score}% Perfect!`;
    this._createConfetti();
  }

  hideCelebration(): void { this.celebrationScreen.classList.add('hidden'); }

  closeSongPicker(): void { this.closeModal(this.songPickerModal); }

  private _createConfetti(): void {
    const container = document.getElementById('confetti');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#51E898', '#AA44FF'];
    for (let i = 0; i < 60; i++) {
      const c              = document.createElement('div');
      c.className          = 'confetti';
      c.style.left            = Math.random() * 100 + '%';
      c.style.top             = '-10px';
      c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)] ?? '#FF6B6B';
      c.style.animationDelay  = Math.random() * 1 + 's';
      c.style.width           = (8 + Math.random() * 8) + 'px';
      c.style.height          = (8 + Math.random() * 8) + 'px';
      container.appendChild(c);
    }
  }

  renderSongGrid(songs: Song[]): void {
    const grid = document.getElementById('song-grid');
    if (!grid) return;
    grid.innerHTML = '';

    songs.forEach(song => {
      const card       = document.createElement('div');
      card.className   = 'song-card';
      card.innerHTML   = `
        <div class="song-emoji">${song.emoji || '🎵'}</div>
        <div class="song-title">${song.title}</div>
        <div class="song-difficulty">${'⭐'.repeat(song.difficulty || 1)}</div>
      `;
      card.addEventListener('click', () => {
        this.eventBus?.emit('song:selected', { songId: song.id });
        this.closeSongPicker();
      });
      grid.appendChild(card);
    });

    const freeCard       = document.createElement('div');
    freeCard.className   = 'song-card';
    freeCard.innerHTML   = `<div class="song-emoji">🎹</div><div class="song-title">Free Play</div><div class="song-difficulty">No rules!</div>`;
    freeCard.addEventListener('click', () => {
      this.eventBus?.emit('song:selected', { songId: 'free' });
      this.closeSongPicker();
    });
    grid.appendChild(freeCard);
  }

  goHome(): void { this.eventBus?.emit('home:clicked', {}); }
}
