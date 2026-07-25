import { describe, it, expect, beforeEach } from 'vitest';
import { attachToItem, captureNow, dismissCapture, triageToNewItem } from './captures';
import { createArea } from './areas';
import { createItem, getNoteText, saveNote } from './items';
import { startSession, stopSession } from './sessions';
import { db } from '../data/db';
import { resetDb } from '../test/resetDb';

describe('captures service', () => {
  beforeEach(resetDb);

  it('captureNow stamps context from the active session, or leaves it empty', async () => {
    const area = await createArea({ name: 'A', preset: 'practice' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'practice' });
    const session = await startSession({ itemId: item.id });
    const c1 = await captureNow({ text: 'while studying', route: '/study' });
    expect(c1.context).toEqual({ areaId: area.id, itemId: item.id, sessionId: session.id, route: '/study' });
    await stopSession();
    const c2 = await captureNow({ text: 'later thought' });
    expect(c2.context.sessionId).toBeUndefined();
    expect(c2.status).toBe('inbox');
  });

  it('triageToNewItem titles from the text; long text lands in the note', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const longText =
      'An idea that runs much longer than eighty characters so the note must keep the full text safe for later reading';
    const capture = await captureNow({ text: longText });
    await triageToNewItem(capture.id, { areaId: area.id, kind: 'note' });
    const item = (await db.items.toArray())[0];
    expect(item.title).toBe(longText.slice(0, 80));
    expect(await getNoteText(item.id)).toBe(longText);
    const triaged = await db.captures.get(capture.id);
    expect(triaged?.status).toBe('triaged');
    expect(triaged?.triagedToItemId).toBe(item.id);
  });

  it('attachToItem appends a dated quote block to the item note', async () => {
    const area = await createArea({ name: 'A', preset: 'conceptual' });
    const item = await createItem({ areaId: area.id, title: 'X', kind: 'note' });
    await saveNote(item.id, 'existing');
    const capture = await captureNow({ text: 'new insight' }, new Date(2026, 6, 25, 12, 0));
    await attachToItem(capture.id, item.id);
    const note = await getNoteText(item.id);
    expect(note).toContain('existing');
    expect(note).toContain('> [capture 2026-07-25] new insight');
    expect((await db.captures.get(capture.id))?.status).toBe('triaged');
  });

  it('dismissCapture removes it from the inbox without deleting the row', async () => {
    const capture = await captureNow({ text: 'noise' });
    await dismissCapture(capture.id);
    expect((await db.captures.get(capture.id))?.status).toBe('dismissed');
    expect(await db.captures.count()).toBe(1);
  });
});
