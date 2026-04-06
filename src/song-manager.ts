/**
 * Song Manager
 * Stores song data and manages learning progress
 */

export const SONGS: Record<string, string[]> = {
  twinkle: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'],
  mary:    ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'D4', 'D4', 'D4', 'E4', 'G4', 'G4']
};

type ProgressResult =
  | { status: 'none' }
  | { status: 'wrong' }
  | { status: 'complete' }
  | { status: 'next'; nextTarget: string };

export class SongManager {
  public currentSongId: string;
  public step: number;

  constructor() {
    this.currentSongId = 'free';
    this.step          = 0;
  }

  startSong(songId: string): string | null {
    this.currentSongId = songId;
    this.step          = 0;
    if (this.isFreePlay()) return null;
    const song = SONGS[songId];
    return song ? song[0] : null;
  }

  isFreePlay(): boolean {
    return this.currentSongId === 'free';
  }

  getCurrentTarget(): string | null {
    if (this.isFreePlay()) return null;
    return SONGS[this.currentSongId]?.[this.step] ?? null;
  }

  checkProgress(note: string): ProgressResult {
    if (this.isFreePlay()) return { status: 'none' };

    const song = SONGS[this.currentSongId];
    if (!song) return { status: 'none' };

    const target = song[this.step];
    if (note === target) {
      this.step++;
      if (this.step >= song.length) {
        this.currentSongId = 'free';
        return { status: 'complete' };
      }
      return { status: 'next', nextTarget: song[this.step] };
    }
    return { status: 'wrong' };
  }

  getProgressPercentage(): number {
    if (this.isFreePlay()) return 0;
    const song = SONGS[this.currentSongId];
    if (!song) return 0;
    return (this.step / song.length) * 100;
  }
}
