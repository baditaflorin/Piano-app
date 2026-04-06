# ADR-001: Microphone-First Architecture

**Status:** Accepted
**Date:** 2026-04-06
**Context:** Piano app pivot from keyboard-input to microphone-input as primary interaction

## Decision

The app shifts from a **keyboard/mouse-driven piano** to a **microphone-first music learning tool**. The keyboard and clickable keys remain as fallback, but the primary flow is:

1. Paul sings or plays a real instrument into the microphone
2. The app detects what note(s) he played
3. The app visualizes those notes on the piano and in a song timeline
4. At the end, Paul can replay what he played

## Context

The current app lets users press keys on a computer keyboard to play piano sounds. This is fine for adults but unintuitive for a 5-year-old. Paul (our GOAT beta tester) should be able to:

- Sing into the mic and see the piano light up
- See which notes he hit on a colorful timeline
- Hear his performance played back
- Follow along with songs he knows

Pressing `a`, `s`, `d` on a keyboard is not fun for a child. Singing "Twinkle Twinkle" and watching the piano dance IS fun.

## Consequences

### What changes

| Area | Before | After |
|------|--------|-------|
| Primary input | Keyboard keys | Microphone |
| Pitch detection | Single autocorrelation method | Multi-method ensemble (see ADR-002) |
| Song visualization | Progress bar only | Full timeline with note-by-note playback |
| Recording | None | Full session recording with playback |
| Target user | Developer/adult | 5-year-old child (Paul) |

### New modules needed

- **RecordingManager** - captures detected notes with timestamps, enables playback
- **SongVisualizer** - scrolling timeline showing notes as colored blocks
- **SongLibrary** - loads songs from bundled collection + open source sources
- **PitchEngine v2** - multiple detection methods with voting/confidence

### UX principles for Paul

1. **Big, colorful, obvious** - no small text, no subtle indicators
2. **Instant feedback** - every sound Paul makes should produce a visible reaction
3. **No failure state** - wrong notes still look cool, just different color
4. **Celebrate everything** - confetti, stars, sounds when completing songs
5. **One-tap flow** - mic should auto-start, song selection via big picture buttons

## Alternatives Considered

- **MIDI keyboard input**: Too expensive, requires hardware Paul doesn't have
- **Touch screen piano only**: Doesn't teach real pitch/singing
- **Keep keyboard-first**: Not accessible or fun for a 5-year-old
