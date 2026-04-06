/**
 * Song Manager
 * Stores song data and manages learning progress
 */

export const SONGS = {
    twinkle: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"],
    mary: ["E4", "D4", "C4", "D4", "E4", "E4", "E4", "D4", "D4", "D4", "E4", "G4", "G4"]
};

export class SongManager {
    constructor() {
        this.currentSongId = 'free';
        this.step = 0;
    }

    startSong(songId) {
        this.currentSongId = songId;
        this.step = 0;
        return this.isFreePlay() ? null : SONGS[songId][0];
    }

    isFreePlay() {
        return this.currentSongId === 'free';
    }

    getCurrentTarget() {
        if (this.isFreePlay()) return null;
        return SONGS[this.currentSongId][this.step];
    }

    checkProgress(note) {
        if (this.isFreePlay()) return { status: 'none' };
        
        const target = SONGS[this.currentSongId][this.step];
        if (note === target) {
            this.step++;
            const isComplete = this.step >= SONGS[this.currentSongId].length;
            if (isComplete) {
                this.currentSongId = 'free';
                return { status: 'complete' };
            }
            return { status: 'next', nextTarget: SONGS[this.currentSongId][this.step] };
        }
        return { status: 'wrong' };
    }

    getProgressPercentage() {
        if (this.isFreePlay()) return 0;
        return (this.step / SONGS[this.currentSongId].length) * 100;
    }
}
