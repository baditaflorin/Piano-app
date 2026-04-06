# Paul's Piano 🎹

> A microphone-first piano learning app — just play your real piano and the app follows along.

**Live demo → [baditaflorin.github.io/Piano-app](https://baditaflorin.github.io/Piano-app)**

---

## The story

My son **Paul** (5 years old) is learning piano. Most learning apps expect you to tap a screen or click with a mouse. I wanted something different: put a microphone next to the piano, play a real key, and have the app react — no clicking required.

This is what I built for him on weekends.

---

## Built by

**Florin Badita**
[Forbes 30 Under 30](https://www.forbes.com/profile/florin-badita/) · Dad · Open-source builder
[baditaflorin@gmail.com](mailto:baditaflorin@gmail.com) · [github.com/baditaflorin](https://github.com/baditaflorin)

---

## Forked from

[Adityautekar/Piano-app](https://github.com/Adityautekar/Piano-app) — a clean browser piano toy (HTML/CSS/JS, click keys to play notes). I kept the visual keyboard layout and rebuilt everything else from scratch in TypeScript.

---

## How it works

1. Open the app, grant microphone access
2. Pick a song from the library (Twinkle Twinkle, Happy Birthday, …)
3. The app highlights the next key to press — glowing in its synesthesia colour
4. Play that note on a real piano — the mic detects the pitch and advances the song
5. The piano-roll scrolls, completed notes get a green tick, wrong notes show in red

No clicking needed. Paul just plays.

---

## Features

| | |
|---|---|
| 🎤 **Mic-first** | Real piano → mic → pitch detection → song advances automatically |
| 🎵 **Song library** | Twinkle Twinkle, Happy Birthday, more — easy to add new songs in JSON |
| 🎼 **Piano-roll** | Horizontal note blocks scroll in sync; correct/wrong overlays |
| 🌈 **Synesthesia colours** | Every note has a fixed colour (C=red, D=orange … B=purple) |
| 🔵 **Free-play spectrum** | Radial audioMotion-analyzer visualizer when no song is active |
| 🎹 **Keyboard fallback** | Click keys or use computer keyboard if no mic available |
| ⚙️ **Parent settings** | Frequency range sliders (filter out adult voices), volume, voice-piano mode |
| 🔇 **No audio files** | All sounds synthesised via Web Audio API — nothing to download |

---

## Getting started

```bash
git clone https://github.com/baditaflorin/Piano-app
cd Piano-app
npm install
```

**Build:**
```bash
npx esbuild src/app.ts --bundle --format=esm --outfile=dist/app.js --sourcemap --platform=browser --target=es2020
```

**Run locally:**
```bash
npx serve . -l 3001
# open http://localhost:3001/piano.html
```

> Allow microphone access — the app is designed around it.

---

## Architecture

```
src/
  app.ts                          Pure wiring — no game logic
  song-progression-controller.ts  Step tracking, note matching, advancement
  pitch-engine.ts                 McLeod Pitch Method (pitchy), mic capture
  mic-visualizer.ts               audioMotion-analyzer free-play spectrum
  song-visualizer.ts              Canvas piano-roll for song mode
  audio-manager.ts                Web Audio API piano synthesis (harmonics + ADSR)
  ui-manager.ts                   DOM, key highlights, hold-fill bar
  song-library.ts                 Loads songs/bundled.json
  recording-manager.ts            Note recording & playback
  types.ts                        Shared types & typed EventBus EventMap

songs/
  bundled.json                    Song data — { note, duration, bpm }
```

All modules communicate through a typed `EventBus`. No direct cross-module calls except constructor injection. Each module has one job.

---

## Tech stack

| | |
|---|---|
| [pitchy](https://github.com/ianprime0509/pitchy) | McLeod Pitch Method — accurate real-time pitch detection |
| [audioMotion-analyzer](https://audiomotion.dev) | Production audio spectrum / radial visualizer |
| TypeScript + esbuild | Type safety, ~140 KB bundle |
| Web Audio API | Piano synthesis, mic capture |
| Canvas 2D | Piano-roll renderer |
| GitHub Actions + Pages | CI/CD — every push to master auto-deploys the live demo |

---

## Deployment

The live demo is auto-deployed on every push to `master` via GitHub Actions (see `.github/workflows/deploy.yml`). The workflow installs dependencies, builds the TypeScript bundle with esbuild, and deploys the static output to GitHub Pages.

---

## Original project

> **Piano WebApp** — [Adityautekar](https://github.com/Adityautekar/Piano-app)
> Simple browser piano. Click keys or use keyboard to play. HTML/CSS/JS.

---

*Made with ☕ and a lot of patience during Paul's nap time.*
