/**
 * UI Manager
 * Handles piano keyboard UI and animations
 * Delegates timeline rendering to SongVisualizer
 */

export class UIManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.keys = document.querySelectorAll('.key');
        this.micToggle = document.getElementById('mic-toggle');
        this.volumeControl = document.getElementById('volume-control');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.homeBtn = document.getElementById('home-btn');
        this.playbackBtn = document.getElementById('playback-btn');
        this.songsBtn = document.getElementById('songs-btn');

        // Modals
        this.songPickerModal = document.getElementById('song-picker-modal');
        this.parentModeModal = document.getElementById('parent-mode-modal');
        this.celebrationScreen = document.getElementById('celebration-screen');
        this.modalCloseButtons = document.querySelectorAll('.modal-close');
        this.closeParentModeBtn = document.getElementById('close-parent-mode');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard inputs
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const keyEl = document.querySelector(`[data-key="${key}"]`);
            if (keyEl) this.handleKeyPress(keyEl);
        });

        // Mouse/Touch inputs on keys
        this.keys.forEach(key => {
            key.addEventListener('mousedown', () => this.handleKeyPress(key));
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleKeyPress(key);
            });
        });

        // Buttons
        this.songsBtn.addEventListener('click', () => this.showSongPicker());
        this.playbackBtn.addEventListener('click', () => this.playRecording());
        this.homeBtn.addEventListener('click', () => this.goHome());
        this.micToggle.addEventListener('click', () => {
            if (this.eventBus) {
                this.eventBus.emit('mic:toggle', {});
            }
        });

        // Settings button (hold for 3 seconds to open parent mode)
        let settingsHoldTime = 0;
        this.settingsToggle.addEventListener('mousedown', () => {
            settingsHoldTime = Date.now();
        });
        this.settingsToggle.addEventListener('mouseup', () => {
            if (Date.now() - settingsHoldTime >= 3000) {
                this.showParentMode();
            }
            settingsHoldTime = 0;
        });
        this.settingsToggle.addEventListener('touchstart', () => {
            settingsHoldTime = Date.now();
        });
        this.settingsToggle.addEventListener('touchend', () => {
            if (Date.now() - settingsHoldTime >= 3000) {
                this.showParentMode();
            }
            settingsHoldTime = 0;
        });

        // Volume control
        if (this.volumeControl) {
            this.volumeControl.addEventListener('input', (e) => {
                if (this.eventBus) {
                    this.eventBus.emit('volume:changed', { volume: parseFloat(e.target.value) });
                }
            });
        }

        // Modal close buttons
        this.modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(btn.closest('.modal')));
        });
        this.closeParentModeBtn.addEventListener('click', () => this.closeModal(this.parentModeModal));

        // Close modals on background click
        [this.songPickerModal, this.parentModeModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });
    }

    handleKeyPress(keyEl) {
        const note = keyEl.dataset.note;
        if (!note) return;

        // Play sound directly here for immediate response
        this.playSound(note);

        // Animate key
        this.animateKey(note);

        // Emit so app.js can track progress and recording
        if (this.eventBus) {
            this.eventBus.emit('note:played', { note, source: 'keyboard' });
        }
    }

    playSound(note) {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;

        const char = keyEl.dataset.key;
        let fileName = char;

        // Handle special naming conventions
        if (char === ".") fileName = "aa";

        const audio = new Audio(`audio/${fileName}.mp3`);
        if (this.volumeControl) {
            audio.volume = parseFloat(this.volumeControl.value);
        }
        audio.play().catch(err => console.warn("Audio play blocked:", err));
    }

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
        setTimeout(() => keyEl.classList.remove('correct'), 200);
    }

    updateMicUI(isActive) {
        this.micToggle.style.opacity = isActive ? '1' : '0.5';
        this.micToggle.textContent = isActive ? '🎤' : '🎙️';
    }

    showSongPicker() {
        this.songPickerModal.classList.remove('hidden');
    }

    closeSongPicker() {
        this.closeModal(this.songPickerModal);
    }

    showParentMode() {
        this.parentModeModal.classList.remove('hidden');
    }

    showCelebration(songTitle, score) {
        this.celebrationScreen.classList.remove('hidden');
        document.getElementById('celebration-song-name').textContent = `You played ${songTitle}!`;
        document.getElementById('celebration-score').textContent = `${score}% Perfect!`;
        this.createConfetti();
    }

    hideCelebration() {
        this.celebrationScreen.classList.add('hidden');
    }

    createConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = -10 + 'px';
            confetti.style.backgroundColor = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#51E898'][Math.floor(Math.random() * 4)];
            confetti.style.animationDelay = Math.random() * 0.3 + 's';
            container.appendChild(confetti);
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
                if (this.eventBus) {
                    this.eventBus.emit('song:selected', { songId: song.id });
                }
                this.closeSongPicker();
            });
            grid.appendChild(card);
        });

        // Add Free Play card
        const freePlayCard = document.createElement('div');
        freePlayCard.className = 'song-card';
        freePlayCard.innerHTML = `
            <div class="song-emoji">🎹</div>
            <div class="song-title">Free Play</div>
            <div class="song-difficulty">No rules!</div>
        `;
        freePlayCard.addEventListener('click', () => {
            if (this.eventBus) {
                this.eventBus.emit('song:selected', { songId: 'free' });
            }
            this.closeSongPicker();
        });
        grid.appendChild(freePlayCard);
    }

    playRecording() {
        if (this.eventBus) {
            this.eventBus.emit('playback:request', {});
        }
    }

    goHome() {
        if (this.eventBus) {
            this.eventBus.emit('home:clicked', {});
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    clearAllHighlights() {
        this.keys.forEach(k => k.classList.remove('target'));
    }

    highlightNote(note) {
        this.clearAllHighlights();
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (keyEl) {
            keyEl.classList.add('target');
        }
    }
}
