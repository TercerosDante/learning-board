import { describe, it, expect } from 'vitest';
import { applyReview, initialReviewClock, isOverdue, SRS_INTERVALS_DAYS, TOP_RUNG } from './srs';
import type { ReviewState } from './types';

const review = (over: Partial<ReviewState> = {}): ReviewState => ({ enabled: true, intervalIndex: 0, ...over });
const now = new Date(2026, 6, 27, 12, 0); // local noon, 2026-07-27

describe('srs', () => {
  it('initialReviewClock starts at rung 0, due tomorrow', () => {
    const r = initialReviewClock(review(), now);
    expect(r.intervalIndex).toBe(0);
    expect(r.dueDate).toBe('2026-07-28');
  });

  it('isOverdue: due today or earlier, only when enabled with a dueDate', () => {
    expect(isOverdue(review({ dueDate: '2026-07-27' }), now)).toBe(true);
    expect(isOverdue(review({ dueDate: '2026-07-28' }), now)).toBe(false);
    expect(isOverdue(review({ enabled: false, dueDate: '2026-07-01' }), now)).toBe(false);
    expect(isOverdue(review(), now)).toBe(false);
  });

  it('pass climbs one rung and schedules the new interval', () => {
    const a = applyReview({ status: 'needs-review', review: review({ intervalIndex: 1 }) }, 'pass', now);
    expect(a.status).toBe('learned');
    expect(a.review.intervalIndex).toBe(2);
    expect(a.review.dueDate).toBe('2026-08-03'); // +7
    expect(a.review.lastOutcome).toBe('pass');
  });

  it('fail resets to rung 0 and forces needs-review', () => {
    const a = applyReview({ status: 'mastered', review: review({ intervalIndex: TOP_RUNG }) }, 'fail', now);
    expect(a.status).toBe('needs-review');
    expect(a.review.intervalIndex).toBe(0);
    expect(a.review.dueDate).toBe('2026-07-28');
  });

  it('passing AT the top rung masters and repeats the top interval', () => {
    const a = applyReview({ status: 'learned', review: review({ intervalIndex: TOP_RUNG }) }, 'pass', now);
    expect(a.status).toBe('mastered');
    expect(a.review.intervalIndex).toBe(TOP_RUNG);
    expect(a.review.dueDate).toBe('2026-11-24'); // +120
  });

  it('the ladder is the documented one', () => {
    expect([...SRS_INTERVALS_DAYS]).toEqual([1, 3, 7, 14, 30, 60, 120]);
  });
});
