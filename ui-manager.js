/**
 * UI Manager
 * Piano keyboard interactions, animations, modals, hold-fill bars.
 */

export class UIManager {
    constructor(eventBus, audioManager) {
        this.eventBus    = eventBus;
        this.audioManager = audioManager;
        this.keys        = document.querySelectorAll('.key');

        this.micToggle    = document.getElementById('mic-toggle');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.homeBtn      = document.getElementById('home-btn');
        this.playbackBtn  = document.getElementById('playback-btn');
        this.songsBtn     = document.getElementById('songs-btn');
        this.volumeControl = document.getElementById('volume-control');

        this.songPickerModal  = document.getElementById('song-picker-modal');
        this.parentModeModal  = document.getElementById('parent-mode-modal');
        this.celebrationScreen = document.getElementById('celebration-screen');
        this.modalCloseButtons = document.querySelectorAll('.modal-close');
        this.closeParentModeBtn = document.getElementById('close-parent-mode');

        // Add fill bars inside every key for the hold-duration visual
        this.keys.forEach(k => {
            const fill = document.createElement('div');
            fill.className = 'key-fill';
            k.appendChild(fill);
        });

        this._heldKeys = new Set(); // prevent key-repeat re-triggering

        this.setupEventListeners();
    }

    setupEventListeners() {
        // ── Keyboard ──────────────────────────────────────────────
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const keyEl = document.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
            if (keyEl) this._pressKey(keyEl);
        });
        document.addEventListener('keyup', (e) => {
            const keyEl = document.querySelector(`[data-key="${e.key.toLowerCase()}"]`);
            if (keyEl) this._releaseKey(keyEl);
        });

        // ── Mouse / Touch ─────────────────────────────────────────
        this.keys.forEach(key => {
            key.addEventListener('mousedown',  () => this._pressKey(key));
            key.addEventListener('mouseup',    () => this._releaseKey(key));
            key.addEventListener('mouseleave', () => this._releaseKey(key));

            key.addEventListener('touchstart', (e) => { e.preventDefault(); this._pressKey(key); },   { passive: false });
            key.addEventListener('touchend',   (e) => { e.preventDefault(); this._releaseKey(key); }, { passive: false });
        });

        // ── Buttons ───────────────────────────────────────────────
        this.songsBtn.addEventListener('click',    () => this.showSongPicker());
        this.playbackBtn.addEventListener('click', () => this.eventBus?.emit('playback:request', {}));
        this.homeBtn.addEventListener('click',     () => this.eventBus?.emit('home:clicked', {}));
        this.micToggle.addEventListener('click',   () => this.eventBus?.emit('mic:toggle', {}));

        // Settings: hold 3 s to enter parent mode
        let holdStart = 0;
        const onHoldStart = () => { holdStart = Date.now(); };
        const onHoldEnd   = () => { if (Date.now() - holdStart >= 3000) this.showParentMode(); holdStart = 0; };
        this.settingsToggle.addEventListener('mousedown',  onHoldStart);
        this.settingsToggle.addEventListener('mouseup',    onHoldEnd);
        this.settingsToggle.addEventListener('touchstart', onHoldStart, { passive: true });
        this.settingsToggle.addEventListener('touchend',   onHoldEnd,   { passive: true });

        // Volume
        this.volumeControl?.addEventListener('input', (e) => {
            this.eventBus?.emit('volume:changed', { volume: parseFloat(e.target.value) });
        });

        // Modal close buttons
        this.modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.closest('.modal')));
        });
        this.closeParentModeBtn?.addEventListener('click', () => this.closeModal(this.parentModeModal));

        [this.songPickerModal, this.parentModeModal].forEach(modal => {
            modal?.addEventListener('click', (e) => { if (e.target === modal) this.closeModal(modal); });
        });
    }

    // ── Key press / release ──────────────────────────────────────────────────

    _pressKey(keyEl) {
        const note = keyEl.dataset.note;
        if (!note || this._heldKeys.has(note)) return;
        this._heldKeys.add(note);

        this.audioManager?.playSound(note);
        this.animateKey(note, 'active');

        this.eventBus?.emit('note:down', { note, source: 'keyboard', time: Date.now() });
    }

    _releaseKey(keyEl) {
        const note = keyEl.dataset.note;
        if (!note || !this._heldKeys.has(note)) return;
        this._heldKeys.delete(note);

        this.eventBus?.emit('note:up', { note, source: 'keyboard', time: Date.now() });
    }

    // ── Key animations ───────────────────────────────────────────────────────

    animateKey(note, type = 'active') {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;
        keyEl.classList.add(type);
        setTimeout(() => keyEl.classList.remove(type), 350);
    }

    flashCorrect(note) {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;
        keyEl.classList.remove('target');
        keyEl.classList.add('correct');
        setTimeout(() => keyEl.classList.remove('correct'), 220);
    }

    /** Start the hold-fill animation on a key.
     *  durationMs = how long Paul needs to hold before we advance.
     */
    startHoldFill(note, durationMs) {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;
        const fill = keyEl.querySelector('.key-fill');
        if (!fill) return;
        // Reset first (in case of retry)
        fill.style.transition = 'none';
        fill.style.height = '0%';
        // Force reflow so transition triggers
        fill.getBoundingClientRect();
        fill.style.transition = `height ${durationMs}ms linear`;
        fill.style.height = '100%';
    }

    /** Cancel / drain the hold-fill (key released too early) */
    cancelHoldFill(note) {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;
        const fill = keyEl.querySelector('.key-fill');
        if (!fill) return;
        fill.style.transition = 'height 180ms ease-out';
        fill.style.height = '0%';
    }

    // ── Highlight / target ───────────────────────────────────────────────────

    highlightNote(note) {
        this.clearAllHighlights();
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (keyEl) keyEl.classList.add('target');
    }

    clearAllHighlights() {
        this.keys.forEach(k => {
            k.classList.remove('target');
            // also drain any in-progress fill
            const fill = k.querySelector('.key-fill');
            if (fill) { fill.style.transition = 'none'; fill.style.height = '0%'; }
        });
    }

    updateMicUI(isActive) {
        this.micToggle.style.opacity  = isActive ? '1' : '0.5';
        this.micToggle.textContent    = isActive ? '🎤' : '🎙️';
    }

    // ── Modals ───────────────────────────────────────────────────────────────

    showSongPicker()  { this.songPickerModal.classList.remove('hidden'); }
    showParentMode()  { this.parentModeModal.classList.remove('hidden'); }
    closeModal(modal) { modal?.classList.add('hidden'); }

    showCelebration(songTitle, score) {
        this.celebrationScreen.classList.remove('hidden');
        document.getElementById('celebration-song-name').textContent = `You played ${songTitle}!`;
        document.getElementById('celebration-score').textContent     = `${score}% Perfect!`;
        this._createConfetti();
    }

    hideCelebration() { this.celebrationScreen.classList.add('hidden'); }

    closeSongPicker() { this.closeModal(this.songPickerModal); }

    _createConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';
        const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#51E898', '#AA44FF'];
        for (let i = 0; i < 60; i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left            = Math.random() * 100 + '%';
            c.style.top             = '-10px';
            c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay  = Math.random() * 1 + 's';
            c.style.width           = (8 + Math.random() * 8) + 'px';
            c.style.height          = (8 + Math.random() * 8) + 'px';
            container.appendChild(c);
        }
    }

    renderSongGrid(songs) {
        const grid = document.getElementById('song-grid');
        grid.innerHTML = '';

        songs.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card';
            card.innerHTML = `
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

        const freeCard = document.createElement('div');
        freeCard.className = 'song-card';
        freeCard.innerHTML = `<div class="song-emoji">🎹</div><div class="song-title">Free Play</div><div class="song-difficulty">No rules!</div>`;
        freeCard.addEventListener('click', () => {
            this.eventBus?.emit('song:selected', { songId: 'free' });
            this.closeSongPicker();
        });
        grid.appendChild(freeCard);
    }

    goHome() { this.eventBus?.emit('home:clicked', {}); }
}
