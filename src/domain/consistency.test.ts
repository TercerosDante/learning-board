import { describe, it, expect } from 'vitest';
import { sessionMinutes, minutesInWeek, activityDays, streakDays } from './consistency';

const iso = (y: number, mo: number, d: number, h = 12, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe('consistency', () => {
  const now = new Date(2026, 6, 24, 20, 0); // Friday evening

  it('sessionMinutes uses now for the still-active session', () => {
    expect(
      sessionMinutes(
        { startedAt: iso(2026, 7, 24, 10, 0), endedAt: iso(2026, 7, 24, 10, 30), lastTickAt: iso(2026, 7, 24, 10, 30) },
        now
      )
    ).toBe(30);
    expect(
      // lastTickAt is fresh (5 min before `now`), so it's still within STALE_BILLING_GAP_MINUTES
      // and billing runs up to `now`, not lastTickAt.
      sessionMinutes({ startedAt: iso(2026, 7, 24, 19, 40), endedAt: null, lastTickAt: iso(2026, 7, 24, 19, 55) }, now)
    ).toBe(20);
  });

  it('sessionMinutes clamps phantom time: an active session whose lastTickAt is stale bills only up to lastTickAt', () => {
    // active session started at 19:00, last ticked at 19:05 (55 min ago relative to `now` = 20:00)
    const startedAt = iso(2026, 7, 24, 19, 0);
    const lastTickAt = iso(2026, 7, 24, 19, 5);
    expect(sessionMinutes({ startedAt, endedAt: null, lastTickAt }, now)).toBe(5);
  });

  it('minutesInWeek counts sessions started this week, including the active one', () => {
    const sessions = [
      { startedAt: iso(2026, 7, 22, 9, 0), endedAt: iso(2026, 7, 22, 9, 30), lastTickAt: iso(2026, 7, 22, 9, 30) },  // Wed: 30
      { startedAt: iso(2026, 7, 19, 9, 0), endedAt: iso(2026, 7, 19, 10, 0), lastTickAt: iso(2026, 7, 19, 10, 0) },  // previous Sun: excluded
      { startedAt: iso(2026, 7, 24, 19, 40), endedAt: null, lastTickAt: iso(2026, 7, 24, 19, 55) },                    // active: 20 (fresh tick)
    ];
    expect(minutesInWeek(sessions, now)).toBe(50);
  });

  it('activityDays unions session and attempt days', () => {
    const days = activityDays([iso(2026, 7, 22)], [iso(2026, 7, 23), iso(2026, 7, 22)]);
    expect(days).toEqual(new Set(['2026-07-22', '2026-07-23']));
  });

  it('streakDays counts back from today, or yesterday if today is empty', () => {
    const days = new Set(['2026-07-22', '2026-07-23', '2026-07-24']);
    expect(streakDays(days, '2026-07-24')).toBe(3);
    // today not yet active: streak not broken yet
    expect(streakDays(new Set(['2026-07-22', '2026-07-23']), '2026-07-24')).toBe(2);
    // gap yesterday: streak is 0
    expect(streakDays(new Set(['2026-07-20']), '2026-07-24')).toBe(0);
  });
});
