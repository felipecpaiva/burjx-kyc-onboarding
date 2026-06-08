/**
 * T7 — Bounded KYC status polling hook (Hole 6).
 *
 * Recursive setTimeout (no overlapping requests). Guarantees:
 *  - Hole 6a: EVERY settle counts toward the bound — success AND error. The
 *    error path is bounded too, so a persistently-failing poll cannot run
 *    forever.
 *  - Hole 6b: a `cancelledRef` is set in the effect cleanup and checked before
 *    every onResult / onError / reschedule, so a poll resolving after unmount
 *    is a complete no-op.
 *  - Stops unconditionally on a terminal (approved/rejected) or
 *    requires_more_info result.
 *  - Calls onBoundHit exactly once when attempts reach maxAttempts without
 *    settling.
 *
 * `poll` is injectable (defaults to the fake service) so fake-timer tests run
 * instantly without the service's latency; `maxAttempts` and `intervalMs` are
 * injectable for the same reason.
 */

import { useEffect, useRef } from 'react';
import { pollKycStatus as defaultPoll } from '../services/fakeKycService';
import { isTerminalStatus, KycApplication } from '../types/kyc';

export interface UsePollKycStatusOptions {
  /** When true, the poll loop is armed. Flipping false->true re-arms (Retry). */
  active: boolean;
  onResult: (app: KycApplication) => void;
  onBoundHit: () => void;
  onError: (err: unknown) => void;
  poll?: () => Promise<KycApplication>;
  maxAttempts?: number;
  intervalMs?: number;
}

function isStopStatus(app: KycApplication): boolean {
  return isTerminalStatus(app.status) || app.status === 'requires_more_info';
}

export function usePollKycStatus({
  active,
  onResult,
  onBoundHit,
  onError,
  poll = defaultPoll,
  maxAttempts = 5,
  intervalMs = 2000,
}: UsePollKycStatusOptions): void {
  // Keep latest callbacks/poll in a ref so changing them does not re-arm the
  // loop (only `active` and the bounds drive the effect).
  const latest = useRef({ onResult, onBoundHit, onError, poll });
  latest.current = { onResult, onBoundHit, onError, poll };

  useEffect(() => {
    if (!active) return;

    const cancelledRef = { current: false };
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      let app: KycApplication;
      try {
        app = await latest.current.poll();
      } catch (err) {
        attempts += 1; // Hole 6a: errors count toward the bound
        if (cancelledRef.current) return; // Hole 6b
        latest.current.onError(err);
        if (attempts >= maxAttempts) {
          latest.current.onBoundHit();
          return;
        }
        schedule();
        return;
      }

      attempts += 1; // success also counts
      if (cancelledRef.current) return; // Hole 6b
      latest.current.onResult(app);
      if (isStopStatus(app)) return; // stop on terminal / more_info
      if (attempts >= maxAttempts) {
        latest.current.onBoundHit();
        return;
      }
      schedule();
    };

    schedule(); // first poll after one interval; recursive thereafter

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, maxAttempts, intervalMs]);
}
