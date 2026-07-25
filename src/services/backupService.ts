import { db } from '../data/db';
import { buildBackup, validateBackup, TABLE_NAMES, type BackupFile } from '../domain/backup';
import { dayKey } from '../domain/time';
import { downloadJson, type SaveFn } from './download';

export async function exportBackup(save: SaveFn = downloadJson, now = new Date()): Promise<void> {
  const tables = {} as BackupFile['tables'];
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray();
  }
  const backup = buildBackup(tables, now.toISOString());
  save(`learning-os-backup-${dayKey(now)}.json`, JSON.stringify(backup, null, 2));
  await db.settings.update('singleton', { lastExportAt: now.toISOString(), updatedAt: now.toISOString() });
}

export type ImportResult = { ok: true } | { ok: false; errors: string[] };

export async function importBackup(json: string, save: SaveFn = downloadJson, now = new Date()): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['file is not valid JSON'] };
  }
  const v = validateBackup(parsed);
  if (!v.ok) return v;
  await exportBackup(save, now); // §9 safety net: current state saved before replace
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    for (const name of TABLE_NAMES) {
      const rows = v.backup.tables[name];
      if (rows.length > 0) await db.table(name).bulkAdd(rows as never[]);
    }
  });
  return { ok: true };
}
