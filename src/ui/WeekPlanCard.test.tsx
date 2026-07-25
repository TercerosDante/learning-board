import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WeekPlanCard } from './components/WeekPlanCard';
import { createArea } from '../services/areas';
import { createItem } from '../services/items';
import { consistencySummary } from '../data/queries';
import { resetDb } from '../test/resetDb';
import { setupUser } from '../test/ui';

describe('WeekPlanCard', () => {
  beforeEach(resetDb);

  it('sets up the week, overrides a target, and picks a focus item', async () => {
    const user = setupUser();
    const a = await createArea({ name: 'A', preset: 'practice', weeklyTargetMinutes: 120 });
    await createItem({ areaId: a.id, title: 'Two pointers', kind: 'practice' });
    render(<WeekPlanCard />);

    await user.click(await screen.findByRole('button', { name: 'Set up this week' }));
    const target = await screen.findByLabelText('Week target for A');
    await user.clear(target);
    await user.type(target, '90');
    await user.tab();
    await waitFor(async () => expect((await consistencySummary()).targetMinutes).toBe(90));

    await user.click(screen.getByText(/Focus items/));
    await user.click(screen.getByRole('checkbox', { name: 'Two pointers' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Two pointers' })).toBeChecked()
    ); // liveQuery re-render is async
    expect((await consistencySummary()).targetMinutes).toBe(90); // unchanged by focus toggle
  });
});
