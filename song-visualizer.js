/**
 * Song Visualizer
 * Shows the song as big colored circles — no text, Paul just matches colors
 */

export class SongVisualizer {
    static NOTE_COLORS = {
        'C': '#FF4444', 'C#': '#FF6666',
        'D': '#FF8844', 'D#': '#FFAA66',
        'E': '#FFDD44', 'F': '#44DD44',
        'F#': '#66EE66', 'G': '#44DDDD',
        'G#': '#66DDDD', 'A': '#4488FF',
        'A#': '#6699FF', 'B': '#AA44FF'
    };

    constructor(eventBus, canvas) {
        this.eventBus = eventBus;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.targetNotes = [];
        this.currentStep = 0;    // which note Paul needs to play next
        this.playedSteps = [];   // which steps have been completed

        this.animFrame   = 0;    // for pulsing animations
        this.holdPct     = 0;    // 0-1, how far along the hold is

        if (this.eventBus) {
            this.eventBus.on('song:step', (data) => {
                this.currentStep = data.step;
                this.playedSteps = data.playedSteps || [];
                this.holdPct = 0;
            });
        }

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setSong(songData) {
        this.targetNotes = [];
        this.currentStep = 0;
        this.playedSteps = [];

        if (!songData || !songData.notes) return;

        for (const n of songData.notes) {
            const note = typeof n === 'string' ? n : n.note;
            this.targetNotes.push(note);
        }
    }

    clear() {
        this.targetNotes = [];
        this.currentStep = 0;
        this.playedSteps = [];
    }

    render() {
        this.animFrame++;
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Clear
        ctx.fillStyle = '#1a0a2e';
        ctx.fillRect(0, 0, W, H);

        if (this.targetNotes.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Pick a song! 📚', W / 2, H / 2);
            return;
        }

        // Layout: circles in a row, centered, scroll so current is always visible
        const CIRCLE_R = Math.min(32, (H * 0.3));
        const GAP = CIRCLE_R * 0.6;
        const STEP = (CIRCLE_R * 2) + GAP;
        const ROW_Y = H / 2;

        // Scroll so the current note is always near the left quarter of the canvas
        const targetX = W * 0.25;
        const scrollOffset = this.currentStep * STEP - targetX + CIRCLE_R;

        for (let i = 0; i < this.targetNotes.length; i++) {
            const note = this.targetNotes[i];
            const baseNote = note.replace(/[0-9]/g, '').replace('#', '#');
            const noteLetter = note.includes('#') ? note.slice(0, 2) : note[0];
            const color = SongVisualizer.NOTE_COLORS[noteLetter] || '#888';

            const cx = i * STEP + CIRCLE_R - scrollOffset;
            const cy = ROW_Y;

            // Skip if off screen
            if (cx + CIRCLE_R < -10 || cx - CIRCLE_R > W + 10) continue;

            const isDone = i < this.currentStep;
            const isCurrent = i === this.currentStep;
            const isFuture = i > this.currentStep;

            ctx.save();

            if (isCurrent) {
                // Pulse: grow slightly in and out
                const pulse = 1 + Math.sin(this.animFrame * 0.12) * 0.12;
                const r = CIRCLE_R * pulse;

                // Outer glow ring
                ctx.beginPath();
                ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
                ctx.fillStyle = color + '44';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
                ctx.fillStyle = color + '88';
                ctx.fill();

                // Main circle
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                // Hold arc — green ring fills clockwise as Paul holds
                if (this.holdPct > 0) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.holdPct);
                    ctx.strokeStyle = '#51E898';
                    ctx.lineWidth = 5;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }

                // Arrow below pointing UP at the current note
                const arrowY = cy + r + 22 + Math.sin(this.animFrame * 0.12) * 5;
                ctx.fillStyle = '#FFE66D';
                ctx.beginPath();
                ctx.moveTo(cx, cy + r + 6);
                ctx.lineTo(cx - 10, arrowY);
                ctx.lineTo(cx + 10, arrowY);
                ctx.closePath();
                ctx.fill();

            } else if (isDone) {
                // Faded with checkmark
                ctx.beginPath();
                ctx.arc(cx, cy, CIRCLE_R * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = color + '55';
                ctx.fill();

                // Checkmark
                ctx.strokeStyle = '#51E898';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx - CIRCLE_R * 0.3, cy);
                ctx.lineTo(cx - CIRCLE_R * 0.05, cy + CIRCLE_R * 0.3);
                ctx.lineTo(cx + CIRCLE_R * 0.4, cy - CIRCLE_R * 0.3);
                ctx.stroke();

            } else {
                // Future note — dimmed
                ctx.beginPath();
                ctx.arc(cx, cy, CIRCLE_R * 0.75, 0, Math.PI * 2);
                ctx.fillStyle = color + '33';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(cx, cy, CIRCLE_R * 0.75, 0, Math.PI * 2);
                ctx.strokeStyle = color + '66';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.restore();
        }

        // Progress text in bottom-left
        if (this.targetNotes.length > 0) {
            const pct = Math.round((this.currentStep / this.targetNotes.length) * 100);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${this.currentStep} / ${this.targetNotes.length}`, 12, H - 10);
        }
    }
}
