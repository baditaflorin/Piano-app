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
        this.uiManager = new UIManager(this.eventBus);

        // State
        this.currentSong = null;
        this.currentSongId = 'free';
        this.currentStep = 0;
        this.isMicActive = false;
        this.isRecording = false;

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

        // Note played from keyboard
        this.eventBus.on('note:played', (data) => this.onNotePlayed(data));

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

    onNotePlayed(data) {
        const { note, source } = data;

        // UIManager plays audio directly for keyboard presses (immediate response)
        // AudioManager handles playback for mic-detected notes
        if (source === 'mic') {
            this.audioManager.playSound(note);
        }

        // Add to recording (RecordingManager listens to both note:played and note:detected)

        // Check song progress if in learning mode
        if (this.currentSongId !== 'free') {
            this.checkSongProgress(note);
        }
    }

    checkSongProgress(note) {
        if (!this.currentSong) return;

        const notes = this.currentSong.notes;
        const target = notes[this.currentStep];
        if (!target) return;

        if (note === target.note) {
            // Correct note!
            this.currentStep++;

            if (this.currentStep >= notes.length) {
                // Song complete
                this.showCelebration(this.currentSong.title, 100);
            } else {
                // Highlight the next target
                const nextNote = notes[this.currentStep].note;
                this.uiManager.highlightNote(nextNote);
            }
        }
        // Wrong notes are silently ignored — no punishment for Paul
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
                // Highlight the first note immediately
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
