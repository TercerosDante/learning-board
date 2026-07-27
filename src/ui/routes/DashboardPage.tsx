import { useLiveQuery } from 'dexie-react-hooks';
import { consistencySummary } from '../../data/queries';
import { BackupPanel } from '../components/BackupPanel';

export function DashboardPage() {
  const summary = useLiveQuery(() => consistencySummary());
  if (!summary) return null;
  return (
    <div>
      <h2>Dashboard</h2>
      <section className="card">
        <h3>Consistency</h3>
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
      </section>
      <BackupPanel />
    </div>
  );
}
