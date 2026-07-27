import { db } from '../data/db';
import { coverageOf } from '../domain/coverage';
import { retentionOf } from '../domain/retention';
import { minutesInWeek } from '../domain/consistency';
import { dayKey } from '../domain/time';
import type { MetricSnapshot } from '../domain/types';

export async function snapshotToday(now = new Date()): Promise<boolean> {
  const date = dayKey(now);
  if ((await db.metricSnapshots.where('date').equals(date).count()) > 0) return false;
  const [areas, items, sessions] = await Promise.all([
    db.areas.filter((a) => !a.archived).toArray(),
    db.items.toArray(),
    db.sessions.toArray(),
  ]);
  const activeItems = items.filter((i) => areas.some((a) => a.id === i.areaId));
  const rows: MetricSnapshot[] = [
    {
      id: crypto.randomUUID(),
      date,
      coverage: coverageOf(activeItems).ratio,
      retention: retentionOf(activeItems).ratio,
      minutes: Math.round(minutesInWeek(sessions, now)),
    },
    ...areas.map((area) => {
      const areaItems = items.filter((i) => i.areaId === area.id);
      return {
        id: crypto.randomUUID(),
        date,
        areaId: area.id,
        coverage: coverageOf(areaItems).ratio,
        retention: retentionOf(areaItems).ratio,
        minutes: Math.round(minutesInWeek(sessions.filter((s) => s.areaId === area.id), now)),
      };
    }),
  ];
  await db.metricSnapshots.bulkAdd(rows);
  return true;
}
