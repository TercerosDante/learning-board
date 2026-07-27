import { describe, it, expect } from 'vitest';
import { coverageOf } from './coverage';
import type { ItemStatus } from './types';

describe('coverage', () => {
  it('counts learned, needs-review, and mastered as covered', () => {
    const items: { status: ItemStatus }[] = [
      { status: 'untouched' },
      { status: 'in-progress' },
      { status: 'learned' },
      { status: 'needs-review' },
      { status: 'mastered' },
    ];
    expect(coverageOf(items)).toEqual({ covered: 3, total: 5, ratio: 0.6 });
  });

  it('is 0/0 with ratio 0 for an empty area', () => {
    expect(coverageOf([])).toEqual({ covered: 0, total: 0, ratio: 0 });
  });
});
