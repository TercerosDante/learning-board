import { describe, it, expect } from 'vitest';
import { retentionOf } from './retention';
import type { ItemStatus } from './types';

const item = (status: ItemStatus, enabled = true) => ({ status, review: { enabled, intervalIndex: 0 } });

describe('retention', () => {
  it('counts review-enabled learned/mastered as fresh, needs-review as stale', () => {
    const r = retentionOf([
      item('untouched'), item('in-progress'),
      item('learned'), item('mastered'), item('needs-review'),
      item('needs-review', false), // review disabled: ignored
    ]);
    expect(r).toEqual({ fresh: 2, stale: 1, ratio: 2 / 3 });
  });

  it('is ratio 1 when nothing is tracked yet', () => {
    expect(retentionOf([item('untouched')])).toEqual({ fresh: 0, stale: 0, ratio: 1 });
  });
});
