import { describe, it, expect, beforeEach } from 'vitest';
import { db, ensureSettings } from './db';
import { TABLE_NAMES, CURRENT_SCHEMA_VERSION } from '../domain/backup';
import { resetDb } from '../test/resetDb';

describe('db', () => {
  beforeEach(resetDb);

  it('has exactly the tables named in the backup format', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
  });

  it('uses the single source of truth for the schema version', () => {
    expect(db.verno).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('ensureSettings creates the singleton once and is idempotent', async () => {
    const a = await ensureSettings(new Date(2026, 6, 24));
    const b = await ensureSettings();
    expect(a.id).toBe('singleton');
    expect(a.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(b.createdAt).toBe(a.createdAt);
    expect(await db.settings.count()).toBe(1);
  });
});
