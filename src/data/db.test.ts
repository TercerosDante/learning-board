import { describe, it, expect, beforeEach } from 'vitest';
import { db, ensureSettings } from './db';
import { TABLE_NAMES } from '../domain/backup';
import { resetDb } from '../test/resetDb';

describe('db', () => {
  beforeEach(resetDb);

  it('has exactly the tables named in the backup format', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
  });

  it('ensureSettings creates the singleton once and is idempotent', async () => {
    const a = await ensureSettings(new Date(2026, 6, 24));
    const b = await ensureSettings();
    expect(a.id).toBe('singleton');
    expect(a.schemaVersion).toBe(1);
    expect(b.createdAt).toBe(a.createdAt);
    expect(await db.settings.count()).toBe(1);
  });
});
