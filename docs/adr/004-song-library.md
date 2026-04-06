# ADR-004: Song Library and Open Source Song Loading

**Status:** Accepted
**Date:** 2026-04-06
**Context:** App needs more songs beyond the 2 hardcoded ones, loadable from external sources

## Decision

Build a **SongLibrary** module that:

1. Ships with a curated set of **bundled children's songs** (20+)
2. Can load songs from **MIDI files** (most common open format)
3. Presents songs with **big picture cards** suitable for a 5-year-old

## Context

Currently the app has exactly 2 songs hardcoded in `song-manager.js`: "Twinkle Twinkle" and "Mary Had a Little Lamb". This is limiting. Paul will get bored fast. We need:

- A much larger library of songs appropriate for young children
- The ability to add songs easily without code changes
- Visual song selection that a 5-year-old can navigate

## Song Data Format

### Internal format

```javascript
{
  id: "twinkle",
  title: "Twinkle Twinkle Little Star",
  emoji: "star",          // used for the card icon
  difficulty: 1,          // 1-3 stars
  category: "nursery",    // nursery, disney, folk, etc.
  bpm: 100,
  timeSignature: "4/4",
  notes: [
    { note: "C4", duration: "quarter" },
    { note: "C4", duration: "quarter" },
    { note: "G4", duration: "quarter" },
    { note: "G4", duration: "quarter" },
    { note: "A4", duration: "quarter" },
    { note: "A4", duration: "quarter" },
    { note: "G4", duration: "half" },
    // ...
  ]
}
```

### Why this format over raw note arrays

- **Duration matters** for visualization (quarter notes vs half notes appear different widths)
- **BPM + time signature** enable proper playback timing
- **Metadata** (emoji, difficulty, category) powers the song picker UI
- Still simple enough to author by hand

## Bundled Song Library

### Songs to include (Phase 1 - 20 songs)

**Nursery Rhymes** (difficulty 1):
1. Twinkle Twinkle Little Star
2. Mary Had a Little Lamb
3. Baa Baa Black Sheep
4. Row Row Row Your Boat
5. London Bridge Is Falling Down
6. Hot Cross Buns
7. Rain Rain Go Away
8. Humpty Dumpty

**Simple Melodies** (difficulty 1-2):
9. Jingle Bells
10. Happy Birthday
11. Old MacDonald Had a Farm
12. Itsy Bitsy Spider
13. Wheels on the Bus
14. Frere Jacques (Are You Sleeping)
15. Do Re Mi (Sound of Music)

**Slightly Harder** (difficulty 2-3):
16. Ode to Joy (simplified)
17. When the Saints Go Marching In
18. Amazing Grace (simplified)
19. Can Can (simplified)
20. Fur Elise (first phrase only)

All songs are **public domain** or have melodies in public domain. We store only note sequences (not audio), which is not copyrightable.

## MIDI File Loading

### Why MIDI

- MIDI is the universal format for digital sheet music
- Thousands of free MIDI files available online
- Contains exact note, timing, and velocity information
- Small file size (typically <50KB per song)

### Sources of free MIDI files

| Source | Content | License |
|--------|---------|---------|
| [FreeMidi.org](https://freemidi.org) | Large collection, varied | Free for personal use |
| [BitMidi.com](https://bitmidi.com) | Community uploads | Varies |
| [MidiWorld.com](https://midiworld.com) | Curated classics | Free for personal use |
| [MuseScore community](https://musescore.com) | User transcriptions | CC licenses |

### MIDI parsing approach

- Use a lightweight MIDI parser (e.g., `@tonejs/midi` ~15KB gzipped, or roll our own for Type 0 files)
- Extract melody track (usually Track 1 or highest-note track)
- Convert MIDI note numbers to our internal format
- Quantize timing to nearest beat subdivision
- Present as a regular song in the library

### Load flow

```
User drops MIDI file or clicks "Add Song"
  → Parse MIDI binary
  → Extract melody notes
  → Convert to internal song format
  → Add to library with auto-generated title
  → Available immediately for play/learn
```

## Song Picker UI (Paul-friendly)

### Design

```
┌─────────────────────────────────────────┐
│  Pick a Song!                           │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │         │  │         │  │         │ │
│  │   ⭐    │  │   🐑    │  │   🎄    │ │
│  │         │  │         │  │         │ │
│  │ Twinkle │  │  Mary   │  │ Jingle  │ │
│  │  ⭐     │  │  ⭐     │  │  ⭐⭐   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │   🌧️    │  │   🎂    │  │   🚌    │ │
│  │  Rain   │  │ Happy   │  │ Wheels  │ │
│  │  ⭐     │  │  ⭐⭐   │  │  ⭐     │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│  [ Free Play 🎹 ]   [ Add Song + ]     │
└─────────────────────────────────────────┘
```

### Principles

- **Big cards** (minimum 120x120px) - easy to tap/click
- **Emoji icons** - recognizable without reading
- **Star difficulty** - Paul can pick easier songs first
- **No scrolling needed** on first screen - show 6-9 songs, swipe for more
- **Category tabs** with emoji labels, not text
- **Free Play** always visible as a card
- **Unlock progression** (optional) - complete easy songs to unlock harder ones, gamification!

## Consequences

- Song data moves from hardcoded arrays to a structured library with metadata
- MIDI parsing adds a small dependency or ~200 lines of custom code
- Song picker replaces the current small button row
- All songs must be validated to ensure notes are within our piano range (C4-B5, or extended if needed)
- We may need to extend the piano range or transpose songs to fit

## Alternatives Considered

- **MusicXML format**: More expressive but far more complex to parse, overkill for melody lines
- **ABC notation**: Simple text format, but less tooling and less available content than MIDI
- **Audio file analysis**: Analyzing MP3s to extract notes is a much harder problem, not reliable enough
- **Manual-only song entry**: Too tedious, limits library growth
