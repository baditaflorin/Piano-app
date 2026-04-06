/**
 * Song Library
 * Manages bundled songs and user-loaded songs
 */

import { Song, SongNote, NoteDuration } from './types';

export class SongLibrary {
  private songs: Song[];
  private readonly bundledPath: string;

  constructor() {
    this.songs       = [];
    this.bundledPath = 'songs/bundled.json';
  }

  async load(): Promise<Song[]> {
    try {
      const response = await fetch(this.bundledPath);
      if (!response.ok) throw new Error(`Failed to load songs: ${response.status}`);
      this.songs = (await response.json()) as Song[];
      console.log(`Loaded ${this.songs.length} bundled songs`);
      return this.songs;
    } catch (err) {
      console.error('Error loading song library:', err);
      // Fallback to minimal set if loading fails
      this.songs = this.getDefaultSongs();
      return this.songs;
    }
  }

  private getDefaultSongs(): Song[] {
    return [
      {
        id: 'twinkle',
        title: 'Twinkle Twinkle Little Star',
        emoji: '⭐',
        difficulty: 1,
        category: 'nursery',
        bpm: 90,
        notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'].map(
          note => ({ note, duration: 'quarter' as NoteDuration })
        )
      },
      {
        id: 'mary',
        title: 'Mary Had a Little Lamb',
        emoji: '🐑',
        difficulty: 1,
        category: 'nursery',
        bpm: 90,
        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'D4', 'D4', 'D4', 'E4', 'G4', 'G4'].map(
          note => ({ note, duration: 'quarter' as NoteDuration })
        )
      }
    ];
  }

  getSong(id: string): Song | undefined {
    return this.songs.find(s => s.id === id);
  }

  getAllSongs(): Song[] {
    return [...this.songs];
  }

  getSongsByDifficulty(difficulty: 1 | 2 | 3): Song[] {
    return this.songs.filter(s => s.difficulty === difficulty);
  }

  getSongsByCategory(category: string): Song[] {
    return this.songs.filter(s => s.category === category);
  }

  addSong(songData: Song): Song {
    if (!songData.id || !songData.title || !songData.notes || songData.notes.length === 0) {
      throw new Error('Invalid song data');
    }

    if (this.songs.some(s => s.id === songData.id)) {
      throw new Error('Song with this ID already exists');
    }

    // Set defaults
    songData.emoji      = songData.emoji      || '🎵';
    songData.difficulty = songData.difficulty || 1;
    songData.category   = songData.category   || 'user';
    songData.bpm        = songData.bpm        || 100;

    this.songs.push(songData);
    console.log(`Added song: ${songData.title}`);
    return songData;
  }

  /** Parse a simple note-name array into SongNote objects */
  parseNoteArray(notes: string[]): SongNote[] {
    return notes.map(note => ({
      note,
      duration: 'quarter' as NoteDuration
    }));
  }

  getCategories(): string[] {
    const categories = new Set(this.songs.map(s => s.category));
    return Array.from(categories);
  }

  getDifficulties(): number[] {
    const difficulties = new Set(this.songs.map(s => s.difficulty));
    return Array.from(difficulties).sort();
  }

  /** Convert song notes to a simple array of note names (backwards compatibility) */
  getSongNotes(id: string): string[] {
    const song = this.getSong(id);
    if (!song) return [];
    return song.notes.map(n => n.note);
  }
}
