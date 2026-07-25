import { addDays, dayKey, minutesBetween, startOfWeek } from './time';

/** If an active session's last tick is older than this, bill up to the last tick, not `now`. */
export const STALE_BILLING_GAP_MINUTES = 10;

export interface SessionLike {
  startedAt: string;
  endedAt: string | null;
  lastTickAt: string;
}

export function sessionMinutes(s: SessionLike, now: Date): number {
  if (s.endedAt === null && minutesBetween(s.lastTickAt, now.toISOString()) > STALE_BILLING_GAP_MINUTES) {
    return minutesBetween(s.startedAt, s.lastTickAt);
  }
  return minutesBetween(s.startedAt, s.endedAt ?? now.toISOString());
}

export function minutesInWeek(sessions: SessionLike[], now: Date): number {
  const weekStart = startOfWeek(now);
  return sessions
    .filter((s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) <= now)
    .reduce((sum, s) => sum + sessionMinutes(s, now), 0);
}

export function activityDays(sessionStarts: string[], attemptTimes: string[]): Set<string> {
  const days = new Set<string>();
  for (const t of sessionStarts) days.add(dayKey(new Date(t)));
  for (const t of attemptTimes) days.add(dayKey(new Date(t)));
  return days;
}

export function streakDays(days: Set<string>, todayKey: string): number {
  let cursor = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
