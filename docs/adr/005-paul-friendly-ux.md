# ADR-005: Paul-Friendly UX - Designing for a 5-Year-Old

**Status:** Accepted
**Date:** 2026-04-06
**Context:** The app's primary user is Paul, a 5-year-old. Every UX decision flows from this.

## Decision

Redesign the entire user experience around the capabilities, attention span, and joy of a 5-year-old child. This ADR captures the UX principles, interaction patterns, and visual design language.

## Paul's Profile (Our GOAT Beta Tester)

- **Age:** 5 years old
- **Reading:** Learning, can recognize some words and letters
- **Motor skills:** Can tap/click large targets, can't precision-click small buttons
- **Attention span:** 5-10 minutes per activity before wanting to switch
- **Motivation:** Fun, colors, sounds, praise, seeing himself succeed
- **Frustration threshold:** Low - if something doesn't work in 2 seconds, he's done

## Core UX Principles

### 1. Zero-Text Navigation

Paul can't reliably read. Every interactive element must be understandable without text:

- **Icons + emoji** for all buttons
- **Color coding** for states (green = go, red = stop, yellow = try again)
- **Audio cues** paired with visual feedback
- Text is supplementary (for parents), never required

### 2. Giant Touch Targets

Minimum interactive element size: **64x64px** (ideally 80x80px+)

```
Bad:  [Start] [Stop] [Settings]     ← tiny text buttons
Good: [ ▶ ]  [ ⬛ ]  [ ⚙ ]         ← big icon buttons, 80px each
```

### 3. Instant Gratification

Every action produces immediate, obvious feedback:

| Action | Feedback (< 100ms) |
|--------|-------------------|
| Sing a note | Piano key lights up + color splash |
| Hit correct note | Star burst animation + happy sound |
| Complete a song | Full-screen confetti + applause |
| Open the app | Friendly wave animation + greeting sound |
| Tap any button | Bounce animation + click sound |

### 4. No Failure, Only Progress

Wrong notes are **never punished**:

- Wrong note: key lights up in a **different color** (still pretty!)
- The timeline shows what Paul played (no X marks or sad faces)
- "Try again" is presented as "One more time!" with enthusiasm
- Progress never goes backward
- Stars/rewards accumulate, never decrease

### 5. Session Length = 5 Minutes

Design every flow to complete within 5 minutes:

- Songs are short (15-30 seconds each)
- Pick song -> sing -> see results -> celebrate = under 2 minutes
- After 3 songs, offer a natural break point: "Great job! Play more?"
- No mandatory tutorials or onboarding flows

## Screen Layout

### Main Screen (Landscape preferred)

```
┌────────────────────────────────────────────────────────┐
│ [Paul's Piano 🎹]                      [🎤 ON] [⚙]  │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │                                                    │ │
│ │           🎵 Song Timeline / Visualizer 🎵         │ │
│ │                                                    │ │
│ │    ██ ██ ██ ██ ██ ██ ██    ██ ██ ██ ██ ██ ██ ██   │ │
│ │    C  C  G  G  A  A  G     F  F  E  E  D  D  C    │ │
│ │    🟢 🟢 🟢 ▶  ▢  ▢  ▢     ▢  ▢  ▢  ▢  ▢  ▢  ▢  │ │
│ │                                                    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │  🔴 🔴 ⬜ 🟠 ⬜ 🟡 🟡 ⬜ 🟢 ⬜ 🔵 🔵 ⬜ 🟣 ⬜  │ │
│ │  C  C# D  D# E  F  F# G  G# A  A# B              │ │
│ │  (colorful piano keys spanning full width)          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│  [ 🏠 Home ]    [ ▶ Play Back ]    [ 📚 Songs ]      │
└────────────────────────────────────────────────────────┘
```

### Song Picker (replaces modal/sidebar)

Full-screen card grid, max 6 visible at once, swipe for more:

- Each card: 120x140px, rounded corners, subtle shadow
- Big emoji icon (48px+)
- Song title below (for parents)
- Difficulty stars
- Tap to start immediately (no confirmation dialog)

### Celebration Screen (after completing a song)

```
┌────────────────────────────────────────┐
│                                        │
│          🎉 🎉 🎉 🎉 🎉              │
│                                        │
│          ⭐ AMAZING! ⭐               │
│                                        │
│    You played Twinkle Twinkle!         │
│                                        │
│         🏆 3/3 Stars! 🏆              │
│                                        │
│                                        │
│    [ ▶ Hear It ]    [ 🔄 Again ]      │
│                                        │
│           [ 📚 New Song ]              │
│                                        │
└────────────────────────────────────────┘
```

## Visual Design Language

### Color palette (bright, saturated, kid-friendly)

```
Background:    #1a0a2e (deep purple - keeps focus on colorful elements)
Primary:       #FF6B6B (warm coral red)
Secondary:     #4ECDC4 (teal/mint)
Accent:        #FFE66D (sunshine yellow)
Success:       #51E898 (bright green)
Piano white:   #FFFFFF
Piano black:   #2D1B4E (purple-black, matches theme)
```

### Typography

- **Display/headers**: Rounded, bubbly font (e.g., "Baloo 2", "Nunito", "Quicksand")
- **Size**: Minimum 18px for any visible text, headers 28px+
- **Weight**: Bold everywhere - thin text is hard for kids to read

### Animations

Keep animations **short** (200-400ms) and **purposeful**:

- **Key press**: Scale 0.95 -> 1.0, color fill
- **Correct note**: Key bounces + small star particles
- **Song complete**: Screen-wide confetti (canvas-based, 2-3 seconds)
- **Button hover/tap**: Gentle scale 1.0 -> 1.05
- **Page transitions**: Slide left/right (no fades - too subtle for kids)

### Sound Design

Non-musical UI sounds should be:
- Short (< 500ms)
- Pleasant (no harsh buzzes for errors)
- Varied (not the same "ding" for everything)

| Event | Sound |
|-------|-------|
| Correct note | Gentle chime |
| Song complete | Applause + fanfare |
| Button tap | Soft pop |
| Start recording | "3, 2, 1, go!" voice |
| Mic activated | Friendly beep |

## Accessibility

Even though Paul is our primary user, keep accessibility in mind:

- All colors pass contrast ratios against dark background
- Animations respect `prefers-reduced-motion`
- Touch targets exceed 44x44px minimum (we target 64x64px+)
- Sound feedback has visual equivalents (for when TV is loud)
- Works in both portrait and landscape

## Parent Mode

A small gear icon gives parents access to:

- **Volume control** (keep it — Paul will max it out)
- **Microphone sensitivity** (for noisy environments)
- **Song management** (add/remove songs)
- **MIDI file import**
- **Difficulty adjustment**

Parent mode is behind a "hold for 3 seconds" gesture to prevent Paul from accidentally entering it.

## Consequences

- The app looks and feels completely different from the current version
- CSS will need a major overhaul (new color system, larger elements, animations)
- piano.html layout changes significantly (timeline area, new nav, celebration overlay)
- Every new feature must pass the "Paul test": can a 5-year-old use it without help?
- Development velocity slightly decreases because we test with a real child

## Success Metrics

How we know the UX works:

1. Paul can pick a song and start singing without adult help
2. Paul plays for > 5 minutes without losing interest
3. Paul asks to play again the next day
4. Paul shows the app to his friends (ultimate validation)
