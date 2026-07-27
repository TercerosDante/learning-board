import { addDays, dayKey } from './time';
import type { Item, ItemStatus, ReviewState } from './types';

export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
export const TOP_RUNG = SRS_INTERVALS_DAYS.length - 1;

export type ReviewOutcome = 'pass' | 'fail';

export function initialReviewClock(review: ReviewState, now: Date): ReviewState {
  return { ...review, intervalIndex: 0, dueDate: addDays(dayKey(now), SRS_INTERVALS_DAYS[0]), lastOutcome: undefined };
}

export function isOverdue(review: ReviewState, now: Date): boolean {
  return review.enabled && review.dueDate !== undefined && review.dueDate <= dayKey(now);
}

export function applyReview(
  item: Pick<Item, 'status' | 'review'>,
  outcome: ReviewOutcome,
  now: Date
): { review: ReviewState; status: ItemStatus } {
  const today = dayKey(now);
  if (outcome === 'fail') {
    return {
      status: 'needs-review',
      review: { ...item.review, intervalIndex: 0, dueDate: addDays(today, SRS_INTERVALS_DAYS[0]), lastOutcome: 'fail' },
    };
  }
  const atTop = item.review.intervalIndex >= TOP_RUNG;
  const nextIndex = Math.min(item.review.intervalIndex + 1, TOP_RUNG);
  return {
    status: atTop ? 'mastered' : 'learned',
    review: { ...item.review, intervalIndex: nextIndex, dueDate: addDays(today, SRS_INTERVALS_DAYS[nextIndex]), lastOutcome: 'pass' },
  };
}
