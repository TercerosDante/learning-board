import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAreas, listItemsForArea, listTopicsForArea } from '../../data/queries';
import { archiveArea, createArea } from '../../services/areas';
import { createItem, updateItem } from '../../services/items';
import { createTopic, deleteTopic } from '../../services/topics';
import type { Area, AreaPreset, Item, ItemKind, Topic } from '../../domain/types';
import { WeekPlanCard } from '../components/WeekPlanCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRESETS: AreaPreset[] = ['conceptual', 'practice', 'project', 'time-only', 'minimal'];
const KINDS: ItemKind[] = ['note', 'practice', 'project', 'reading'];
const NONE = 'none'; // Radix SelectItem must never have value=""

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
    <Card>
      <CardHeader>
        <h3 className="font-semibold">New area</h3>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Label htmlFor="area-name">Area name</Label>
          <Input id="area-name" className="w-48" value={name} onChange={(e) => setName(e.target.value)} />
          <Label htmlFor="area-preset">Preset</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as AreaPreset)}>
            <SelectTrigger id="area-preset" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="area-target">Weekly target (min)</Label>
          <Input
            id="area-target"
            type="number"
            className="w-24"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Button type="submit">Add area</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EstimateInput({ item }: { item: Item }) {
  const [value, setValue] = useState(item.estimateMinutes?.toString() ?? '');
  return (
    <Input
      type="number"
      className="w-20"
      aria-label={`Estimate for ${item.title}`}
      placeholder="min"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        void updateItem(item.id, { estimateMinutes: value !== '' && n > 0 ? n : undefined });
      }}
    />
  );
}

function ItemRow({ item, topics }: { item: Item; topics: Topic[] }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      {item.title}{' '}
      <span className="text-sm text-muted-foreground">({item.kind} · {item.status})</span>
      <EstimateInput item={item} />
      <Select
        value={item.topicId ?? NONE}
        onValueChange={(v) => void updateItem(item.id, { topicId: v === NONE ? undefined : v })}
      >
        <SelectTrigger aria-label={`Topic for ${item.title}`} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>no topic</SelectItem>
          {topics.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}

function AreaSection({ area }: { area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const topics = useLiveQuery(() => listTopicsForArea(area.id), [area.id]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ItemKind>('note');
  const [topicName, setTopicName] = useState('');
  const addItem = async () => {
    if (!title.trim()) return;
    await createItem({ areaId: area.id, title: title.trim(), kind });
    setTitle('');
  };
  const addTopic = async () => {
    if (!topicName.trim()) return;
    await createTopic(area.id, topicName.trim());
    setTopicName('');
  };
  const topicList = topics ?? [];
  const itemList = items ?? [];
  const groups: { topic?: Topic; items: Item[] }[] = [
    ...topicList.map((t) => ({ topic: t, items: itemList.filter((i) => i.topicId === t.id) })),
    { items: itemList.filter((i) => !i.topicId || !topicList.some((t) => t.id === i.topicId)) },
  ];
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">{area.name}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {area.weeklyTargetMinutes != null ? `Target ${area.weeklyTargetMinutes} min/week · ` : ''}
          <Button size="sm" variant="ghost" onClick={() => void archiveArea(area.id)}>
            Archive
          </Button>
        </p>
        {groups.map((g) => (
          <div key={g.topic?.id ?? 'no-topic'}>
            {g.topic && (
              <h4 className="font-medium">
                {g.topic.name}{' '}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete topic ${g.topic.name}`}
                  onClick={() => void deleteTopic(g.topic!.id)}
                >
                  ×
                </Button>
              </h4>
            )}
            <ul className="space-y-1">
              {g.items.map((i) => (
                <ItemRow key={i.id} item={i} topics={topicList} />
              ))}
            </ul>
          </div>
        ))}
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addItem();
          }}
        >
          <Label htmlFor={`new-item-${area.id}`}>New item in {area.name}</Label>
          <Input
            id={`new-item-${area.id}`}
            className="w-48"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Label htmlFor={`kind-${area.id}`}>Kind for {area.name}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ItemKind)}>
            <SelectTrigger id={`kind-${area.id}`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm">Add item</Button>
        </form>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addTopic();
          }}
        >
          <Label htmlFor={`new-topic-${area.id}`}>New topic in {area.name}</Label>
          <Input
            id={`new-topic-${area.id}`}
            className="w-48"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
          />
          <Button type="submit" size="sm">Add topic</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PlanPage() {
  const areas = useLiveQuery(listAreas);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Plan</h2>
      <WeekPlanCard />
      <NewAreaForm />
      {(areas ?? []).map((a) => (
        <AreaSection key={a.id} area={a} />
      ))}
    </div>
  );
}
