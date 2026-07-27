import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('QuickCapture', () => {
  beforeEach(resetDb);

  it('captures a thought from anywhere, stamping the route', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/plan');
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Capture/ }));
    await user.type(screen.getByLabelText('Quick capture'), 'stray thought');
    await user.click(screen.getByRole('button', { name: 'Save to inbox' }));
    await waitFor(async () => {
      const captures = await db.captures.toArray();
      expect(captures).toHaveLength(1);
      expect(captures[0].text).toBe('stray thought');
      expect(captures[0].context.route).toBe('/plan');
      expect(captures[0].status).toBe('inbox');
    });
  });

  it('APP-LEVEL FRICTION INVARIANT: /study has no required inputs, capture included (brief §3)', async () => {
    window.history.pushState({}, '', '/study');
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Study' });
    expect(container.querySelectorAll('[required]')).toHaveLength(0);
  });
});
