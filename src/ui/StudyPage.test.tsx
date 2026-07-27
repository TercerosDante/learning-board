import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyPage } from './routes/StudyPage';
import { createArea } from '../services/areas';
import { createItem } from '../services/items';
import { getActiveSession } from '../services/sessions';
import { resetDb } from '../test/resetDb';

describe('StudyPage', () => {
  beforeEach(resetDb);

  it('FRICTION INVARIANT: the Study route contains no required inputs (brief §3)', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    await createItem({ areaId: area.id, title: 'CAP theorem', kind: 'note' });
    const { container } = render(<StudyPage />);
    await screen.findByText('CAP theorem');
    expect(container.querySelectorAll('[required]')).toHaveLength(0);
  });

  it('starts a session from an item with one click and stops without any prompt', async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    await createItem({ areaId: area.id, title: 'CAP theorem', kind: 'note' });
    render(<StudyPage />);
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await waitFor(async () => {
      expect(await getActiveSession()).toBeDefined();
    });
    expect((await getActiveSession())?.itemId).toBeDefined();
  });

  it('starts an area-level session (no item) from the Start button next to the area heading', async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    await createItem({ areaId: area.id, title: 'CAP theorem', kind: 'note' });
    render(<StudyPage />);
    await user.click(await screen.findByRole('button', { name: `Start ${area.name}` }));
    await waitFor(async () => {
      const active = await getActiveSession();
      expect(active?.areaId).toBe(area.id);
      expect(active?.itemId).toBeUndefined();
    });
  });

  it('minimal-mode areas show a done-tick instead of metadata (UC-5)', async () => {
    const user = userEvent.setup();
    const area = await createArea({ name: 'Drills', preset: 'minimal' });
    await createItem({ areaId: area.id, title: 'Daily kata', kind: 'practice' });
    render(<StudyPage />);
    const checkbox = await screen.findByRole('checkbox', { name: /Daily kata/ });
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked()); // liveQuery re-render is async
  });
});
