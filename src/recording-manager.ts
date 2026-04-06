/**
 * Recording Manager
 * Captures detected notes with timestamps and manages playback
 */

import { EventMap, NoteDetectedEvent, RecordedNote } from './types';
import { AudioManager } from './audio-manager';

type EventBusLike = {
  on<K extends keyof EventMap>(event: K, fn: (data: EventMap[K]) => void): void;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
};

export class RecordingManager {
  private readonly eventBus: EventBusLike | null;
  private readonly audioManager: AudioManager;
  public isRecording: boolean;
  private recordedNotes: RecordedNote[];
  private startTime: number;
  private silenceTimeout: ReturnType<typeof setTimeout> | null;
  private lastNoteTime: number;
  private readonly silenceDuration: number;

  // Playback state
  public isPlayingBack: boolean;
  private playbackStartTime: number;
  public playbackSpeed: number;

  constructor(eventBus: EventBusLike | null, audioManager: AudioManager) {
    this.eventBus     = eventBus;
    this.audioManager = audioManager;
    this.isRecording  = false;
    this.recordedNotes = [];
    this.startTime    = 0;
    this.silenceTimeout  = null;
    this.lastNoteTime    = 0;
    this.silenceDuration = 3000; // 3 seconds of silence to auto-stop

    this.isPlayingBack     = false;
    this.playbackStartTime = 0;
    this.playbackSpeed     = 1.0;

    // Listen for both mic detections and keyboard presses
    if (this.eventBus) {
      this.eventBus.on('note:detected', (data) => this.onNoteDetected(data));
      this.eventBus.on('note:played', (data) =>
        this.onNoteDetected({ ...data, frequency: 0, confidence: 1.0 })
      );
    }
  }

  startRecording(): void {
    if (this.isRecording) return;
    this.isRecording   = true;
    this.recordedNotes = [];
    this.startTime     = Date.now();
    this.lastNoteTime  = this.startTime;
    console.log('Recording started');

    if (this.eventBus) {
      this.eventBus.emit('recording:start', {});
    }
  }

  stopRecording(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.silenceTimeout !== null) clearTimeout(this.silenceTimeout);

    const duration = Date.now() - this.startTime;
    console.log(`Recording stopped: ${this.recordedNotes.length} notes, ${duration}ms`);

    if (this.eventBus) {
      this.eventBus.emit('recording:stop', {
        duration,
        noteCount: this.recordedNotes.length
      });
    }
  }

  onNoteDetected(data: NoteDetectedEvent): void {
    if (!this.isRecording) return;

    const { note, confidence, source } = data;

    // Only record high-confidence detections
    if (confidence < 0.7) return;

    const timestamp = Date.now() - this.startTime;
    this.recordedNotes.push({
      note,
      timestamp,
      duration: 0, // Will be updated when note ends
      confidence,
      source
    });

    this.lastNoteTime = Date.now();

    // Reset auto-stop timer
    if (this.silenceTimeout !== null) clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      this.stopRecording();
    }, this.silenceDuration);
  }

  getRecordedNotes(): RecordedNote[] {
    return [...this.recordedNotes];
  }

  getRecordingDuration(): number {
    if (this.isRecording) {
      return Date.now() - this.startTime;
    }
    return this.recordedNotes.length > 0
      ? this.recordedNotes[this.recordedNotes.length - 1].timestamp
      : 0;
  }

  async playRecording(): Promise<void> {
    if (this.isPlayingBack || this.recordedNotes.length === 0) return;

    this.isPlayingBack     = true;
    this.playbackStartTime = Date.now();

    if (this.eventBus) {
      this.eventBus.emit('playback:start', {});
    }

    for (let i = 0; i < this.recordedNotes.length; i++) {
      const note     = this.recordedNotes[i];
      const nextNote = this.recordedNotes[i + 1];

      // Calculate wait time until next note
      const waitTime = nextNote
        ? (nextNote.timestamp - note.timestamp) / this.playbackSpeed
        : 500;

      // Play the note
      this.audioManager.playSound(note.note);

      // Emit playback progress
      if (this.eventBus) {
        this.eventBus.emit('playback:tick', {
          currentTime: note.timestamp,
          totalTime: this.getRecordingDuration()
        });
      }

      // Wait for next note
      await new Promise<void>(r => setTimeout(r, waitTime));

      if (!this.isPlayingBack) break;
    }

    this.isPlayingBack = false;

    if (this.eventBus) {
      this.eventBus.emit('playback:end', {});
    }

    console.log('Playback finished');
  }

  pausePlayback(): void {
    this.isPlayingBack = false;
  }

  resumePlayback(): void {
    if (this.isPlayingBack) return;
    void this.playRecording();
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.5, Math.min(2.0, speed));
  }

  clear(): void {
    this.stopRecording();
    this.pausePlayback();
    this.recordedNotes = [];
    console.log('Recording cleared');
  }
}
