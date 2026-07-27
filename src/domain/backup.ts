export const BACKUP_FORMAT = 'learning-os-backup';
export const CURRENT_SCHEMA_VERSION = 1;

export const TABLE_NAMES = [
  'areas',
  'topics',
  'items',
  'artifacts',
  'sessions',
  'attempts',
  'reviewLog',
  'captures',
  'weekPlans',
  'metricSnapshots',
  'settings',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export function buildBackup(tables: Record<TableName, unknown[]>, exportedAt: string): BackupFile {
  return { format: BACKUP_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, tables };
}

export type ValidateResult = { ok: true; backup: BackupFile } | { ok: false; errors: string[] };

export function validateBackup(data: unknown): ValidateResult {
  if (typeof data !== 'object' || data === null) return { ok: false, errors: ['backup must be a JSON object'] };
  const d = data as Record<string, unknown>;
  const errors: string[] = [];
  if (d.format !== BACKUP_FORMAT) errors.push(`format must be "${BACKUP_FORMAT}"`);
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion < 1) {
    errors.push('schemaVersion must be a number >= 1');
  } else if (d.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`backup schemaVersion ${d.schemaVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION})`);
  }
  const tables = d.tables;
  if (typeof tables !== 'object' || tables === null) {
    errors.push('tables is missing');
  } else {
    for (const name of TABLE_NAMES) {
      if (!Array.isArray((tables as Record<string, unknown>)[name])) errors.push(`tables.${name} must be an array`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, backup: d as unknown as BackupFile };
}

export const BACKUP_REMINDER_DAYS = 14;

export function backupReminderDue(lastExportAt: string | undefined, now: Date): boolean {
  if (!lastExportAt) return true;
  return (now.getTime() - new Date(lastExportAt).getTime()) / 86_400_000 >= BACKUP_REMINDER_DAYS;
}
