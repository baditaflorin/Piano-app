/**
 * Piano App - Main Entry Point
 * Orchestrates all modules via EventBus
 */

import { PitchEngine } from './pitch-engine.js';
import { AudioManager } from './audio-manager.js';
import { SongLibrary } from './song-library.js';
import { RecordingManager } from './recording-manager.js';
import { SongVisualizer } from './song-visualizer.js';
import { UIManager } from './ui-manager.js';

/**
 * Simple EventBus for module communication
 */
class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, fn) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(fn);
    }

    off(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(fn => fn(data));
    }

    removeAllListeners() {
        this.listeners = {};
    }
}

/**
 * Main Piano App Controller
 */
class PianoApp {
    constructor() {
        this.eventBus = new EventBus();

        // Initialize modules
        this.audioManager = new AudioManager(this.eventBus);
        this.pitchEngine = new PitchEngine(this.eventBus);
        this.songLibrary = new SongLibrary();
        this.recordingManager = new RecordingManager(this.eventBus, this.audioManager);
        this.timelineCanvas = document.getElementById('timeline-canvas');
        this.songVisualizer = new SongVisualizer(this.eventBus, this.timelineCanvas);
        this.uiManager = new UIManager(this.eventBus, this.audioManager);

        // State
        this.currentSong   = null;
        this.currentSongId = 'free';
        this.currentStep   = 0;
        this.isMicActive   = false;
        this.isRecording   = false;

        // Hold-duration state
        this._holdNote    = null;   // note currently being held
        this._holdTimer   = null;   // setTimeout for auto-advance
        this._holdStart   = 0;      // Date.now() when hold began

        // Initialize
        this.init();
    }

    async init() {
        console.log("Piano App initializing...");

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

        console.log("Piano App ready!");
    }

    setupEventListeners() {
        // Mic toggle
        this.eventBus.on('mic:toggle', () => this.toggleMicrophone());

        // Song selection
        this.eventBus.on('song:selected', (data) => this.selectSong(data.songId));

        // Note detection from mic
        this.eventBus.on('note:detected', (data) => this.onNoteDetected(data));

        // Keyboard note down / up  (replaces old note:played for song logic)
        this.eventBus.on('note:down', (data) => this.onNoteDown(data));
        this.eventBus.on('note:up',   (data) => this.onNoteUp(data));

        // Volume changed
        this.eventBus.on('volume:changed', (data) => {
            this.audioManager.setVolume(data.volume);
        });

        // Playback requests
        this.eventBus.on('playback:request', () => this.recordingManager.playRecording());

        // Home button
        this.eventBus.on('home:clicked', () => {
            this.recordingManager.stopRecording();
            this.selectSong('free');
        });

        // Recording events
        this.eventBus.on('recording:stop', (data) => {
            console.log(`Recording stopped: ${data.noteCount} notes, ${data.duration}ms`);
        });
    }

    async toggleMicrophone() {
        if (!this.isMicActive) {
            try {
                await this.pitchEngine.start();
                this.isMicActive = true;
                this.recordingManager.startRecording();
                this.isRecording = true;
                this.uiManager.updateMicUI(true);
                console.log("Microphone activated");
            } catch (err) {
                console.error("Failed to access microphone:", err);
                alert("Microphone access denied. Please allow microphone access.");
            }
        } else {
            this.pitchEngine.stop();
            this.isMicActive = false;
            this.recordingManager.stopRecording();
            this.isRecording = false;
            this.uiManager.updateMicUI(false);
            console.log("Microphone deactivated");
        }
    }

    onNoteDetected(data) {
        const { note, frequency, confidence, source } = data;

        if (source === 'mic') {
            // Highlight the key
            this.uiManager.animateKey(note, 'listening');
        }

        // Check song progress if in learning mode
        if (this.currentSongId !== 'free') {
            this.checkSongProgress(note);
        }
    }

    onNoteDown(data) {
        const { note } = data;

        // Record for playback
        this.eventBus.emit('note:played', { note, source: 'keyboard' });

        if (!this.currentSong || this.currentSongId === 'free') return;

        const target = this.currentSong.notes[this.currentStep];
        if (!target || note !== target.note) return;

        // Correct note pressed — start hold timer
        this._startHold(note, target.duration, this.currentSong.bpm);
    }

    onNoteUp(data) {
        const { note } = data;
        if (note !== this._holdNote) return;

        const held = Date.now() - this._holdStart;
        const needed = this._holdDurationMs;

        if (held >= needed * 0.55) {
            // Held long enough (55% threshold) — accept and advance
            this._completeHold();
        } else {
            // Released too early — cancel, let Paul try again
            this._cancelHold();
        }
    }

    _holdDurationMs = 0;

    _startHold(note, duration, bpm) {
        clearTimeout(this._holdTimer);
        this._holdNote  = note;
        this._holdStart = Date.now();

        const quarter = 60000 / (bpm || 90);
        const durationMap = { whole: quarter * 4, half: quarter * 2, quarter, eighth: quarter / 2 };
        // Scale down so it's fun, not frustrating for a 5-year-old
        const raw = durationMap[duration] || quarter;
        this._holdDurationMs = Math.round(raw * 0.65);

        // Show the fill bar rising inside the key
        this.uiManager.startHoldFill(note, this._holdDurationMs);

        // Auto-advance when full
        this._holdTimer = setTimeout(() => this._completeHold(), this._holdDurationMs);
    }

    _completeHold() {
        clearTimeout(this._holdTimer);
        const note = this._holdNote;
        this._holdNote = null;
        if (!note) return;

        this.uiManager.flashCorrect(note);
        this.uiManager.cancelHoldFill(note);
        this._advanceSong(note);
    }

    _cancelHold() {
        clearTimeout(this._holdTimer);
        const note = this._holdNote;
        this._holdNote = null;
        this.uiManager.cancelHoldFill(note);
        // Re-highlight so Paul knows to try again
        if (note) this.uiManager.highlightNote(note);
    }

    _advanceSong(completedNote) {
        this.currentStep++;
        this.eventBus.emit('song:step', {
            step: this.currentStep,
            playedSteps: Array.from({ length: this.currentStep }, (_, i) => i)
        });

        const notes = this.currentSong.notes;
        if (this.currentStep >= notes.length) {
            this.uiManager.clearAllHighlights();
            this.showCelebration(this.currentSong.title, 100);
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

    selectSong(songId) {
        this.currentSongId = songId;
        this.recordingManager.clear();
        this.songVisualizer.clear();
        this.uiManager.clearAllHighlights();

        this.currentStep = 0;

        if (songId === 'free') {
            this.currentSong = null;
            this.uiManager.clearAllHighlights();
            console.log("Free play mode");
        } else {
            this.currentSong = this.songLibrary.getSong(songId);
            if (this.currentSong) {
                this.songVisualizer.setSong(this.currentSong);
                // Tell visualizer we're at step 0
                this.eventBus.emit('song:step', { step: 0, playedSteps: [] });
                // Highlight the first note on the piano
                this.uiManager.highlightNote(this.currentSong.notes[0].note);
                console.log(`Selected song: ${this.currentSong.title}`);
            }
        }

        // Auto-start mic
        if (!this.isMicActive) {
            this.toggleMicrophone();
        }
    }

    showCelebration(songTitle, score) {
        this.recordingManager.stopRecording();
        this.pitchEngine.stop();
        this.isMicActive = false;
        this.isRecording = false;
        this.uiManager.updateMicUI(false);

        // Show celebration
        this.uiManager.showCelebration(songTitle, Math.round(score));

        // Setup celebration buttons
        const hearBtn = document.getElementById('hear-btn');
        const againBtn = document.getElementById('again-btn');
        const newSongBtn = document.getElementById('new-song-btn');

        const cleanup = () => {
            hearBtn.removeEventListener('click', playHandler);
            againBtn.removeEventListener('click', againHandler);
            newSongBtn.removeEventListener('click', newHandler);
        };

        const playHandler = () => {
            this.recordingManager.playRecording();
        };
        const againHandler = () => {
            this.uiManager.hideCelebration();
            this.selectSong(this.currentSongId);
            cleanup();
        };
        const newHandler = () => {
            this.uiManager.hideCelebration();
            this.uiManager.showSongPicker();
            cleanup();
        };

        hearBtn.addEventListener('click', playHandler);
        againBtn.addEventListener('click', againHandler);
        newSongBtn.addEventListener('click', newHandler);
    }

    startAnimationLoop() {
        const renderTimeline = () => {
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
    window.pianoApp = new PianoApp();
});
