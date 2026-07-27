import { db } from '../data/db';
import { AREA_PRESETS, type Area, type AreaPreset } from '../domain/types';

export async function createArea(
  input: { name: string; preset: AreaPreset; color?: string; weeklyTargetMinutes?: number },
  now = new Date()
): Promise<Area> {
  const iso = now.toISOString();
  const count = await db.areas.count();
  const area: Area = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color ?? '#4a6fa5',
    orderIndex: count,
    archived: false,
    weeklyTargetMinutes: input.weeklyTargetMinutes,
    profile: { ...AREA_PRESETS[input.preset] },
    createdAt: iso,
    updatedAt: iso,
  };
  await db.areas.add(area);
  return area;
}

export async function updateArea(
  id: string,
  patch: Partial<Pick<Area, 'name' | 'color' | 'weeklyTargetMinutes' | 'profile' | 'orderIndex'>>,
  now = new Date()
): Promise<void> {
  await db.areas.update(id, { ...patch, updatedAt: now.toISOString() });
}

export async function archiveArea(id: string, now = new Date()): Promise<void> {
  await db.areas.update(id, { archived: true, updatedAt: now.toISOString() });
}
