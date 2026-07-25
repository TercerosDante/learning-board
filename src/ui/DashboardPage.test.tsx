import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './routes/DashboardPage';
import { createArea } from '../services/areas';
import { addManualSession } from '../services/sessions';
import { ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('DashboardPage', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureSettings();
  });

  it('shows weekly minutes, streak, and the export control', async () => {
    const area = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    await addManualSession({ areaId: area.id, minutes: 30 });
    render(<DashboardPage />);
    expect(await screen.findByText(/30 \/ 120 min this week/)).toBeInTheDocument();
    expect(screen.getByText(/Streak: 1 day/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });
});
