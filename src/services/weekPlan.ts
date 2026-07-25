import { db } from '../data/db';
import { dayKey, startOfWeek } from '../domain/time';
import type { WeekPlan } from '../domain/types';

export function weekStartKey(now = new Date()): string {
  return dayKey(startOfWeek(now));
}

export async function getOrCreateWeekPlan(now = new Date()): Promise<WeekPlan> {
  const weekStart = weekStartKey(now);
  const existing = await db.weekPlans.where('weekStart').equals(weekStart).first();
  if (existing) return existing;
  const areas = await db.areas.filter((a) => !a.archived).sortBy('orderIndex');
  const iso = now.toISOString();
  const plan: WeekPlan = {
    id: crypto.randomUUID(),
    weekStart,
    entries: areas.map((a) => ({ areaId: a.id, targetMinutes: a.weeklyTargetMinutes, focusItemIds: [] })),
    createdAt: iso,
    updatedAt: iso,
  };
  await db.weekPlans.add(plan);
  return plan;
}

export async function updateWeekPlanEntry(
  weekPlanId: string,
  areaId: string,
  patch: { targetMinutes?: number; focusItemIds?: string[] },
  now = new Date()
): Promise<void> {
  const plan = await db.weekPlans.get(weekPlanId);
  if (!plan) return;
  const entries = plan.entries.some((e) => e.areaId === areaId)
    ? plan.entries.map((e) => (e.areaId === areaId ? { ...e, ...patch } : e))
    : [...plan.entries, { areaId, focusItemIds: [], ...patch }];
  await db.weekPlans.update(weekPlanId, { entries, updatedAt: now.toISOString() });
}
