/**
 * Pitch Engine — powered by pitchy (McLeod Pitch Method)
 * https://github.com/ianprime0509/pitchy
 *
 * Pitchy is a production-grade, lightweight (~10KB) pitch detector that
 * outperforms hand-rolled autocorrelation and returns a clarity score (0-1)
 * so we know how confident the detection is.
 */

import { PitchDetector } from 'https://esm.sh/pitchy@4';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function freqToNoteName(freq) {
    if (!freq || freq <= 0) return null;
    const midi = Math.round(12 * Math.log2(freq / 440) + 69);
    if (midi < 36 || midi > 96) return null; // C2–C7 range
    const name   = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
}

export class PitchEngine {
    constructor(eventBus) {
        this.eventBus    = eventBus;
        this.isListening = false;

        this._ctx        = null;
        this._stream     = null;
        this._analyser   = null;
        this._detector   = null;
        this._inputBuf   = null;
        this._rafId      = null;

        // Stability: require the same note for N consecutive frames before emitting
        this._lastNote   = null;
        this._noteCount  = 0;
        this.STABILITY   = 2;       // ~2 frames (~80ms at 60fps) to confirm
        this.CLARITY_MIN = 0.88;    // pitchy clarity threshold (0-1)

        // Frequency range: child voice + piano keys (C3–C7)
        this.FREQ_MIN = 130;   // C3
        this.FREQ_MAX = 2093;  // C7
    }

    async start() {
        if (this.isListening) return;

        this._stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
        });

        this._ctx     = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._ctx.createAnalyser();
        this._analyser.fftSize = 2048;
        this._analyser.smoothingTimeConstant = 0;  // pitchy works better without smoothing

        const source = this._ctx.createMediaStreamSource(this._stream);
        source.connect(this._analyser);

        // PitchDetector is created for the analyser's buffer size + sample rate
        this._detector = PitchDetector.forFloat32(this._analyser.fftSize);
        this._inputBuf = new Float32Array(this._analyser.fftSize);

        this.isListening = true;
        this._loop();
        console.log('[PitchEngine] Started (pitchy/McLeod Pitch Method)');
    }

    stop() {
        this.isListening = false;
        cancelAnimationFrame(this._rafId);
        this._stream?.getTracks().forEach(t => t.stop());
        this._ctx?.close();
        this._ctx      = null;
        this._analyser = null;
        this._detector = null;
        this._lastNote = null;
        this._noteCount = 0;
        console.log('[PitchEngine] Stopped');
    }

    _loop() {
        if (!this.isListening) return;

        this._analyser.getFloatTimeDomainData(this._inputBuf);
        const [freq, clarity] = this._detector.findPitch(this._inputBuf, this._ctx.sampleRate);

        if (clarity >= this.CLARITY_MIN && freq >= this.FREQ_MIN && freq <= this.FREQ_MAX) {
            const note = freqToNoteName(freq);
            if (note) {
                if (note === this._lastNote) {
                    this._noteCount++;
                } else {
                    this._lastNote  = note;
                    this._noteCount = 1;
                }

                // Only emit after STABILITY consecutive frames of the same note
                if (this._noteCount === this.STABILITY) {
                    this.eventBus?.emit('note:detected', {
                        note,
                        frequency: freq,
                        confidence: clarity,
                        source: 'mic'
                    });
                }
            }
        } else {
            // Silence / unclear — reset stability counter
            this._lastNote  = null;
            this._noteCount = 0;
        }

        this._rafId = requestAnimationFrame(() => this._loop());
    }
}
