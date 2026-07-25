import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  if (!summary) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Dashboard</h2>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Consistency</h3>
        </CardHeader>
        <CardContent>
          <p>
            {summary.minutesThisWeek} / {summary.targetMinutes} min this week
          </p>
          <p>Streak: {summary.streak} day{summary.streak === 1 ? '' : 's'}</p>
          <ul>
            {summary.perArea.map(({ area, minutes }) => (
              <li key={area.id}>
                {area.name}: {minutes} min
                {area.weeklyTargetMinutes ? ` / ${area.weeklyTargetMinutes} min` : ''}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <BackupPanel />
    </div>
  );
}
