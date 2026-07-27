import { db } from './db';
import { activityDays, minutesInWeek, sessionMinutes, streakDays } from '../domain/consistency';
import { coverageOf, type CoverageCounts } from '../domain/coverage';
import { retentionOf, type RetentionCounts } from '../domain/retention';
import { dayKey, startOfWeek } from '../domain/time';
import type { Area, Capture, Item, Settings, Topic, WeekPlan } from '../domain/types';

export function listAreas(): Promise<Area[]> {
  return db.areas.filter((a) => !a.archived).sortBy('orderIndex');
}

export function listItemsForArea(areaId: string): Promise<Item[]> {
  return db.items.where('areaId').equals(areaId).sortBy('createdAt');
}

export function listTopicsForArea(areaId: string): Promise<Topic[]> {
  return db.topics.where('areaId').equals(areaId).sortBy('orderIndex');
}

export function itemsByIds(ids: string[]): Promise<Item[]> {
  return ids.length > 0 ? db.items.where('id').anyOf(ids).toArray() : Promise.resolve([]);
}

export function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('singleton');
}

export function inboxCaptures(): Promise<Capture[]> {
  return db.captures.where('status').equals('inbox').sortBy('at');
}

export async function currentWeekPlan(now = new Date()): Promise<WeekPlan | null> {
  const plan = await db.weekPlans.where('weekStart').equals(dayKey(startOfWeek(now))).first();
  return plan ?? null;
}

export interface AreaCoverage extends CoverageCounts {
  area: Area;
}

export async function coverageSummary(): Promise<AreaCoverage[]> {
  const areas = await listAreas();
  const result: AreaCoverage[] = [];
  for (const area of areas) {
    const items = await db.items.where('areaId').equals(area.id).toArray();
    result.push({ area, ...coverageOf(items) });
  }
  return result;
}

export interface ConsistencySummary {
  minutesThisWeek: number;
  targetMinutes: number;
  streak: number;
  perArea: { area: Area; minutes: number; targetMinutes?: number }[];
}

export async function consistencySummary(now = new Date()): Promise<ConsistencySummary> {
  const [areas, sessions, attempts, plan] = await Promise.all([
    listAreas(),
    db.sessions.toArray(),
    db.attempts.toArray(),
    currentWeekPlan(now),
  ]);
  const targetFor = (area: Area): number | undefined =>
    plan?.entries.find((e) => e.areaId === area.id)?.targetMinutes ?? area.weeklyTargetMinutes;
  const weekStart = startOfWeek(now);
  const weekSessions = sessions.filter((s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) <= now);
  const perArea = areas.map((area) => ({
    area,
    minutes: Math.round(
      weekSessions.filter((s) => s.areaId === area.id).reduce((sum, s) => sum + sessionMinutes(s, now), 0)
    ),
    targetMinutes: targetFor(area),
  }));
  return {
    minutesThisWeek: Math.round(minutesInWeek(sessions, now)),
    targetMinutes: areas.reduce((t, a) => t + (targetFor(a) ?? 0), 0),
    streak: streakDays(activityDays(sessions.map((s) => s.startedAt), attempts.map((a) => a.at)), dayKey(now)),
    perArea,
  };
}

export function dueItems(): Promise<Item[]> {
  return db.items.where('status').equals('needs-review').filter((i) => i.review.enabled).sortBy('updatedAt');
}

export interface RetentionSummary {
  global: RetentionCounts;
  perArea: { area: Area; counts: RetentionCounts }[];
}

export async function retentionSummary(): Promise<RetentionSummary> {
  const [areas, items] = await Promise.all([listAreas(), db.items.toArray()]);
  const activeItems = items.filter((i) => areas.some((a) => a.id === i.areaId));
  return {
    global: retentionOf(activeItems),
    perArea: areas.map((area) => ({ area, counts: retentionOf(items.filter((i) => i.areaId === area.id)) })),
  };
}

export async function focusItems(now = new Date()): Promise<Item[]> {
  const plan = await currentWeekPlan(now);
  if (!plan) return [];
  const areas = await listAreas();
  const ids = plan.entries
    .filter((e) => areas.some((a) => a.id === e.areaId))
    .flatMap((e) => e.focusItemIds);
  return itemsByIds(ids);
}
