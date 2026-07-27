import { useLiveQuery } from 'dexie-react-hooks';
import { backupReminderDue } from '../../domain/backup';
import { getSettings } from '../../data/queries';
import { exportBackup } from '../../services/backupService';
import { Button } from '@/components/ui/button';

export function BackupReminder() {
  const settings = useLiveQuery(getSettings);
  if (settings === undefined) return null; // still loading — ensureSettings guarantees the row exists
  if (!backupReminderDue(settings.lastExportAt, new Date())) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
      {settings.lastExportAt
        ? `Last backup was ${new Date(settings.lastExportAt).toLocaleDateString()} — time for a fresh export.`
        : 'No backup yet — your data lives only in this browser.'}{' '}
      <Button size="sm" variant="outline" onClick={() => void exportBackup()}>
        Export backup
      </Button>
    </div>
  );
}
