import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import { addManualSession, getActiveSession, startSession } from '../../services/sessions';
import { isDrillDoneToday, setDrillDone } from '../../services/items';
import type { Area, Item } from '../../domain/types';
import { NoteEditor } from '../components/NoteEditor';

function DrillRow({ item }: { item: Item }) {
  const done = useLiveQuery(() => isDrillDoneToday(item.id), [item.id]);
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={done ?? false}
          onChange={(e) => void setDrillDone(item.id, e.target.checked)}
        />{' '}
        {item.title}
      </label>
    </li>
  );
}

function StudyAreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [minutes, setMinutes] = useState('');
  return (
    <section className="card">
      <h3>
        {area.name}{' '}
        <button aria-label={`Start ${area.name}`} onClick={() => void startSession({ areaId: area.id })}>
          Start
        </button>
      </h3>
      <ul>
        {(items ?? []).map((item) =>
          area.profile.minimalMode && item.kind === 'practice' ? (
            <DrillRow key={item.id} item={item} />
          ) : (
            <li key={item.id}>
              {item.title}{' '}
              <button onClick={() => void startSession({ itemId: item.id })}>Start</button>
            </li>
          )
        )}
      </ul>
      <details>
        <summary>Log time without the timer</summary>
        <label>
          Minutes <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>{' '}
        <button
          onClick={() => {
            const n = Number(minutes);
            if (n > 0) void addManualSession({ areaId: area.id, minutes: n });
            setMinutes('');
          }}
        >
          Add
        </button>
      </details>
    </section>
  );
}

export function StudyPage() {
  const areas = useLiveQuery(listAreas);
  const active = useLiveQuery(getActiveSession);
  return (
    <div>
      <h2>Study</h2>
      {active?.itemId && <NoteEditor itemId={active.itemId} />}
      {(areas ?? []).map((a) => (
        <StudyAreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
