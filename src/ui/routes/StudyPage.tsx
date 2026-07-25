import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea } from '../../data/queries';
import { addManualSession, getActiveSession, startSession } from '../../services/sessions';
import { isDrillDoneToday, setDrillDone } from '../../services/items';
import type { Area, Item } from '../../domain/types';
import { NoteEditor } from '../components/NoteEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function DrillRow({ item }: { item: Item }) {
  const done = useLiveQuery(() => isDrillDoneToday(item.id), [item.id]);
  return (
    <li className="flex items-center gap-2">
      <Checkbox
        id={`drill-${item.id}`}
        checked={done ?? false}
        onCheckedChange={(checked) => void setDrillDone(item.id, checked === true)}
      />
      <Label htmlFor={`drill-${item.id}`}>{item.title}</Label>
    </li>
  );
}

function StudyAreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const [minutes, setMinutes] = useState('');
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">
          {area.name}{' '}
          <Button
            size="sm"
            variant="outline"
            aria-label={`Start ${area.name}`}
            onClick={() => void startSession({ areaId: area.id })}
          >
            Start
          </Button>
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {(items ?? []).map((item) =>
            area.profile.minimalMode && item.kind === 'practice' ? (
              <DrillRow key={item.id} item={item} />
            ) : (
              <li key={item.id}>
                {item.title}{' '}
                <Button size="sm" variant="outline" onClick={() => void startSession({ itemId: item.id })}>
                  Start
                </Button>
              </li>
            )
          )}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Log time without the timer</summary>
          <div className="mt-2 flex items-center gap-2">
            <Label htmlFor={`manual-${area.id}`}>Minutes</Label>
            <Input
              id={`manual-${area.id}`}
              type="number"
              className="w-24"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                const n = Number(minutes);
                if (n > 0) void addManualSession({ areaId: area.id, minutes: n });
                setMinutes('');
              }}
            >
              Add
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function StudyPage() {
  const areas = useLiveQuery(listAreas);
  const active = useLiveQuery(getActiveSession);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Study</h2>
      {active?.itemId && <NoteEditor itemId={active.itemId} />}
      {(areas ?? []).map((a) => (
        <StudyAreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
