/**
 * Song Library
 * Manages bundled songs and user-loaded songs
 */

export class SongLibrary {
    constructor() {
        this.songs = [];
        this.bundledPath = 'songs/bundled.json';
    }

    async load() {
        try {
            const response = await fetch(this.bundledPath);
            if (!response.ok) throw new Error(`Failed to load songs: ${response.status}`);
            this.songs = await response.json();
            console.log(`Loaded ${this.songs.length} bundled songs`);
            return this.songs;
        } catch (err) {
            console.error("Error loading song library:", err);
            // Fallback to minimal set if loading fails
            this.songs = this.getDefaultSongs();
            return this.songs;
        }
    }

    getDefaultSongs() {
        return [
            {
                id: "twinkle",
                title: "Twinkle Twinkle Little Star",
                emoji: "⭐",
                difficulty: 1,
                category: "nursery",
                notes: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"]
            },
            {
                id: "mary",
                title: "Mary Had a Little Lamb",
                emoji: "🐑",
                difficulty: 1,
                category: "nursery",
                notes: ["E4", "D4", "C4", "D4", "E4", "E4", "E4", "D4", "D4", "D4", "E4", "G4", "G4"]
            }
        ];
    }

    getSong(id) {
        return this.songs.find(s => s.id === id);
    }

    getAllSongs() {
        return [...this.songs];
    }

    getSongsByDifficulty(difficulty) {
        return this.songs.filter(s => s.difficulty === difficulty);
    }

    getSongsByCategory(category) {
        return this.songs.filter(s => s.category === category);
    }

    addSong(songData) {
        // Validate song data
        if (!songData.id || !songData.title || !songData.notes || songData.notes.length === 0) {
            throw new Error("Invalid song data");
        }

        // Check if song already exists
        if (this.songs.some(s => s.id === songData.id)) {
            throw new Error("Song with this ID already exists");
        }

        // Set defaults
        songData.emoji = songData.emoji || "🎵";
        songData.difficulty = songData.difficulty || 1;
        songData.category = songData.category || "user";
        songData.bpm = songData.bpm || 100;

        this.songs.push(songData);
        console.log(`Added song: ${songData.title}`);
        return songData;
    }

    // Parse simple note format (array of note names)
    parseNoteArray(notes) {
        return notes.map(note => ({
            note: note,
            duration: "quarter"
        }));
    }

    getCategories() {
        const categories = new Set(this.songs.map(s => s.category));
        return Array.from(categories);
    }

    getDifficulties() {
        const difficulties = new Set(this.songs.map(s => s.difficulty));
        return Array.from(difficulties).sort();
    }

    // Convert song notes to simple array of note names (backwards compatibility)
    getSongNotes(id) {
        const song = this.getSong(id);
        if (!song) return [];

        // Handle both formats: array of strings and array of objects
        if (typeof song.notes[0] === 'string') {
            return song.notes;
        } else {
            return song.notes.map(n => n.note);
        }
    }
}
