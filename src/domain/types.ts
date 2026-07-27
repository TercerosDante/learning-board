export type Id = string;

export type AreaPreset = 'conceptual' | 'practice' | 'project' | 'time-only' | 'minimal';

export interface AreaProfile {
  srsDefaultOn: boolean;
  attempts: boolean;
  timedExercises: boolean;
  canvas: boolean;
  video: boolean;
  minimalMode: boolean;
}

export const AREA_PRESETS: Record<AreaPreset, AreaProfile> = {
  conceptual: { srsDefaultOn: true, attempts: false, timedExercises: true, canvas: true, video: true, minimalMode: false },
  practice: { srsDefaultOn: true, attempts: true, timedExercises: true, canvas: false, video: false, minimalMode: false },
  project: { srsDefaultOn: false, attempts: false, timedExercises: false, canvas: true, video: false, minimalMode: false },
  'time-only': { srsDefaultOn: false, attempts: false, timedExercises: false, canvas: false, video: true, minimalMode: false },
  minimal: { srsDefaultOn: false, attempts: true, timedExercises: false, canvas: false, video: false, minimalMode: true },
};

export interface Area {
  id: Id;
  name: string;
  color: string;
  orderIndex: number;
  archived: boolean;
  weeklyTargetMinutes?: number;
  profile: AreaProfile;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: Id;
  areaId: Id;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type ItemKind = 'note' | 'practice' | 'project' | 'reading';
export type ItemStatus = 'untouched' | 'in-progress' | 'learned' | 'needs-review' | 'mastered';

export interface ReviewState {
  enabled: boolean;
  intervalIndex: number;
  dueDate?: string;
  lastOutcome?: 'pass' | 'fail';
}

export interface Item {
  id: Id;
  areaId: Id;
  topicId?: Id;
  title: string;
  kind: ItemKind;
  status: ItemStatus;
  tags: string[];
  estimateMinutes?: number;
  keyIdea?: string;
  exerciseConfig?: { targetMinutes: number };
  externalLinks?: string[];
  review: ReviewState;
  createdAt: string;
  updatedAt: string;
}

export type ArtifactType = 'markdown' | 'canvas' | 'video' | 'link' | 'checklist';

export interface Artifact {
  id: Id;
  itemId: Id;
  attemptId?: Id;
  type: ArtifactType;
  role?: string;
  payload: unknown;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: Id;
  areaId?: Id;
  itemId?: Id;
  startedAt: string;
  endedAt: string | null;
  lastTickAt: string;
  source: 'timer' | 'manual';
  note?: string;
  edited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttemptResult = 'pass' | 'passWithHelp' | 'fail';

export interface Attempt {
  id: Id;
  itemId: Id;
  at: string;
  result: AttemptResult;
  durationSec?: number;
  plannedDurationSec?: number;
  note?: string;
  createdAt: string;
}

export interface ReviewLogEntry {
  id: Id;
  itemId: Id;
  at: string;
  outcome: 'pass' | 'fail';
  intervalIndexBefore: number;
  intervalIndexAfter: number;
  dueDateAfter: string;
  sourceAttemptId?: Id;
}

export interface Capture {
  id: Id;
  text: string;
  url?: string;
  at: string;
  context: { areaId?: Id; itemId?: Id; sessionId?: Id; route?: string };
  status: 'inbox' | 'triaged' | 'dismissed';
  triagedToItemId?: Id;
}

export interface WeekPlan {
  id: Id;
  weekStart: string;
  entries: { areaId: Id; targetMinutes?: number; focusItemIds: Id[] }[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSnapshot {
  id: Id;
  date: string;
  areaId?: Id;
  coverage: number;
  retention: number;
  minutes: number;
}

export interface Settings {
  id: 'singleton';
  schemaVersion: number;
  lastExportAt?: string;
  createdAt: string;
  updatedAt: string;
}
