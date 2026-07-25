import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from './routes/DashboardPage';
import { createArea } from '../services/areas';
import { addManualSession } from '../services/sessions';
import { ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';
import { startOfWeek } from '../domain/time';

describe('DashboardPage', () => {
  beforeEach(async () => {
    await resetDb();
    await ensureSettings();
  });

  it('shows weekly minutes, streak, and the export control', async () => {
    const area = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    // The component reads the real clock, so the session must be created AT the real `now`
    // (not backdated), matching what consistencySummary() will compute. addManualSession
    // backdates startedAt by `minutes`, which could push it before startOfWeek(now) in the
    // narrow sliver just after Monday 00:00 — guard against that week-boundary flake by
    // using a 1-minute session in that sliver instead of the usual 30.
    const now = new Date();
    const nearWeekStart = now.getTime() - startOfWeek(now).getTime() < 30 * 60_000;
    const minutes = nearWeekStart ? 1 : 30;
    await addManualSession({ areaId: area.id, minutes }, now);
    render(<DashboardPage />);
    const expected = nearWeekStart ? /1 \/ 120 min this week/ : /30 \/ 120 min this week/;
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByText(/Streak: 1 day/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeInTheDocument();
  });
});
