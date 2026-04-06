/**
 * Pitch Engine for Piano App - Multi-method Pitch Detection
 * Uses 3 detection methods with voting for robust pitch detection
 * Implements: Autocorrelation (improved), YIN, and FFT spectral peak
 */

export class PitchEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.bufferLength = 2048;
        this.buffer = new Float32Array(this.bufferLength);
        this.isListening = false;
        this.lastDetectedNote = null;

        // Noise gate
        this.noiseFloor = 0;
        this.isCalibrating = false;

        // Note stability filter
        this.detectionHistory = [];
        this.stabilityThreshold = 80; // ms

        // Frequency range for child voice
        this.minFreq = 130; // C3
        this.maxFreq = 1047; // C6
    }

    async start() {
        if (this.isListening) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false }
            });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferLength;
            this.analyser.smoothingTimeConstant = 0.8;
            this.microphone.connect(this.analyser);
            this.isListening = true;

            // Calibrate noise floor for 1 second
            await this.calibrateNoiseFloor();

            this.update();
            console.log("Pitch Engine started with multi-method detection");
        } catch (err) {
            console.error("Error accessing microphone:", err);
            throw err;
        }
    }

    async calibrateNoiseFloor() {
        this.isCalibrating = true;
        let maxRms = 0;
        const samples = 10;

        for (let i = 0; i < samples; i++) {
            this.analyser.getFloatTimeDomainData(this.buffer);
            let rms = 0;
            for (let j = 0; j < this.buffer.length; j++) {
                rms += this.buffer[j] * this.buffer[j];
            }
            rms = Math.sqrt(rms / this.buffer.length);
            maxRms = Math.max(maxRms, rms);
            await new Promise(r => setTimeout(r, 100));
        }

        // Set noise floor at ambient + 6dB
        this.noiseFloor = maxRms * 2;
        this.isCalibrating = false;
        console.log("Noise floor calibrated:", this.noiseFloor.toFixed(4));
    }

    stop() {
        this.isListening = false;
        if (this.microphone) {
            this.microphone.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        console.log("Pitch Engine stopped");
    }

    update() {
        if (!this.isListening || this.isCalibrating) {
            requestAnimationFrame(() => this.update());
            return;
        }

        this.analyser.getFloatTimeDomainData(this.buffer);

        // Check if signal is loud enough
        let rms = 0;
        for (let i = 0; i < this.buffer.length; i++) {
            rms += this.buffer[i] * this.buffer[i];
        }
        rms = Math.sqrt(rms / this.buffer.length);

        if (rms < this.noiseFloor) {
            this.detectionHistory = [];
            requestAnimationFrame(() => this.update());
            return;
        }

        // Run 3 detection methods
        const results = {
            autocorrelation: this.detectAutocorrelation(this.buffer, this.audioContext.sampleRate),
            yin: this.detectYIN(this.buffer, this.audioContext.sampleRate),
            spectral: this.detectSpectral(this.audioContext.sampleRate)
        };

        // Voting logic
        const { note, frequency, confidence } = this.voteOnResults(results);

        if (note && confidence > 0) {
            // Check stability
            const now = Date.now();
            this.detectionHistory.push({ note, frequency, confidence, time: now });

            // Remove old detections
            this.detectionHistory = this.detectionHistory.filter(d => now - d.time < this.stabilityThreshold);

            // Only emit if stable
            if (this.detectionHistory.length >= 2) {
                const stableNote = this.detectionHistory[0].note;
                const allSame = this.detectionHistory.every(d => d.note === stableNote);

                if (allSame) {
                    const avgConfidence = this.detectionHistory.reduce((sum, d) => sum + d.confidence, 0) / this.detectionHistory.length;
                    if (this.lastDetectedNote !== stableNote) {
                        this.lastDetectedNote = stableNote;
                        if (this.eventBus) {
                            this.eventBus.emit('note:detected', {
                                note: stableNote,
                                frequency: frequency,
                                confidence: avgConfidence,
                                source: 'mic'
                            });
                        }
                    }
                }
            }
        }

        requestAnimationFrame(() => this.update());
    }

    /**
     * Autocorrelation with parabolic interpolation
     */
    detectAutocorrelation(buffer, sampleRate) {
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        if (rms < this.noiseFloor) return null;

        let r1 = 0, r2 = buffer.length - 1, thres = 0.2;
        for (let i = 0; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[i]) < thres) {
                r1 = i;
                break;
            }
        }
        for (let i = 1; i < buffer.length / 2; i++) {
            if (Math.abs(buffer[buffer.length - i]) < thres) {
                r2 = buffer.length - i;
                break;
            }
        }

        const slicedBuffer = buffer.slice(r1, r2);
        const c = new Array(slicedBuffer.length).fill(0);
        for (let i = 0; i < slicedBuffer.length; i++) {
            for (let j = 0; j < slicedBuffer.length - i; j++) {
                c[i] += slicedBuffer[j] * slicedBuffer[j + i];
            }
        }

        let d = 0;
        while (d < c.length - 1 && c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < slicedBuffer.length; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        if (maxpos < 1 || maxpos >= c.length - 1) return null;

        let T0 = maxpos;
        // Parabolic interpolation
        const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        const freq = sampleRate / T0;
        return this.isFreqInRange(freq) ? freq : null;
    }

    /**
     * YIN algorithm for more robust pitch detection
     */
    detectYIN(buffer, sampleRate) {
        const threshold = 0.1;

        // Autocorrelation
        const acf = new Array(buffer.length).fill(0);
        for (let lag = 0; lag < buffer.length; lag++) {
            for (let index = 0; index < buffer.length - lag; index++) {
                acf[lag] += buffer[index] * buffer[index + lag];
            }
        }

        // Cumulative mean normalized difference
        const cmnd = new Array(buffer.length).fill(0);
        cmnd[0] = 1;
        let sum = 0;
        for (let lag = 1; lag < buffer.length; lag++) {
            sum += acf[lag];
            cmnd[lag] = (2 * acf[0] - 2 * sum / lag) / (acf[0] - acf[lag]);
        }

        // Find minimum
        let minpos = -1;
        for (let lag = 1; lag < buffer.length; lag++) {
            if (cmnd[lag] < threshold) {
                minpos = lag;
                break;
            }
        }

        if (minpos < 0) return null;

        const freq = sampleRate / minpos;
        return this.isFreqInRange(freq) ? freq : null;
    }

    /**
     * FFT spectral peak detection
     */
    detectSpectral(sampleRate) {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        let maxValue = 0, maxIndex = 0;
        for (let i = 1; i < dataArray.length; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxIndex = i;
            }
        }

        if (maxValue < 20) return null; // Too quiet

        const nyquist = sampleRate / 2;
        const freq = (maxIndex * nyquist) / dataArray.length;
        return this.isFreqInRange(freq) ? freq : null;
    }

    /**
     * Vote on the results from 3 methods
     */
    voteOnResults(results) {
        const frequencies = Object.values(results).filter(f => f !== null);

        if (frequencies.length === 0) {
            return { note: null, frequency: null, confidence: 0 };
        }

        // Check if methods agree within 1 semitone (6% frequency tolerance)
        const midi1 = frequencies.length > 0 ? this.freqToMidi(frequencies[0]) : null;
        const midi2 = frequencies.length > 1 ? this.freqToMidi(frequencies[1]) : null;
        const midi3 = frequencies.length > 2 ? this.freqToMidi(frequencies[2]) : null;

        let agreement = 0;
        let resultFreq = frequencies[0];

        if (midi2 !== null && Math.abs(midi1 - midi2) <= 1) agreement++;
        if (midi3 !== null && Math.abs(midi1 - midi3) <= 1) agreement++;
        if (midi2 !== null && midi3 !== null && Math.abs(midi2 - midi3) <= 1) agreement++;

        // HIGH confidence: 2+ methods agree
        // LOW confidence: only 1 method
        const confidence = agreement >= 2 ? 0.9 : (frequencies.length === 1 ? 0.3 : 0.6);

        const midi = this.freqToMidi(resultFreq);
        const note = this.midiToNoteName(midi);

        return { note, frequency: resultFreq, confidence };
    }

    isFreqInRange(freq) {
        return freq >= this.minFreq && freq <= this.maxFreq;
    }

    freqToMidi(f) {
        return Math.round(12 * Math.log2(f / 440) + 69);
    }

    midiToNoteName(midi) {
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return note + octave;
    }
}
