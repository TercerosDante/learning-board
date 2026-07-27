import { useEffect, useState } from 'react';
import { getStaleActiveSession, trimSessionToLastTick } from '../../services/sessions';
import type { Session } from '../../domain/types';
import { Button } from '@/components/ui/button';

export function StaleSessionBanner() {
  const [stale, setStale] = useState<Session | null>(null);
  useEffect(() => {
    void getStaleActiveSession().then(setStale);
  }, []);
  if (!stale) return null;
  return (
    <div className="mx-auto mt-2 max-w-4xl rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm">
      A session from {new Date(stale.startedAt).toLocaleString()} is still running.{' '}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void trimSessionToLastTick(stale.id);
          setStale(null);
        }}
      >
        End it at last activity
      </Button>{' '}
      <Button size="sm" variant="ghost" onClick={() => setStale(null)}>
        Keep it running
      </Button>
    </div>
  );
}
