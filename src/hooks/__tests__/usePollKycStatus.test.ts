/**
 * E8 — Polling cleanup / bounded retry (RNTL + fake timers).
 *
 * Covers: stop-on-terminal (no further timers), bound hit once on never-settling
 * path, error path counts toward the bound (Hole 6a), and unmount mid-poll =>
 * no onResult/onError after (cancelledRef, Hole 6b).
 */

import { renderHook } from '@testing-library/react-native';
import { KycApplication } from '../../types/kyc';
import { usePollKycStatus } from '../usePollKycStatus';

const INTERVAL = 2000;

function app(status: KycApplication['status']): KycApplication {
  return { id: 'app-1', status, currentStep: 'status', updatedAt: '2026-06-08T00:00:00.000Z' };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('stop on terminal', () => {
  it('advances to approved then stops (no further timers)', async () => {
    const poll = jest
      .fn<Promise<KycApplication>, []>()
      .mockResolvedValueOnce(app('submitted'))
      .mockResolvedValueOnce(app('submitted'))
      .mockResolvedValueOnce(app('approved'));
    const onResult = jest.fn();
    const onBoundHit = jest.fn();
    const onError = jest.fn();

    renderHook(() =>
      usePollKycStatus({ active: true, poll, onResult, onBoundHit, onError, maxAttempts: 5, intervalMs: INTERVAL }),
    );

    await jest.advanceTimersByTimeAsync(INTERVAL); // submitted
    await jest.advanceTimersByTimeAsync(INTERVAL); // submitted
    await jest.advanceTimersByTimeAsync(INTERVAL); // approved -> stop

    expect(poll).toHaveBeenCalledTimes(3);
    expect(onResult).toHaveBeenLastCalledWith(app('approved'));
    expect(onBoundHit).not.toHaveBeenCalled();

    // No further timers should fire after terminal.
    const before = poll.mock.calls.length;
    await jest.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(poll.mock.calls.length).toBe(before);
  });
});

describe('bounded retry — never settling', () => {
  it('calls onBoundHit once at maxAttempts and stops', async () => {
    const poll = jest.fn<Promise<KycApplication>, []>().mockResolvedValue(app('submitted'));
    const onResult = jest.fn();
    const onBoundHit = jest.fn();
    const onError = jest.fn();

    renderHook(() =>
      usePollKycStatus({ active: true, poll, onResult, onBoundHit, onError, maxAttempts: 3, intervalMs: INTERVAL }),
    );

    await jest.advanceTimersByTimeAsync(INTERVAL); // 1
    await jest.advanceTimersByTimeAsync(INTERVAL); // 2
    await jest.advanceTimersByTimeAsync(INTERVAL); // 3 -> bound

    expect(poll).toHaveBeenCalledTimes(3);
    expect(onBoundHit).toHaveBeenCalledTimes(1);

    // No further polls after the bound.
    await jest.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(poll).toHaveBeenCalledTimes(3);
  });
});

describe('error path counts toward the bound (Hole 6a)', () => {
  it('persistent errors hit the bound after maxAttempts errors', async () => {
    const poll = jest.fn<Promise<KycApplication>, []>().mockRejectedValue(new Error('boom'));
    const onResult = jest.fn();
    const onBoundHit = jest.fn();
    const onError = jest.fn();

    renderHook(() =>
      usePollKycStatus({ active: true, poll, onResult, onBoundHit, onError, maxAttempts: 3, intervalMs: INTERVAL }),
    );

    await jest.advanceTimersByTimeAsync(INTERVAL); // error 1
    await jest.advanceTimersByTimeAsync(INTERVAL); // error 2
    await jest.advanceTimersByTimeAsync(INTERVAL); // error 3 -> bound

    expect(onError).toHaveBeenCalledTimes(3);
    expect(onBoundHit).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(INTERVAL * 5);
    expect(poll).toHaveBeenCalledTimes(3); // bounded, no infinite retry
  });
});

describe('unmount mid-poll (Hole 6b — cancelledRef)', () => {
  it('a poll resolving after unmount does not call onResult/onError', async () => {
    let resolvePoll!: (a: KycApplication) => void;
    const poll = jest.fn<Promise<KycApplication>, []>(
      () => new Promise<KycApplication>((resolve) => { resolvePoll = resolve; }),
    );
    const onResult = jest.fn();
    const onBoundHit = jest.fn();
    const onError = jest.fn();

    const { unmount } = renderHook(() =>
      usePollKycStatus({ active: true, poll, onResult, onBoundHit, onError, maxAttempts: 5, intervalMs: INTERVAL }),
    );

    await jest.advanceTimersByTimeAsync(INTERVAL); // tick fires, poll in-flight (pending)
    expect(poll).toHaveBeenCalledTimes(1);

    unmount(); // cancelledRef = true
    resolvePoll(app('approved')); // resolve AFTER unmount
    await Promise.resolve();
    await Promise.resolve();

    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onBoundHit).not.toHaveBeenCalled();
  });
});

describe('inactive', () => {
  it('does not poll when active is false', async () => {
    const poll = jest.fn<Promise<KycApplication>, []>().mockResolvedValue(app('approved'));
    renderHook(() =>
      usePollKycStatus({ active: false, poll, onResult: jest.fn(), onBoundHit: jest.fn(), onError: jest.fn(), intervalMs: INTERVAL }),
    );
    await jest.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(poll).not.toHaveBeenCalled();
  });
});
