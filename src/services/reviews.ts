import { db } from '../data/db';
import { applyReview, isOverdue, type ReviewOutcome } from '../domain/srs';
import type { ReviewLogEntry } from '../domain/types';

export async function sweepDue(now = new Date()): Promise<number> {
  const candidates = await db.items.where('status').anyOf('learned', 'mastered').toArray();
  const due = candidates.filter((i) => isOverdue(i.review, now));
  const iso = now.toISOString();
  for (const item of due) {
    await db.items.update(item.id, { status: 'needs-review', updatedAt: iso });
  }
  return due.length;
}

export async function recordReview(itemId: string, outcome: ReviewOutcome, now = new Date()): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item || !item.review.enabled) return;
  const before = item.review.intervalIndex;
  const applied = applyReview(item, outcome, now);
  const iso = now.toISOString();
  await db.transaction('rw', [db.items, db.reviewLog], async () => {
    await db.items.update(itemId, { status: applied.status, review: applied.review, updatedAt: iso });
    const entry: ReviewLogEntry = {
      id: crypto.randomUUID(),
      itemId,
      at: iso,
      outcome,
      intervalIndexBefore: before,
      intervalIndexAfter: applied.review.intervalIndex,
      dueDateAfter: applied.review.dueDate!,
    };
    await db.reviewLog.add(entry);
  });
}
