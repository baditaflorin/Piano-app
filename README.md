# Paul's Piano

A microphone-first piano learning app built for **Paul**, a 5-year-old learning to play piano.

Play a real piano (or sing) into the microphone — the app listens, detects the pitch in real time, and guides you through songs step by step.

---

## Fork

This is a fork of [Adityautekar/Piano-app](https://github.com/Adityautekar/Piano-app) — originally a simple browser piano toy built with HTML, CSS, and JavaScript.

**Fork author:** Florin Badita — [baditaflorin@gmail.com](mailto:baditaflorin@gmail.com)
**Built for:** Paul (age 5)

The fork rewrites the app from the ground up as a mic-first music learning tool with real-time pitch detection, song progression, and a piano-roll visualizer.

---

## What's new in this fork

| Original | This fork |
|---|---|
| Click keys to play sounds | Real piano mic input drives the whole app |
| No songs / learning mode | Guided song mode with step-by-step progression |
| Plain JS | TypeScript + esbuild, modular architecture |
| No visualizer | Piano-roll timeline + free-play spectrum visualizer |
| No pitch detection | McLeod Pitch Method via [pitchy](https://github.com/ianprime0509/pitchy) |
| No note colours | Synesthesia colour system (C=red … B=purple) |

---

## Features

- **Mic-first** — plays along as Paul presses real piano keys; the app detects pitch and advances the song automatically
- **Song library** — Twinkle Twinkle, Happy Birthday, and more; pick a song and follow the glowing key
- **Piano-roll visualizer** — horizontal note blocks scroll in real time; completed notes show a green tick
- **Free-play spectrum** — radial frequency visualizer powered by [audioMotion-analyzer](https://audiomotion.dev) with synesthesia colours; big note name flashes on detection
- **Keyboard & mouse fallback** — click keys or press keyboard shortcuts if no mic is available
- **Parent settings** — frequency range sliders to filter out adult voices, volume control, voice-piano mode (mic → synth sound)
- **No audio files** — all piano sounds synthesised in the browser via Web Audio API (harmonics + ADSR)

---

## Getting started

```bash
git clone https://github.com/baditaflorin/Piano-app
cd Piano-app
npm install
```

### Build

```bash
npx esbuild src/app.ts --bundle --format=esm --outfile=dist/app.js --sourcemap --platform=browser --target=es2020
```

### Run

```bash
npx serve . -l 3001
# then open http://localhost:3001/piano.html
```

> Allow microphone access when the browser asks — the whole app is designed around it.

---

## Architecture

```
src/
  app.ts                       # Pure wiring — no game logic
  song-progression-controller.ts  # Step tracking, note matching, advancement
  pitch-engine.ts              # McLeod Pitch Method (pitchy), mic setup
  mic-visualizer.ts            # audioMotion-analyzer free-play spectrum
  song-visualizer.ts           # Canvas piano-roll for song mode
  audio-manager.ts             # Web Audio API piano synthesis
  ui-manager.ts                # DOM, key highlights, hold fill
  song-library.ts              # Loads songs from songs/bundled.json
  recording-manager.ts         # Note recording & playback
  types.ts                     # Shared types & EventMap
songs/
  bundled.json                 # Song data (note, duration, bpm)
```

Each module has a single responsibility. Modules communicate exclusively through a typed `EventBus` — no direct cross-module calls except for construction-time dependency injection.

---

## Tech stack

| Library | Purpose |
|---|---|
| [pitchy](https://github.com/ianprime0509/pitchy) | McLeod Pitch Method — real-time mic pitch detection |
| [audioMotion-analyzer](https://audiomotion.dev) | Production-grade audio spectrum / radial visualizer |
| TypeScript + esbuild | Type safety, fast bundling |
| Web Audio API | Piano synthesis, mic capture |
| Canvas 2D | Piano-roll renderer |

---

## Original project

> **Piano WebApp** by [Adityautekar](https://github.com/Adityautekar/Piano-app)
> Simple browser piano — click keys or use keyboard to play notes.
> Technologies: HTML, CSS, JavaScript.

---

Happy playing, Paul! 🎹
