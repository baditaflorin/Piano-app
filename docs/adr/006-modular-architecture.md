# ADR-006: Modular Architecture for the New Piano App

**Status:** Accepted
**Date:** 2026-04-06
**Context:** Defining the module boundaries and data flow for the refactored app

## Decision

Maintain the current ES6 module approach but expand from 5 modules to 8, with clear responsibilities and a central event bus for communication.

## Current Modules (keep & refactor)

| Module | Current Role | New Role |
|--------|-------------|----------|
| `script2.js` (PianoApp) | Main orchestrator | Remains orchestrator, adds event bus |
| `audio-manager.js` | Plays audio files | Add playback scheduling for recordings |
| `pitch-engine.js` | Single autocorrelation | Multi-method ensemble (ADR-002) |
| `song-manager.js` | 2 hardcoded songs | Delegates to SongLibrary, handles learning logic |
| `ui-manager.js` | DOM manipulation | Focus on piano keys + layout, delegates timeline to SongVisualizer |

## New Modules

| Module | Responsibility |
|--------|---------------|
| `recording-manager.js` | Capture note events with timestamps, manage playback state |
| `song-visualizer.js` | Canvas-based timeline rendering, note-color mapping, scroll logic |
| `song-library.js` | Song collection, MIDI loading, song metadata, persistence |

## Module Dependency Graph

```
                    ┌──────────────┐
                    │   PianoApp   │  (orchestrator + event bus)
                    │  script2.js  │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────────┐
            │              │                  │
            ▼              ▼                  ▼
    ┌──────────────┐ ┌───────────┐  ┌──────────────────┐
    │ PitchEngine  │ │ UIManager │  │ RecordingManager │
    │              │ │           │  │                  │
    └──────────────┘ └─────┬─────┘  └────────┬─────────┘
                           │                 │
                    ┌──────┴──────┐          │
                    ▼             ▼          ▼
             ┌────────────┐ ┌──────────┐ ┌──────────────┐
             │SongVisualizer│ │AudioMgr │ │ SongLibrary  │
             └────────────┘ └──────────┘ └──────────────┘
                    │
                    ▼
             ┌────────────┐
             │ SongManager│
             └────────────┘
```

## Event Bus

Instead of direct callbacks (current approach), use a simple pub/sub event bus on PianoApp:

```javascript
// Events emitted
'note:detected'     // { note, frequency, confidence, source }
'note:played'       // { note, source }
'song:selected'     // { songId }
'song:progress'     // { step, total, status }
'song:complete'     // { songId, score, recordedNotes }
'recording:start'   // {}
'recording:stop'    // { duration, noteCount }
'playback:start'    // {}
'playback:tick'     // { currentTime }
'playback:end'      // {}
'mic:start'         // {}
'mic:stop'          // {}
```

### Why an event bus

- Modules don't need direct references to each other
- Adding new modules doesn't require changing existing ones
- Easy to debug: log all events in dev mode
- Natural fit for the reactive, real-time nature of the app

### Implementation

Simple built-in, no library needed:

```javascript
class EventBus {
  constructor() { this.listeners = {}; }
  on(event, fn) { (this.listeners[event] ??= []).push(fn); }
  off(event, fn) { this.listeners[event] = this.listeners[event]?.filter(f => f !== fn); }
  emit(event, data) { this.listeners[event]?.forEach(fn => fn(data)); }
}
```

## File Structure (after refactor)

```
Piano-app/
├── index.html              ← rename from piano.html
├── styles/
│   ├── main.css            ← base layout, variables, typography
│   ├── piano.css           ← piano keyboard styles
│   ├── visualizer.css      ← timeline and song visualizer
│   └── animations.css      ← celebrations, transitions
├── js/
│   ├── app.js              ← PianoApp + EventBus (renamed from script2.js)
│   ├── audio-manager.js
│   ├── pitch-engine.js     ← refactored per ADR-002
│   ├── song-manager.js
│   ├── song-library.js     ← new
│   ├── song-visualizer.js  ← new
│   ├── recording-manager.js ← new
│   └── ui-manager.js
├── songs/
│   ├── bundled.json        ← all bundled songs in one file
│   └── midi/               ← user-imported MIDI files (if using local storage)
├── audio/                  ← existing piano samples
├── docs/
│   └── adr/                ← these documents
├── Makefile
└── README.md
```

## Data Flow: "Paul sings a note"

```
1. Microphone captures audio
2. PitchEngine runs 3 detection methods
3. Consensus reached → emit 'note:detected' { note: "G4", confidence: 0.95 }
4. Listeners react independently:
   - UIManager: highlights G4 key with color
   - SongManager: checks if G4 matches target → emit 'song:progress'
   - RecordingManager: appends { note: "G4", timestamp: 4523, ... }
   - SongVisualizer: draws G4 block on timeline
   - AudioManager: plays G4 sound (optional, fun echo mode)
5. If song complete → emit 'song:complete'
   - UIManager: shows celebration screen
   - RecordingManager: finalizes recording
   - SongVisualizer: shows complete timeline with score
```

## Initialization Order

```javascript
// app.js
const bus = new EventBus();
const audioManager = new AudioManager(bus);
const pitchEngine = new PitchEngine(bus);
const songLibrary = new SongLibrary();
const songManager = new SongManager(bus, songLibrary);
const recordingManager = new RecordingManager(bus, audioManager);
const songVisualizer = new SongVisualizer(bus, canvas);
const uiManager = new UIManager(bus, songVisualizer);

// Start
await songLibrary.load();
uiManager.render();
```

## Consequences

- Clean separation means each module can be tested independently
- Event bus adds a small amount of indirection but greatly reduces coupling
- File restructuring into `js/` and `styles/` directories is a one-time migration
- The `songs/bundled.json` file externalizes song data from code
- Module count grows from 5 to 8, but each module is focused and small

## Alternatives Considered

- **Single file**: Current approach of flat files works for 5 modules but gets messy at 8+
- **Framework (React/Vue)**: Overkill for this app, adds build step, larger bundle
- **Web Components**: Good encapsulation but more boilerplate than needed
- **State management library**: The event bus is sufficient for our scale
