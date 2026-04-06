# ADR-002: Robust Multi-Method Pitch Detection

**Status:** Accepted
**Date:** 2026-04-06
**Context:** Single autocorrelation method is brittle, especially for a child's voice

## Decision

Replace the single autocorrelation pitch detector with an **ensemble of 3 methods** that vote on the detected pitch. A note is only confirmed when at least 2 methods agree within a semitone tolerance.

## Context

The current `PitchEngine` uses a single time-domain autocorrelation algorithm. Problems:

1. **Child voices are hard** - higher fundamental frequencies, more harmonics, breathier tone
2. **Octave errors** - autocorrelation commonly detects octave above or below the true pitch
3. **No confidence score** - the app can't tell the difference between a confident detection and a guess
4. **Environmental noise** - a living room with TV, siblings, pets creates false positives

Paul singing "la la la" needs to reliably map to the right notes. One bad detection breaks the magic.

## The Three Methods

### 1. Autocorrelation (existing, improved)
- Time-domain method, good for monophonic signals
- Improve by adding parabolic interpolation at the correlation peak
- Strength: fast, low CPU
- Weakness: octave errors

### 2. YIN Algorithm
- Modified autocorrelation with cumulative mean normalized difference
- Reduces octave errors significantly compared to naive autocorrelation
- Strength: best balance of accuracy and speed for monophonic pitch
- Weakness: still struggles with very noisy signals

### 3. FFT Spectral Peak Detection
- Frequency-domain analysis using Web Audio's built-in `AnalyserNode.getFloatFrequencyData()`
- Find the dominant spectral peak, map to nearest note
- Strength: different failure mode than time-domain methods
- Weakness: frequency resolution limited by FFT size

## Voting & Confidence

```
For each detection frame:
  1. Run all 3 methods independently
  2. Convert each result to nearest MIDI note number
  3. If 2+ methods agree (within 1 semitone): HIGH confidence -> display note
  4. If only 1 method detects: LOW confidence -> show faded indicator
  5. If 0 methods detect: silence -> no display
```

### Confidence thresholds

| Confidence | Visual feedback | Triggers progress? |
|-----------|----------------|-------------------|
| HIGH (2-3 agree) | Full key highlight, note recorded | Yes |
| LOW (1 only) | Faded/ghost highlight | No |
| NONE | No highlight | No |

## Additional Improvements

### Adaptive noise gate
- Measure ambient noise level for 1 second when mic starts
- Set dynamic threshold at ambient + 6dB
- Prevents false detections from background noise

### Note stability filter
- A note must be detected for at least 80ms (2-3 consecutive frames) before being confirmed
- Prevents flickering between notes during transitions
- Short enough that Paul won't notice any lag

### Frequency range filter
- Child singing voice: roughly C3 (130 Hz) to C6 (1047 Hz)
- Filter out detections outside this range as noise
- Configurable per instrument type if we add instrument support later

## Consequences

- **CPU usage increases ~3x** for pitch detection, but still well within budget on any modern device
- **Latency stays under 100ms** which is imperceptible for visual feedback
- **Accuracy should improve from ~70% to ~90%+** for a child's voice based on literature
- **PitchEngine API stays the same** - callers still get `onNoteDetected(noteName, frequency)` but now also get a `confidence` field

## Alternatives Considered

- **ML-based detection (CREPE, SPICE)**: Best accuracy but requires loading a ~10MB model, too heavy for a simple web app. Could revisit if WebAssembly model loading becomes seamless.
- **Web Audio PitchDetector library**: External dependency, no more accurate than our ensemble approach, less educational to maintain.
- **Just improve autocorrelation**: Doesn't solve the fundamental problem of single-method brittleness.
