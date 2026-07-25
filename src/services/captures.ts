import { db } from '../data/db';
import { dayKey } from '../domain/time';
import type { Capture, ItemKind } from '../domain/types';
import { createItem, getNoteText, saveNote } from './items';
import { getActiveSession } from './sessions';

const TITLE_MAX = 80;

export async function captureNow(
  input: { text: string; url?: string; route?: string },
  now = new Date()
): Promise<Capture> {
  const active = await getActiveSession();
  const capture: Capture = {
    id: crypto.randomUUID(),
    text: input.text,
    url: input.url,
    at: now.toISOString(),
    context: {
      areaId: active?.areaId,
      itemId: active?.itemId,
      sessionId: active?.id,
      route: input.route,
    },
    status: 'inbox',
  };
  await db.captures.add(capture);
  return capture;
}

export async function triageToNewItem(
  captureId: string,
  target: { areaId: string; kind: ItemKind; title?: string },
  now = new Date()
): Promise<void> {
  const capture = await db.captures.get(captureId);
  if (!capture || capture.status !== 'inbox') return;
  const title = target.title?.trim() || capture.text.slice(0, TITLE_MAX);
  const item = await createItem({ areaId: target.areaId, title, kind: target.kind }, now);
  if (capture.text.length > TITLE_MAX || capture.url) {
    await saveNote(item.id, [capture.text, capture.url].filter(Boolean).join('\n\n'), now);
  }
  await db.captures.update(captureId, { status: 'triaged', triagedToItemId: item.id });
}

export async function attachToItem(captureId: string, itemId: string, now = new Date()): Promise<void> {
  const capture = await db.captures.get(captureId);
  const item = await db.items.get(itemId);
  if (!capture || capture.status !== 'inbox' || !item) return;
  const existing = await getNoteText(itemId);
  const stamp = dayKey(new Date(capture.at));
  const addition = `> [capture ${stamp}] ${capture.text}${capture.url ? `\n> ${capture.url}` : ''}`;
  await saveNote(itemId, existing ? `${existing}\n\n${addition}` : addition, now);
  await db.captures.update(captureId, { status: 'triaged', triagedToItemId: itemId });
}

export async function dismissCapture(captureId: string): Promise<void> {
  const capture = await db.captures.get(captureId);
  if (!capture || capture.status !== 'inbox') return;
  await db.captures.update(captureId, { status: 'dismissed' });
}
