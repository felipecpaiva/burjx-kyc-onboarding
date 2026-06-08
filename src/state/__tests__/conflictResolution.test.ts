/**
 * E4 + E5 (conflict portion) — reconcile + prefill.
 * Each red-team fix has a discriminating assertion that fails if the fix is
 * removed.
 */

import { KycApplication, LocalDraft } from '../../types/kyc';
import { prefill, reconcile } from '../conflictResolution';

function serverApp(over: Partial<KycApplication>): KycApplication {
  return {
    id: 'app-1',
    status: 'draft',
    currentStep: 'address',
    updatedAt: '2026-06-08T12:00:00.000Z',
    ...over,
  };
}

function localDraft(
  localUpdatedAt: string,
  over: Partial<KycApplication> = {},
): LocalDraft {
  return {
    localUpdatedAt,
    application: {
      id: 'app-1',
      status: 'draft',
      currentStep: 'document',
      updatedAt: localUpdatedAt,
      ...over,
    },
  };
}

describe('draft-vs-draft timestamp resolution (Hole 5)', () => {
  it('local strictly newer than server draft -> local wins', () => {
    const r = reconcile(
      localDraft('2026-06-08T13:00:00.000Z'),
      serverApp({ updatedAt: '2026-06-08T12:00:00.000Z' }),
    );
    expect(r.winner).toBe('local');
    expect(r.nextStep).toBe('document');
  });

  it('local older than server draft -> server wins', () => {
    const r = reconcile(
      localDraft('2026-06-08T11:00:00.000Z'),
      serverApp({ updatedAt: '2026-06-08T12:00:00.000Z' }),
    );
    expect(r.winner).toBe('server');
    expect(r.reason).toMatch(/strictly newer/);
  });

  it('TIE favors local (non-strict >= — discriminating for Hole 5)', () => {
    // If the compare were strict (localT > serverT), a tie would go to server.
    const ts = '2026-06-08T12:00:00.000Z';
    const r = reconcile(localDraft(ts), serverApp({ updatedAt: ts }));
    expect(r.winner).toBe('local');
  });

  it('unparseable timestamp -> keep local, archiveLocal false (Hole 5)', () => {
    const r = reconcile(
      localDraft('garbage-date'),
      serverApp({ updatedAt: '2026-06-08T12:00:00.000Z' }),
    );
    expect(r.winner).toBe('local');
    expect(r.archiveLocal).toBe(false);
    expect(r.reason).toMatch(/unparseable/);
  });

  it('no local draft -> server wins', () => {
    const r = reconcile(null, serverApp({}));
    expect(r.winner).toBe('server');
    expect(r.reason).toMatch(/no local draft/);
  });
});

describe('cold-start resume: server not_started + local draft (regression)', () => {
  // The in-memory fake service returns a fresh-stamped not_started default on
  // reload. A timestamp compare would let that blank app beat a persisted
  // draft; the not_started branch must always resume the local draft.
  it('local draft wins even when the not_started server is newer', () => {
    const r = reconcile(
      localDraft('2026-06-08T10:00:00.000Z', { currentStep: 'address' }),
      // server stamped LATER than the local draft, but it is not_started
      serverApp({ status: 'not_started', updatedAt: '2026-06-08T23:00:00.000Z' }),
    );
    expect(r.winner).toBe('local');
    expect(r.nextStep).toBe('address'); // local draft's own currentStep
    expect(r.reason).toMatch(/not_started/);
    expect(r.archiveLocal).toBe(false);
  });
});

describe('server-authoritative statuses (Hole 1 — archive not delete)', () => {
  it('submitted -> server wins, nextStep status, archiveLocal true when local exists', () => {
    const r = reconcile(
      localDraft('2026-06-08T13:00:00.000Z'),
      serverApp({ status: 'submitted' }),
    );
    expect(r.winner).toBe('server');
    expect(r.nextStep).toBe('status');
    expect(r.archiveLocal).toBe(true); // discriminating: must archive, not drop
  });

  it('archiveLocal false when no local draft to preserve', () => {
    const r = reconcile(null, serverApp({ status: 'submitted' }));
    expect(r.archiveLocal).toBe(false);
  });

  it('approved -> server wins', () => {
    const r = reconcile(localDraft('2026-06-08T13:00:00.000Z'), serverApp({ status: 'approved' }));
    expect(r.winner).toBe('server');
    expect(r.archiveLocal).toBe(true);
  });

  it('rejected -> server wins with reason', () => {
    const r = reconcile(null, serverApp({ status: 'rejected', rejectionReason: 'bad doc' }));
    expect(r.winner).toBe('server');
    expect(r.application.rejectionReason).toBe('bad doc');
  });
});

describe('requires_more_info routing (Hole 3 — earliest, not first)', () => {
  it('routes to earliest wizard step among ALL requiredFields', () => {
    // requiredFields[0] is document.* but personalInfo.* is earlier.
    const r = reconcile(
      null,
      serverApp({
        status: 'requires_more_info',
        requiredFields: ['document.documentNumber', 'personalInfo.legalName'],
      }),
    );
    expect(r.nextStep).toBe('personal_info'); // NOT 'document'
  });

  it('single field routes to its owning step', () => {
    expect(
      reconcile(null, serverApp({ status: 'requires_more_info', requiredFields: ['address.city'] })).nextStep,
    ).toBe('address');
    expect(
      reconcile(null, serverApp({ status: 'requires_more_info', requiredFields: ['document.documentNumber'] })).nextStep,
    ).toBe('document');
  });

  it('empty requiredFields -> personal_info', () => {
    expect(
      reconcile(null, serverApp({ status: 'requires_more_info', requiredFields: [] })).nextStep,
    ).toBe('personal_info');
  });
});

describe('prefill (Hole 2 — per-field newest-wins for editable fields)', () => {
  const server = serverApp({
    status: 'requires_more_info',
    requiredFields: ['document.documentNumber'],
    updatedAt: '2026-06-08T12:00:00.000Z',
    personalInfo: { legalName: 'Server Name', dateOfBirth: '1990-01-01', nationality: 'US' },
  });

  it('keeps NEWER local editable field over stale server field', () => {
    const local = localDraft('2026-06-08T13:00:00.000Z', {
      personalInfo: { legalName: 'Local Newer Name', dateOfBirth: '1990-01-01', nationality: 'US' },
    });
    const merged = prefill(server, local);
    expect(merged.personalInfo?.legalName).toBe('Local Newer Name');
    // status/decision metadata stays server-owned
    expect(merged.status).toBe('requires_more_info');
    expect(merged.requiredFields).toEqual(['document.documentNumber']);
  });

  it('does NOT overlay when local is older than server (discriminating)', () => {
    const local = localDraft('2026-06-08T11:00:00.000Z', {
      personalInfo: { legalName: 'Stale Local', dateOfBirth: '1990-01-01', nationality: 'US' },
    });
    const merged = prefill(server, local);
    expect(merged.personalInfo?.legalName).toBe('Server Name');
  });

  it('reconcile more_info applies prefill when local newer', () => {
    const local = localDraft('2026-06-08T13:00:00.000Z', {
      address: { country: 'GB', city: 'London', line1: '10 Downing' },
    });
    const r = reconcile(local, server);
    expect(r.winner).toBe('server');
    expect(r.application.address?.city).toBe('London'); // newer local editable field kept
    expect(r.application.status).toBe('requires_more_info');
  });
});
