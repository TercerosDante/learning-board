import Dexie, { type Table } from 'dexie';
import type {
  Area, Topic, Item, Artifact, Session, Attempt,
  ReviewLogEntry, Capture, WeekPlan, MetricSnapshot, Settings,
} from '../domain/types';
import { CURRENT_SCHEMA_VERSION } from '../domain/backup';

export class LearningDb extends Dexie {
  areas!: Table<Area, string>;
  topics!: Table<Topic, string>;
  items!: Table<Item, string>;
  artifacts!: Table<Artifact, string>;
  sessions!: Table<Session, string>;
  attempts!: Table<Attempt, string>;
  reviewLog!: Table<ReviewLogEntry, string>;
  captures!: Table<Capture, string>;
  weekPlans!: Table<WeekPlan, string>;
  metricSnapshots!: Table<MetricSnapshot, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('learning-os');
    this.version(CURRENT_SCHEMA_VERSION).stores({
      areas: 'id, orderIndex, archived',
      topics: 'id, areaId',
      items: 'id, areaId, topicId, status, kind, *tags',
      artifacts: 'id, itemId, attemptId, type',
      sessions: 'id, startedAt, areaId, itemId',
      attempts: 'id, itemId, at',
      reviewLog: 'id, itemId, at',
      captures: 'id, at, status',
      weekPlans: 'id, weekStart',
      metricSnapshots: 'id, date, areaId',
      settings: 'id',
    });
  }
}

export const db = new LearningDb();

export async function ensureSettings(now = new Date()): Promise<Settings> {
  const existing = await db.settings.get('singleton');
  if (existing) return existing;
  const iso = now.toISOString();
  const settings: Settings = { id: 'singleton', schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: iso, updatedAt: iso };
  await db.settings.put(settings);
  return settings;
}
