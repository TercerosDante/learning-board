import { describe, it, expect } from 'vitest';
import { BACKUP_FORMAT, CURRENT_SCHEMA_VERSION, TABLE_NAMES, buildBackup, validateBackup, backupReminderDue } from './backup';

function emptyTables() {
  return Object.fromEntries(TABLE_NAMES.map((n) => [n, [] as unknown[]])) as Record<(typeof TABLE_NAMES)[number], unknown[]>;
}

describe('backup format', () => {
  it('buildBackup stamps format, version, and time', () => {
    const b = buildBackup(emptyTables(), '2026-07-24T10:00:00.000Z');
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(b.exportedAt).toBe('2026-07-24T10:00:00.000Z');
  });

  it('round-trips through validateBackup', () => {
    const json = JSON.stringify(buildBackup(emptyTables(), '2026-07-24T10:00:00.000Z'));
    const v = validateBackup(JSON.parse(json));
    expect(v.ok).toBe(true);
  });

  it('rejects wrong format, newer version, and missing tables', () => {
    expect(validateBackup({ format: 'nope' }).ok).toBe(false);
    const newer = { ...buildBackup(emptyTables(), 'x'), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(validateBackup(newer).ok).toBe(false);
    const missing = buildBackup(emptyTables(), 'x') as unknown as { tables: Record<string, unknown> };
    delete missing.tables['sessions'];
    const v = validateBackup(missing);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join()).toContain('sessions');
  });

  it('rejects non-objects', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('hi').ok).toBe(false);
  });
});

describe('backupReminderDue', () => {
  const now = new Date(2026, 6, 25, 12, 0);

  it('is due when never exported', () => {
    expect(backupReminderDue(undefined, now)).toBe(true);
  });

  it('is due at/after the threshold and not before', () => {
    const fresh = new Date(2026, 6, 20, 12, 0).toISOString(); // 5 days ago
    const stale = new Date(2026, 6, 11, 12, 0).toISOString(); // exactly 14 days ago
    expect(backupReminderDue(fresh, now)).toBe(false);
    expect(backupReminderDue(stale, now)).toBe(true);
  });
});
