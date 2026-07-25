import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlanPage } from './routes/PlanPage';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';
import { pickOption, setupUser } from '../test/ui';

describe('PlanPage', () => {
  beforeEach(resetDb);

  it('creates an area, a topic, and an item; assigns topic and estimate', async () => {
    const user = setupUser();
    render(<PlanPage />);

    await user.type(screen.getByLabelText('Area name'), 'Algorithms');
    await pickOption(user, screen.getByLabelText('Preset'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add area' }));
    expect(await screen.findByRole('heading', { name: 'Algorithms' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New topic in Algorithms'), 'Patterns');
    await user.click(screen.getByRole('button', { name: 'Add topic' }));
    expect(await screen.findByRole('heading', { name: /Patterns/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText('New item in Algorithms'), 'Two pointers');
    await pickOption(user, screen.getByLabelText('Kind for Algorithms'), 'practice');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await screen.findByText('Two pointers');

    await user.type(screen.getByLabelText('Estimate for Two pointers'), '30');
    await user.tab();
    await pickOption(user, screen.getByLabelText('Topic for Two pointers'), 'Patterns');

    await waitFor(async () => {
      const item = (await db.items.toArray())[0];
      expect(item.topicId).toBeDefined();
      expect(item.estimateMinutes).toBe(30);
    });
  });

  it('Enter submits the area form', async () => {
    const user = setupUser();
    render(<PlanPage />);
    await user.type(screen.getByLabelText('Area name'), 'Quick{Enter}');
    expect(await screen.findByRole('heading', { name: 'Quick' })).toBeInTheDocument();
  });
});
