/**
 * Audio Manager
 * Handles sound loading and playback
 */

export class AudioManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.volume = 0.5;
    }

    setVolume(value) {
        this.volume = parseFloat(value);
    }

    playSound(note) {
        const keyEl = document.querySelector(`[data-note="${note}"]`);
        if (!keyEl) return;

        const char = keyEl.dataset.key;
        let fileName = char;

        // Handle author's special naming conventions
        if (char === ".") fileName = "aa";

        const audio = new Audio(`audio/${fileName}.mp3`);
        audio.volume = this.volume;
        audio.play().catch(err => console.warn("Audio play blocked or failed:", err));
    }
}
