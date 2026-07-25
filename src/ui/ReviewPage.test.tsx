import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { ReviewPage } from './routes/ReviewPage';
import { createArea } from '../services/areas';
import { captureNow } from '../services/captures';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';
import { pickOption, setupUser } from '../test/ui';

describe('ReviewPage inbox', () => {
  beforeEach(resetDb);

  it('promotes a capture to a new item and dismisses another', async () => {
    const user = setupUser();
    await createArea({ name: 'Algorithms', preset: 'practice' });
    await captureNow({ text: 'look into two pointers' });
    await captureNow({ text: 'noise' });
    render(<ReviewPage />);

    const row = (await screen.findByText('look into two pointers')).closest('li')!;
    await pickOption(user, within(row).getByLabelText('Area'), 'Algorithms');
    await user.click(within(row).getByRole('button', { name: 'New item' }));
    await waitFor(async () => {
      expect(await db.items.count()).toBe(1);
      expect((await db.items.toArray())[0].title).toBe('look into two pointers');
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
