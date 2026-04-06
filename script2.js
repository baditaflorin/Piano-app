/**
 * Main App Entry Point
 * Coordinates between modules
 */

import { PitchEngine } from './pitch-engine.js';
import { AudioManager } from './audio-manager.js';
import { SongManager, SONGS } from './song-manager.js';
import { UIManager } from './ui-manager.js';

class PianoApp {
    constructor() {
        this.pitchEngine = new PitchEngine();
        this.audioManager = new AudioManager();
        this.songManager = new SongManager();
        this.uiManager = new UIManager();
        
        this.isMicActive = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loop();
        console.log("Piano Pro Initialized!");
    }

    setupEventListeners() {
        // Keyboard inputs
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const keyEl = document.querySelector(`[data-key="${key}"]`);
            if (keyEl) this.handleNoteInput(keyEl.dataset.note);
        });

        // Mouse inputs
        this.uiManager.keys.forEach(key => {
            key.addEventListener('mousedown', () => this.handleNoteInput(key.dataset.note));
        });

        // Mic Toggle
        this.uiManager.micToggle.addEventListener('click', () => this.toggleMicrophone());

        // Song Selection
        this.uiManager.songButtons.forEach(btn => {
            btn.addEventListener('click', () => this.startSong(btn.dataset.song, btn));
        });

        // Volume
        this.uiManager.volumeControl.addEventListener('input', (e) => {
            this.audioManager.setVolume(e.target.value);
        });

        // Listen Button
        this.uiManager.playPreviewBtn.addEventListener('click', () => this.playSongPreview());
    }

    async toggleMicrophone() {
        if (!this.isMicActive) {
            try {
                await this.pitchEngine.start();
                this.isMicActive = true;
                this.pitchEngine.onNoteDetected = (note, freq, midi) => this.onMicNote(note, freq, midi);
            } catch (e) {
                alert("Microphone access denied.");
            }
        } else {
            this.pitchEngine.stop();
            this.isMicActive = false;
            this.uiManager.setNote('--');
        }
        this.uiManager.updateMicUI(this.isMicActive);
    }

    onMicNote(noteName, frequency, midi) {
        this.uiManager.setNote(noteName);
        const keyEl = document.querySelector(`[data-note="${noteName}"]`);
        if (keyEl) {
            this.uiManager.animateKey(noteName, 'listening');
            this.handleNoteInput(noteName, true); // True means triggered by mic
        }
    }

    handleNoteInput(note, fromMic = false) {
        if (!fromMic) {
            this.audioManager.playSound(note);
            this.uiManager.animateKey(note);
        }
        
        const result = this.songManager.checkProgress(note);
        if (result.status === 'next') {
            this.uiManager.setTargetNote(result.nextTarget, this.songManager.getProgressPercentage());
        } else if (result.status === 'complete') {
            alert("Victory! Song Complete.");
            this.startSong('free');
        }
    }

    startSong(songId, btnEl) {
        if (btnEl) {
            this.uiManager.songButtons.forEach(b => b.classList.remove('active'));
            btnEl.classList.add('active');
        }
        
        const firstNote = this.songManager.startSong(songId);
        
        if (this.songManager.isFreePlay()) {
            this.uiManager.setMode("Free Play", false);
            this.uiManager.setTargetNote(null, 0);
        } else {
            this.uiManager.setMode("Learning Mode", true);
            this.uiManager.setTargetNote(firstNote, 0);
        }
    }

    async playSongPreview() {
        const songId = this.songManager.currentSongId;
        const songData = SONGS[songId];
        if (!songData) return;

        this.uiManager.playPreviewBtn.disabled = true;
        this.uiManager.playPreviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Playing...';

        for (const note of songData) {
            this.audioManager.playSound(note);
            this.uiManager.animateKey(note);
            await new Promise(r => setTimeout(r, 600));
        }

        this.uiManager.playPreviewBtn.disabled = false;
        this.uiManager.playPreviewBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
    }

    loop() {
        this.uiManager.drawVisualizer(this.isMicActive, this.pitchEngine.analyser);
        requestAnimationFrame(() => this.loop());
    }
}

// Start Application
new PianoApp();