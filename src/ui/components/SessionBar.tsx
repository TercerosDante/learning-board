import { useEffect, useReducer } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveSession, stopSession, tickSession } from '../../services/sessions';
import { sessionMinutes } from '../../domain/consistency';
import { Button } from '@/components/ui/button';

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
  const elapsed = Math.floor(sessionMinutes(active, new Date()));
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Studying · {elapsed} min</span>
      <Button size="sm" variant="outline" onClick={() => void stopSession()}>
        Stop
      </Button>
    </div>
  );
}
