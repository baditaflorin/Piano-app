export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type NoteSource = 'mic' | 'keyboard' | 'playback';

export interface SongNote {
  note: string;
  duration: NoteDuration;
}

export interface Song {
  id: string;
  title: string;
  emoji: string;
  difficulty: 1 | 2 | 3;
  category: string;
  bpm: number;
  timeSignature?: string;
  notes: SongNote[];
}

export interface NoteDetectedEvent {
  note: string;
  frequency: number;
  confidence: number;
  source: NoteSource;
}

export interface NoteDownEvent {
  note: string;
  source: NoteSource;
  time: number;
}

export interface NoteUpEvent {
  note: string;
  source: NoteSource;
  time: number;
}

export interface RecordedNote {
  note: string;
  timestamp: number;
  duration: number;
  confidence: number;
  source: NoteSource;
}

export type EventMap = {
  'mic:toggle': Record<string, never>;
  'note:detected': NoteDetectedEvent;
  'note:played': { note: string; source: NoteSource };
  'note:down': NoteDownEvent;
  'note:up': NoteUpEvent;
  'song:selected': { songId: string };
  'song:step': { step: number; playedSteps: number[] };
  'volume:changed': { volume: number };
  'playback:request': Record<string, never>;
  'home:clicked': Record<string, never>;
  'recording:start': Record<string, never>;
  'recording:stop': { duration: number; noteCount: number };
  'playback:start': Record<string, never>;
  'playback:end': Record<string, never>;
  'playback:tick': { currentTime: number; totalTime: number };
};
