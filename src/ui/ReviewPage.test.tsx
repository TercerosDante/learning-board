import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ReviewPage } from './routes/ReviewPage';
import { createArea } from '../services/areas';
import { captureNow } from '../services/captures';
import { createItem } from '../services/items';
import { db } from '../data/db';
import { ensureSettings } from '../data/db';
import { resetDb } from '../test/resetDb';
import { pickOption, setupUser } from '../test/ui';

describe('ReviewPage inbox', () => {
  beforeEach(resetDb);

  it('promotes a capture to a new item and dismisses another', async () => {
    const user = setupUser();
    const area = await createArea({ name: 'Algorithms', preset: 'practice' });
    const cap1 = await captureNow({ text: 'look into two pointers' });
    const cap2 = await captureNow({ text: 'noise' });
    render(<ReviewPage />);

    const row = (await screen.findByText('look into two pointers')).closest('li')!;
    await pickOption(user, within(row).getByLabelText('Area'), 'Algorithms');
    await user.click(within(row).getByRole('button', { name: 'New item' }));
    await waitFor(async () => {
      expect(await db.items.count()).toBe(1);
      expect((await db.items.toArray())[0].title).toBe('look into two pointers');
    });
    // After promotion, the first capture is triaged and item appears in status section
    await waitFor(async () => {
      expect((await db.captures.get(cap1.id))?.status).toBe('triaged');
    });

    const noiseRow = screen.getByText('noise').closest('li')!;
    await user.click(within(noiseRow).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('noise')).not.toBeInTheDocument());
  });

  it('shows an empty-inbox message when there is nothing to triage', async () => {
    render(<ReviewPage />);
    expect(await screen.findByText(/Inbox empty/)).toBeInTheDocument();
  });
});

describe('ReviewPage statuses and reminder', () => {
  beforeEach(resetDb);

  it('moves an item through the lifecycle manually', async () => {
    const user = setupUser();
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'CAP', kind: 'note' });
    render(<ReviewPage />);
    await pickOption(user, await screen.findByLabelText('Status of CAP'), 'learned');
    await waitFor(async () => expect((await db.items.get(item.id))?.status).toBe('learned'));
  });

  it('shows the backup reminder only when stale', async () => {
    await ensureSettings();
    await db.settings.update('singleton', { lastExportAt: new Date(2026, 0, 1).toISOString() });
    const first = render(<ReviewPage />);
    expect(await first.findByText(/time for a fresh export/)).toBeInTheDocument();
    first.unmount();
    await db.settings.update('singleton', { lastExportAt: new Date().toISOString() });
    render(<ReviewPage />);
    await screen.findByRole('heading', { name: /Inbox/ });
    expect(screen.queryByText(/time for a fresh export/)).not.toBeInTheDocument();
  });
});
