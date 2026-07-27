import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's built-in auto-cleanup detects a global `afterEach`, which this
// project doesn't have (vitest `globals` is off; tests import from 'vitest' explicitly per
// convention). Without this, unmounted trees from earlier tests linger in the DOM and only
// "happen" to look empty because their useLiveQuery subscriptions react to the next test's
// resetDb() — a fragile, timing-dependent illusion of isolation. Wire cleanup explicitly.
afterEach(() => {
  cleanup();
});
