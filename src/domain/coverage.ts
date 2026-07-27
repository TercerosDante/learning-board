import type { Item, ItemStatus } from './types';

export const COVERED_STATUSES: ReadonlySet<ItemStatus> = new Set(['learned', 'needs-review', 'mastered']);

export interface CoverageCounts {
  covered: number;
  total: number;
  ratio: number;
}

export function coverageOf(items: Pick<Item, 'status'>[]): CoverageCounts {
  const total = items.length;
  const covered = items.filter((i) => COVERED_STATUSES.has(i.status)).length;
  return { covered, total, ratio: total === 0 ? 0 : covered / total };
}
