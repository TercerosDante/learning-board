import { useEffect, useReducer } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession, stopSession, tickSession } from '../../services/sessions';
import { minutesBetween } from '../../domain/time';

export function SessionBar() {
  const active = useLiveQuery(getActiveSession);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!active) return;
    const display = setInterval(forceRender, 1000);
    const tick = setInterval(() => void tickSession(), 60_000);
    return () => {
      clearInterval(display);
      clearInterval(tick);
    };
  }, [active?.id]);

  if (!active) return null;
  const elapsed = Math.floor(minutesBetween(active.startedAt, new Date().toISOString()));
  return (
    <div className="session-bar">
      <span>Studying · {elapsed} min</span>
      <button onClick={() => void stopSession()}>Stop</button>
    </div>
  );
}
