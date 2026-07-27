import type { Item, ItemStatus } from './types';

const TRACKED: ReadonlySet<ItemStatus> = new Set(['learned', 'needs-review', 'mastered']);

export interface RetentionCounts {
  fresh: number;
  stale: number;
  ratio: number;
}

export function retentionOf(items: Pick<Item, 'status' | 'review'>[]): RetentionCounts {
  const tracked = items.filter((i) => i.review.enabled && TRACKED.has(i.status));
  const stale = tracked.filter((i) => i.status === 'needs-review').length;
  const fresh = tracked.length - stale;
  return { fresh, stale, ratio: tracked.length === 0 ? 1 : fresh / tracked.length };
}
