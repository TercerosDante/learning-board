import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings } from '../../data/queries';
import { exportBackup, importBackup } from '../../services/backupService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function BackupPanel() {
  const settings = useLiveQuery(getSettings);
  const [errors, setErrors] = useState<string[]>([]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const proceed = window.confirm(
      'Importing replaces ALL current data. A backup of the current data downloads first. Continue?'
    );
    if (!proceed) return;
    try {
      const result = await importBackup(await file.text());
      setErrors(result.ok ? [] : result.errors);
    } catch (e) {
      setErrors(['import failed: ' + String(e)]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Backup</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          {settings?.lastExportAt
            ? `Last export: ${new Date(settings.lastExportAt).toLocaleString()}`
            : 'Never exported — your data lives only in this browser.'}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={() => void exportBackup()}>Export backup</Button>
          <label className="text-sm">
            Import backup{' '}
            <input type="file" accept="application/json" onChange={(e) => void onImport(e.target.files?.[0])} />
          </label>
        </div>
        {errors.map((e) => (
          <p key={e} className="text-sm text-red-700">{e}</p>
        ))}
      </CardContent>
    </Card>
  );
}
