import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanPage } from './routes/PlanPage';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('PlanPage', () => {
  beforeEach(resetDb);

  it('creates an area with a preset, then an item inside it', async () => {
    const user = userEvent.setup();
    render(<PlanPage />);

    await user.type(screen.getByLabelText('Area name'), 'Algorithms');
    await user.selectOptions(screen.getByLabelText('Preset'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add area' }));
    expect(await screen.findByRole('heading', { name: 'Algorithms' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New item title'), 'Two pointers');
    await user.selectOptions(screen.getByLabelText('Kind'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Two pointers')).toBeInTheDocument();

    const area = (await db.areas.toArray())[0];
    expect(area.profile.attempts).toBe(true); // practice preset applied
    expect(await db.items.count()).toBe(1);
  });
});
