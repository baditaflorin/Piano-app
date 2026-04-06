/**
 * Recording Manager
 * Captures detected notes with timestamps and manages playback
 */

export class RecordingManager {
    constructor(eventBus, audioManager) {
        this.eventBus = eventBus;
        this.audioManager = audioManager;
        this.isRecording = false;
        this.recordedNotes = [];
        this.startTime = null;
        this.silenceTimeout = null;
        this.lastNoteTime = null;
        this.silenceDuration = 3000; // 3 seconds of silence to auto-stop

        // Playback state
        this.isPlayingBack = false;
        this.playbackStartTime = null;
        this.playbackSpeed = 1.0;

        // Listen for both mic detections and keyboard presses
        if (this.eventBus) {
            this.eventBus.on('note:detected', (data) => this.onNoteDetected(data));
            this.eventBus.on('note:played', (data) => this.onNoteDetected({ ...data, confidence: 1.0 }));
        }
    }

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.recordedNotes = [];
        this.startTime = Date.now();
        this.lastNoteTime = this.startTime;
        console.log("Recording started");

        if (this.eventBus) {
            this.eventBus.emit('recording:start', {});
        }
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;
        clearTimeout(this.silenceTimeout);

        const duration = Date.now() - this.startTime;
        console.log(`Recording stopped: ${this.recordedNotes.length} notes, ${duration}ms`);

        if (this.eventBus) {
            this.eventBus.emit('recording:stop', {
                duration: duration,
                noteCount: this.recordedNotes.length
            });
        }
    }

    onNoteDetected(data) {
        if (!this.isRecording) return;

        const { note, frequency, confidence, source } = data;

        // Only record high-confidence detections
        if (confidence < 0.7) return;

        const timestamp = Date.now() - this.startTime;
        this.recordedNotes.push({
            note,
            frequency,
            timestamp,
            duration: 0, // Will be updated when note ends
            confidence,
            source
        });

        this.lastNoteTime = Date.now();

        // Reset auto-stop timer
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = setTimeout(() => {
            this.stopRecording();
        }, this.silenceDuration);
    }

    getRecordedNotes() {
        return [...this.recordedNotes];
    }

    getRecordingDuration() {
        if (this.isRecording) {
            return Date.now() - this.startTime;
        }
        return this.recordedNotes.length > 0
            ? this.recordedNotes[this.recordedNotes.length - 1].timestamp
            : 0;
    }

    async playRecording() {
        if (this.isPlayingBack || this.recordedNotes.length === 0) return;

        this.isPlayingBack = true;
        this.playbackStartTime = Date.now();

        if (this.eventBus) {
            this.eventBus.emit('playback:start', {});
        }

        for (let i = 0; i < this.recordedNotes.length; i++) {
            const note = this.recordedNotes[i];
            const nextNote = this.recordedNotes[i + 1];

            // Calculate wait time until next note
            const waitTime = nextNote
                ? (nextNote.timestamp - note.timestamp) / this.playbackSpeed
                : 500;

            // Play the note
            this.audioManager.playSound(note.note);

            // Emit playback progress
            if (this.eventBus) {
                this.eventBus.emit('playback:tick', {
                    currentTime: note.timestamp,
                    totalTime: this.getRecordingDuration()
                });
            }

            // Wait for next note
            await new Promise(r => setTimeout(r, waitTime));

            if (!this.isPlayingBack) break;
        }

        this.isPlayingBack = false;

        if (this.eventBus) {
            this.eventBus.emit('playback:end', {});
        }

        console.log("Playback finished");
    }

    pausePlayback() {
        this.isPlayingBack = false;
    }

    resumePlayback() {
        if (this.isPlayingBack) return;
        this.playRecording();
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
    }

    clear() {
        this.stopRecording();
        this.pausePlayback();
        this.recordedNotes = [];
        console.log("Recording cleared");
    }
}
