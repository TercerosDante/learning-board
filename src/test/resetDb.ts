import { db } from '../data/db';

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
}
