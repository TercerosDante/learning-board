import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { exportBackup, importBackup } from '../../services/backupService';

export function BackupPanel() {
  const settings = useLiveQuery(() => db.settings.get('singleton'));
  const [errors, setErrors] = useState<string[]>([]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const proceed = window.confirm(
      'Importing replaces ALL current data. A backup of the current data downloads first. Continue?'
    );
    if (!proceed) return;
    const result = await importBackup(await file.text());
    setErrors(result.ok ? [] : result.errors);
  };

  return (
    <section className="card">
      <h3>Backup</h3>
      <p>
        {settings?.lastExportAt
          ? `Last export: ${new Date(settings.lastExportAt).toLocaleString()}`
          : 'Never exported — your data lives only in this browser.'}
      </p>
      <button onClick={() => void exportBackup()}>Export backup</button>{' '}
      <label>
        Import backup{' '}
        <input type="file" accept="application/json" onChange={(e) => void onImport(e.target.files?.[0])} />
      </label>
      {errors.map((e) => (
        <p key={e} className="error">{e}</p>
      ))}
    </section>
  );
}
