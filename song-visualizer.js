/**
 * Song Visualizer
 * Canvas-based timeline showing target notes and played notes
 */

export class SongVisualizer {
    // Note-to-color mapping (synesthesia-inspired)
    static NOTE_COLORS = {
        'C': '#FF4444', 'C#': '#FF6666',
        'D': '#FF8844', 'D#': '#FFAA66',
        'E': '#FFDD44', 'F': '#44DD44',
        'F#': '#66DD66', 'G': '#44DDDD',
        'G#': '#66DDDD', 'A': '#4488FF',
        'A#': '#6699FF', 'B': '#AA44FF'
    };

    constructor(eventBus, canvas) {
        this.eventBus = eventBus;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.targetNotes = [];
        this.recordedNotes = [];
        this.currentTime = 0;
        this.isPlaying = false;
        this.scrollPosition = 0;

        // Visual settings
        this.noteBlockWidth = 60;
        this.noteBlockHeight = 40;
        this.spacing = 10;
        this.playheadX = canvas.width / 2;

        // Listen to events
        if (this.eventBus) {
            this.eventBus.on('note:detected', (data) => this.onNoteDetected(data));
            this.eventBus.on('playback:start', () => { this.isPlaying = true; });
            this.eventBus.on('playback:end', () => { this.isPlaying = false; });
            this.eventBus.on('playback:tick', (data) => {
                this.currentTime = data.currentTime;
            });
        }

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.playheadX = this.canvas.width / 2;
    }

    setSong(songData) {
        this.targetNotes = [];
        if (!songData || !songData.notes) return;

        // Handle both array of strings and array of objects
        const notes = songData.notes;
        let currentTime = 0;

        for (let i = 0; i < notes.length; i++) {
            const noteData = typeof notes[i] === 'string' ? { note: notes[i], duration: 'quarter' } : notes[i];
            const duration = this.durationToMs(noteData.duration);

            this.targetNotes.push({
                note: noteData.note,
                timestamp: currentTime,
                duration: duration
            });

            currentTime += duration;
        }

        console.log(`Visualizer loaded ${this.targetNotes.length} target notes`);
    }

    setRecording(recordedNotes) {
        this.recordedNotes = [...recordedNotes];
        console.log(`Visualizer loaded ${this.recordedNotes.length} recorded notes`);
    }

    onNoteDetected(data) {
        if (!this.isPlaying) {
            // During recording, add to recorded notes
            this.recordedNotes.push({
                note: data.note,
                timestamp: this.recordedNotes.length === 0 ? 0 :
                    this.recordedNotes[this.recordedNotes.length - 1].timestamp + 100,
                duration: 100,
                confidence: data.confidence
            });
        }
    }

    durationToMs(duration) {
        const bpm = 100; // Default tempo
        const quarterMs = (60000 / bpm);

        const durationMap = {
            'whole': quarterMs * 4,
            'half': quarterMs * 2,
            'quarter': quarterMs,
            'eighth': quarterMs / 2,
            'sixteenth': quarterMs / 4
        };

        return durationMap[duration] || quarterMs;
    }

    render() {
        this.ctx.fillStyle = 'rgba(26, 10, 46, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw top row: target notes
        this.drawTargetNotes();

        // Draw bottom row: recorded notes
        this.drawRecordedNotes();

        // Draw playhead
        this.drawPlayhead();

        // Auto-scroll to keep playhead centered
        this.updateScroll();
    }

    drawTargetNotes() {
        const startTime = this.scrollPosition;
        const endTime = startTime + this.getVisibleDuration();

        this.ctx.fillStyle = '#555';
        this.ctx.fillText('Target:', 10, 35);

        for (const target of this.targetNotes) {
            if (target.timestamp + target.duration < startTime || target.timestamp > endTime) {
                continue;
            }

            const x = this.timeToX(target.timestamp);
            const width = Math.max(this.noteBlockWidth, this.durationToWidth(target.duration));
            const color = SongVisualizer.NOTE_COLORS[target.note] || '#888';

            this.drawNoteBlock(x, 50, width, this.noteBlockHeight, color, target.note);
        }
    }

    drawRecordedNotes() {
        const startTime = this.scrollPosition;
        const endTime = startTime + this.getVisibleDuration();

        this.ctx.fillStyle = '#888';
        this.ctx.fillText('You:', 10, this.canvas.height - 50);

        for (const recorded of this.recordedNotes) {
            if (recorded.timestamp + recorded.duration < startTime || recorded.timestamp > endTime) {
                continue;
            }

            const x = this.timeToX(recorded.timestamp);
            const width = Math.max(this.noteBlockWidth, this.durationToWidth(recorded.duration));
            const color = SongVisualizer.NOTE_COLORS[recorded.note] || '#888';

            // Check if it matches a target
            const matchesTarget = this.findMatchingTarget(recorded);
            const alpha = recorded.confidence > 0.7 ? 1 : 0.5;

            this.ctx.globalAlpha = alpha;
            this.drawNoteBlock(x, this.canvas.height - 100, width, this.noteBlockHeight,
                               matchesTarget ? '#4CAF50' : color, recorded.note);
            this.ctx.globalAlpha = 1;
        }
    }

    drawNoteBlock(x, y, width, height, color, label) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, width, height);

        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Draw note label
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, x + width / 2, y + height / 2 + 4);
    }

    drawPlayhead() {
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.playheadX, 0);
        this.ctx.lineTo(this.playheadX, this.canvas.height);
        this.ctx.stroke();

        // Triangle indicator
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.beginPath();
        this.ctx.moveTo(this.playheadX - 8, 0);
        this.ctx.lineTo(this.playheadX + 8, 0);
        this.ctx.lineTo(this.playheadX, 12);
        this.ctx.fill();
    }

    timeToX(timeMs) {
        const pixelsPerMs = this.canvas.width / this.getVisibleDuration();
        return (timeMs - this.scrollPosition) * pixelsPerMs;
    }

    xToTime(x) {
        const pixelsPerMs = this.canvas.width / this.getVisibleDuration();
        return this.scrollPosition + (x / pixelsPerMs);
    }

    durationToWidth(durationMs) {
        const pixelsPerMs = this.canvas.width / this.getVisibleDuration();
        return Math.max(20, durationMs * pixelsPerMs);
    }

    getVisibleDuration() {
        return 15000; // Show 15 seconds at a time
    }

    updateScroll() {
        if (this.isPlaying) {
            // Keep playhead centered
            this.scrollPosition = Math.max(0, this.currentTime - this.getVisibleDuration() / 2);
        }
    }

    scrollToPosition(timeMs) {
        this.scrollPosition = Math.max(0, timeMs - this.getVisibleDuration() / 2);
    }

    findMatchingTarget(recordedNote) {
        // Find a target note near this recorded note
        for (const target of this.targetNotes) {
            if (target.note === recordedNote.note &&
                Math.abs(target.timestamp - recordedNote.timestamp) < 500) {
                return true;
            }
        }
        return false;
    }

    clear() {
        this.targetNotes = [];
        this.recordedNotes = [];
        this.currentTime = 0;
        this.scrollPosition = 0;
    }
}
