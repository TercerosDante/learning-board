export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function startOfWeek(d: Date): Date {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayOffset = (dt.getDay() + 6) % 7; // Monday=0 … Sunday=6
  dt.setDate(dt.getDate() - mondayOffset);
  return dt;
}

export function minutesBetween(aIso: string, bIso: string): number {
  return Math.max(0, (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}
