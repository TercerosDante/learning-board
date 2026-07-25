import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { currentWeekPlan, listAreas, listItemsForArea } from '../../data/queries';
import { getOrCreateWeekPlan, updateWeekPlanEntry } from '../../services/weekPlan';
import type { Area, WeekPlan } from '../../domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function TargetInput({ plan, area }: { plan: WeekPlan; area: Area }) {
  const entry = plan.entries.find((e) => e.areaId === area.id);
  const [value, setValue] = useState(entry?.targetMinutes?.toString() ?? '');
  return (
    <Input
      type="number"
      className="inline-block w-20"
      aria-label={`Week target for ${area.name}`}
      placeholder="min"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        void updateWeekPlanEntry(plan.id, area.id, {
          targetMinutes: value !== '' && n >= 0 ? n : undefined,
        });
      }}
    />
  );
}

function FocusPicker({ plan, area }: { plan: WeekPlan; area: Area }) {
  const items = useLiveQuery(() => listItemsForArea(area.id), [area.id]);
  const entry = plan.entries.find((e) => e.areaId === area.id);
  const focus = entry?.focusItemIds ?? [];
  const toggle = (itemId: string, on: boolean) => {
    const next = on ? [...focus, itemId] : focus.filter((id) => id !== itemId);
    void updateWeekPlanEntry(plan.id, area.id, { focusItemIds: next });
  };
  if (!items || items.length === 0) return null;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground">Focus items ({focus.length})</summary>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            <Checkbox
              id={`focus-${i.id}`}
              checked={focus.includes(i.id)}
              onCheckedChange={(checked) => toggle(i.id, checked === true)}
            />
            <Label htmlFor={`focus-${i.id}`}>{i.title}</Label>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function WeekPlanCard() {
  const areas = useLiveQuery(listAreas);
  const plan = useLiveQuery(() => currentWeekPlan());
  if (plan === undefined) return null; // loading
  if (plan === null) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold">This week</h3>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void getOrCreateWeekPlan()}>Set up this week</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">This week (w/c {plan.weekStart})</h3>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {(areas ?? []).map((area) => (
            <li key={area.id}>
              {area.name}: <TargetInput plan={plan} area={area} /> min
              <FocusPicker plan={plan} area={area} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
