import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { inboxCaptures, listAreas, listItemsForArea } from '../../data/queries';
import { attachToItem, dismissCapture, triageToNewItem } from '../../services/captures';
import type { Area, Capture, Item, ItemKind } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];
const NONE = 'none'; // Radix SelectItem must never have value=""

function TriageRow({ capture, areas }: { capture: Capture; areas: Area[] }) {
  const [areaId, setAreaId] = useState(capture.context.areaId ?? '');
  const [kind, setKind] = useState<ItemKind>('note');
  const [itemId, setItemId] = useState('');
  const items = useLiveQuery(
    () => (areaId ? listItemsForArea(areaId) : Promise.resolve([] as Item[])),
    [areaId]
  );
  return (
    <li className="space-y-2 rounded-lg border p-4">
      <p>{capture.text}</p>
      <p className="text-sm text-muted-foreground">
        {new Date(capture.at).toLocaleString()}
        {capture.context.route ? ` · from ${capture.context.route}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`area-${capture.id}`}>Area</Label>
        <Select
          value={areaId || NONE}
          onValueChange={(v) => {
            setAreaId(v === NONE ? '' : v);
            setItemId('');
          }}
        >
          <SelectTrigger id={`area-${capture.id}`} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor={`kind-${capture.id}`}>Kind</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
          <SelectTrigger id={`kind-${capture.id}`} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!areaId} onClick={() => void triageToNewItem(capture.id, { areaId, kind })}>
          New item
        </Button>
        <Label htmlFor={`item-${capture.id}`}>Item</Label>
        <Select value={itemId || NONE} onValueChange={(v) => setItemId(v === NONE ? '' : v)}>
          <SelectTrigger id={`item-${capture.id}`} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {(items ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!itemId} onClick={() => void attachToItem(capture.id, itemId)}>
          Attach
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void dismissCapture(capture.id)}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

export function ReviewPage() {
  const areas = useLiveQuery(listAreas);
  const captures = useLiveQuery(inboxCaptures);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Review</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Inbox{captures ? ` (${captures.length})` : ''}</h3>
        </CardHeader>
        <CardContent>
          {captures?.length === 0 && <p>Inbox empty — nothing to triage.</p>}
          <ul className="space-y-2">
            {(captures ?? []).map((c) => (
              <TriageRow key={c.id} capture={c} areas={areas ?? []} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
