import { useEffect, useState } from 'react';
import { getStaleActiveSession, trimSessionToLastTick } from '../../services/sessions';
import type { Session } from '../../domain/types';

export function StaleSessionBanner() {
  const [stale, setStale] = useState<Session | null>(null);
  useEffect(() => {
    void getStaleActiveSession().then(setStale);
  }, []);
  if (!stale) return null;
  return (
    <div className="banner">
      A session from {new Date(stale.startedAt).toLocaleString()} is still running.{' '}
      <button
        onClick={() => {
          void trimSessionToLastTick(stale.id);
          setStale(null);
        }}
      >
        End it at last activity
      </button>{' '}
      <button onClick={() => setStale(null)}>Keep it running</button>
    </div>
  );
}
