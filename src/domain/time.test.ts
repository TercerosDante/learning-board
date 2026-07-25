import { describe, it, expect } from 'vitest';
import { dayKey, addDays, startOfWeek, minutesBetween } from './time';

describe('time', () => {
  it('dayKey formats local dates as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 6, 24, 23, 59))).toBe('2026-07-24');
    expect(dayKey(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });

  it('addDays does calendar arithmetic across month boundaries', () => {
    expect(addDays('2026-07-24', -1)).toBe('2026-07-23');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('startOfWeek returns local Monday 00:00', () => {
    const friday = new Date(2026, 6, 24, 20, 15); // Fri 2026-07-24
    const monday = startOfWeek(friday);
    expect(dayKey(monday)).toBe('2026-07-20');
    expect(monday.getHours()).toBe(0);
    // a Monday maps to itself
    expect(dayKey(startOfWeek(new Date(2026, 6, 20, 5, 0)))).toBe('2026-07-20');
  });

  it('minutesBetween is clamped at zero and fractional', () => {
    const a = new Date(2026, 6, 24, 10, 0).toISOString();
    const b = new Date(2026, 6, 24, 10, 45).toISOString();
    expect(minutesBetween(a, b)).toBe(45);
    expect(minutesBetween(b, a)).toBe(0);
  });
});
