import { describe, it, expect, beforeEach } from 'vitest';
import { exportBackup, importBackup } from './backupService';
import { createArea } from './areas';
import { createItem } from './items';
import { db, ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';
import { TABLE_NAMES, type TableName } from '../domain/backup';

describe('backup service', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureSettings();
  });

  it('exportBackup saves a valid file and stamps lastExportAt', async () => {
    await createArea({ name: 'A', preset: 'conceptual' });
    const saved: string[] = [];
    await exportBackup((name, json) => saved.push(name, json), new Date(2026, 6, 24));
    expect(saved[0]).toBe('learning-os-backup-2026-07-24.json');
    const parsed = JSON.parse(saved[1]);
    expect(parsed.format).toBe('learning-os-backup');
    expect(parsed.tables.areas).toHaveLength(1);
    expect((await db.settings.get('singleton'))?.lastExportAt).toBeDefined();
  });

  it('importBackup replaces all data, auto-exporting current state first', async () => {
    const area = await createArea({ name: 'Old', preset: 'practice' });
    await createItem({ areaId: area.id, title: 'Old item', kind: 'practice' });
    // build a backup representing a DIFFERENT state
    const foreign: string[] = [];
    await exportBackup((_n, json) => foreign.push(json));
    await createArea({ name: 'Extra (will vanish on import)', preset: 'minimal' });

    const safety: { name: string; json: string }[] = [];
    const result = await importBackup(foreign[0], (name, json) => safety.push({ name, json }));
    expect(result.ok).toBe(true);
    expect(safety).toHaveLength(1); // pre-import auto-backup happened
    expect(safety[0].json).toContain('Extra (will vanish on import)'); // safety backup contains pre-import state
    expect(await db.areas.count()).toBe(1); // 'Extra' gone, snapshot restored
    expect(await db.items.count()).toBe(1);
  });

  it('importBackup rejects invalid files without touching data', async () => {
    await createArea({ name: 'Keep me', preset: 'conceptual' });
    const before = await db.areas.count();
    expect((await importBackup('not json', () => {})).ok).toBe(false);
    expect((await importBackup('{"format":"wrong"}', () => {})).ok).toBe(false);
    expect(await db.areas.count()).toBe(before);
  });

  it('importBackup rejects a valid envelope with a malformed row and leaves existing data untouched', async () => {
    const area = await createArea({ name: 'Keep me', preset: 'conceptual' });
    const before = await db.areas.count();
    const tables = {} as Record<TableName, unknown[]>;
    for (const n of TABLE_NAMES) tables[n] = [];
    tables.areas = [{ notAnId: true }]; // valid array, but rows don't satisfy the Area shape / primary key
    const backup = {
      format: 'learning-os-backup',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tables,
    };
    const result = await importBackup(JSON.stringify(backup), () => {});
    expect(result.ok).toBe(false);
    expect(await db.areas.count()).toBe(before);
    expect((await db.areas.get(area.id))?.name).toBe('Keep me');
  });
});
