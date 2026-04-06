# ADR-003: Song Visualization and Session Playback

**Status:** Accepted
**Date:** 2026-04-06
**Context:** Paul needs to SEE what he played and HEAR it back

## Decision

Add two major visual features:

1. **Live song timeline** - a scrolling visualization showing target notes and played notes in real-time
2. **Session recording & playback** - record everything Paul plays, then replay it with piano sounds

## Context

Right now the app shows a progress bar and highlights the current target note. This is too abstract for a 5-year-old. Paul needs:

- A visual story of the song unfolding (like a music box scroll or Guitar Hero lane)
- To see his notes appear in real-time as colorful blocks
- To press a big "Play" button at the end and hear his performance
- Visual celebration when he finishes

## Song Timeline Visualization

### Layout

```
  ┌──────────────────────────────────────────────┐
  │  ♫ Twinkle Twinkle Little Star               │
  │                                              │
  │  C  C  G  G  A  A  G     F  F  E  E  D  D  C│
  │  ██ ██ ██ ██ ██ ██ ██    ██ ██ ██ ██ ██ ██ ██│
  │  🟢 🟢 🟢 🟢 🔴 ▢  ▢     ▢  ▢  ▢  ▢  ▢  ▢  ▢ │
  │              ↑                               │
  │          current position                    │
  └──────────────────────────────────────────────┘
```

### Design principles

- **Horizontal scroll** - song flows left to right like reading a book
- **Target notes** on top row as colored blocks (each note gets a consistent color)
- **Played notes** on bottom row, appearing as Paul sings/plays
- **Green** = correct match, **Red** = wrong note, **Empty** = not yet played
- **Current position** indicated by a bouncing arrow or glowing cursor
- **Auto-scroll** keeps current position centered on screen
- Large blocks, minimum 48px wide, easily visible from a distance

### Note-to-Color Mapping

Each note gets a fixed color (synesthesia-inspired, consistent across the app):

| Note | Color | Hex |
|------|-------|-----|
| C | Red | #FF4444 |
| D | Orange | #FF8844 |
| E | Yellow | #FFDD44 |
| F | Green | #44DD44 |
| G | Cyan | #44DDDD |
| A | Blue | #4488FF |
| B | Purple | #AA44FF |

Sharps/flats use a lighter tint of the base note color.

This creates a **rainbow piano** effect that helps Paul associate notes with colors - a proven technique in early music education (Boomwhackers, colored bells, etc.).

## Session Recording

### What gets recorded

```javascript
// Each recorded event
{
  note: "C4",        // detected note name
  timestamp: 1234,   // ms since recording started
  duration: 350,     // ms the note was held
  confidence: 0.92,  // from pitch engine
  source: "mic"      // "mic" or "keyboard"
}
```

### Playback

- Press the big **Play** button (appears after recording stops)
- App plays back each note using the AudioManager at recorded timestamps
- Piano keys light up in sequence as notes play
- Timeline cursor moves along showing progress
- **Speed control**: 1x (normal), 0.5x (slow - good for learning), 1.5x (fast - fun!)

### Auto-record behavior

- Recording starts automatically when Paul begins playing/singing
- Recording stops after 3 seconds of silence
- "Play it back!" button appears with a fun animation
- Paul can record again at any time (replaces previous recording)

## Implementation: New Module

### RecordingManager

```
RecordingManager
├── startRecording()       - begin capturing note events
├── stopRecording()        - end capture, prepare for playback
├── addNoteEvent(note, confidence, source)  - called by PianoApp on each detection
├── playRecording()        - replay with AudioManager
├── pausePlayback()        - pause mid-replay
├── getRecordedNotes()     - return array for visualization
├── getRecordingDuration() - total length in ms
└── clear()                - discard recording
```

### SongVisualizer (extends UIManager or standalone)

```
SongVisualizer
├── setSong(songData)          - load target song for comparison view
├── setRecording(noteEvents)   - load recorded notes
├── render()                   - draw the timeline (Canvas or DOM)
├── scrollToPosition(ms)       - scroll timeline to timestamp
├── setPlaybackCursor(ms)      - animate cursor during playback
└── NOTE_COLORS               - static color map
```

## Consequences

- The timeline becomes the **central visual element** of the app, more prominent than the piano itself
- Piano keyboard moves to bottom of screen, timeline takes top/center
- Recording adds state management complexity but the RecordingManager encapsulates it
- Canvas-based timeline rendering for smooth scrolling (DOM would be janky with many elements)
- Need to handle the case where Paul sings a song differently than expected (different timing, extra notes, skipped notes) - use a forgiving alignment algorithm, not strict position matching

## Alternatives Considered

- **Guitar Hero vertical lanes**: Fun but harder to read left-to-right for a child learning to read
- **Sheet music notation**: Way too complex for a 5-year-old
- **Circular/radial visualization**: Cool but confusing for sequential songs
- **Video recording**: Privacy concerns, much heavier implementation, not needed for the core learning loop
