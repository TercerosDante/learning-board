import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import { archiveArea, createArea } from '../../services/areas';
import { createItem } from '../../services/items';
import type { Area, AreaPreset, ItemKind } from '../../domain/types';

const PRESETS: AreaPreset[] = ['conceptual', 'practice', 'project', 'time-only', 'minimal'];
const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];

function NewAreaForm() {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<AreaPreset>('conceptual');
  const [target, setTarget] = useState('');
  const submit = async () => {
    if (!name.trim()) return;
    await createArea({
      name: name.trim(),
      preset,
      weeklyTargetMinutes: target ? Number(target) : undefined,
    });
    setName('');
    setTarget('');
  };
  return (
    <div className="card">
      <h3>New area</h3>
      <label>
        Area name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>{' '}
      <label>
        Preset{' '}
        <select value={preset} onChange={(e) => setPreset(e.target.value as AreaPreset)}>
          {PRESETS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>{' '}
      <label>
        Weekly target (min) <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>{' '}
      <button onClick={() => void submit()}>Add area</button>
    </div>
  );
}

function AreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('note');
  const addItem = async () => {
    if (!title.trim()) return;
    await createItem({ areaId: area.id, title: title.trim(), kind });
    setTitle('');
  };
  return (
    <section className="card">
      <h3>{area.name}</h3>
      <p>
        {area.weeklyTargetMinutes ? `Target ${area.weeklyTargetMinutes} min/week · ` : ''}
        <button onClick={() => void archiveArea(area.id)}>Archive</button>
      </p>
      <ul>
        {(items ?? []).map((i) => (
          <li key={i.id}>
            {i.title} <small>({i.kind} · {i.status})</small>
          </li>
        ))}
      </ul>
      <label>
        New item title <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>{' '}
      <label>
        Kind{' '}
        <select value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>{' '}
      <button onClick={() => void addItem()}>Add item</button>
    </section>
  );
}

export function PlanPage() {
  const areas = useLiveQuery(listAreas);
  return (
    <div>
      <h2>Plan</h2>
      <NewAreaForm />
      {(areas ?? []).map((a) => (
        <AreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
