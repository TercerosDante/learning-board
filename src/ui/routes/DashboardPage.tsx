import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary, coverageSummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  const coverage = useLiveQuery(() => coverageSummary());
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
            {summary.perArea.map(({ area, minutes, targetMinutes }) => (
              <li key={area.id}>
                {area.name}: {minutes} min
                {targetMinutes != null ? ` / ${targetMinutes} min` : ''}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Coverage</h3>
        </CardHeader>
        <CardContent>
          {coverage && coverage.length === 0 && <p>No areas yet.</p>}
          <ul>
            {(coverage ?? []).map(({ area, covered, total, ratio }) => (
              <li key={area.id}>
                {area.name}: {covered}/{total} items ({Math.round(ratio * 100)}%)
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <BackupPanel />
    </div>
  );
}
