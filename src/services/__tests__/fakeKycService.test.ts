/**
 * E7 — Fake service failure and retry, idempotency, poll-before-submit.
 */

import { KycApplication } from '../../types/kyc';
import {
  __resetKyc,
  fetchKycApplication,
  pollKycStatus,
  POLLS_UNTIL_TERMINAL,
  saveKycDraft,
  submitKycApplication,
} from '../fakeKycService';

function seed(documentNumber: string): KycApplication {
  return {
    id: 'app-1',
    status: 'draft',
    currentStep: 'review',
    personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
    address: { country: 'US', city: 'NYC', line1: '1 Main St' },
    document: { type: 'passport', documentNumber },
    updatedAt: '2026-06-08T00:00:00.000Z',
  };
}

afterEach(() => __resetKyc());

describe('submit failure + retry', () => {
  it('NETFAIL rejects with NETWORK_ERROR and is NOT cached', async () => {
    __resetKyc(seed('NETFAIL'));
    await expect(submitKycApplication('app-1')).rejects.toThrow('NETWORK_ERROR');

    // Edit the document to a passing value; submit must now succeed
    // (proves the failed attempt was not cached against the id).
    await saveKycDraft({ document: { type: 'passport', documentNumber: 'PASS123' } });
    const res = await submitKycApplication('app-1');
    expect(res.status).toBe('submitted');
  });
});

describe('idempotency', () => {
  it('double submit returns the cached submitted result', async () => {
    __resetKyc(seed('PASS123'));
    const first = await submitKycApplication('app-1');
    const second = await submitKycApplication('app-1');
    expect(second).toBe(first); // same cached object reference
    expect(second.status).toBe('submitted');
  });
});

describe('poll before submit', () => {
  it('returns a default not_started app without crashing', async () => {
    __resetKyc();
    const res = await pollKycStatus();
    expect(res.status).toBe('not_started');
  });

  it('returns current draft unchanged when not submitted', async () => {
    __resetKyc(seed('PASS123'));
    const res = await pollKycStatus();
    expect(res.status).toBe('draft');
  });
});

describe('outcome paths via polling', () => {
  it('approved after POLLS_UNTIL_TERMINAL', async () => {
    __resetKyc(seed('PASS123'));
    await submitKycApplication('app-1');
    let res = await pollKycStatus();
    for (let i = 1; i < POLLS_UNTIL_TERMINAL; i++) {
      res = await pollKycStatus();
    }
    expect(res.status).toBe('approved');
  });

  it('rejected with reason for REJECT* sentinel', async () => {
    __resetKyc(seed('REJECT9'));
    await submitKycApplication('app-1');
    let res = await pollKycStatus();
    for (let i = 1; i < POLLS_UNTIL_TERMINAL; i++) {
      res = await pollKycStatus();
    }
    expect(res.status).toBe('rejected');
    expect(res.rejectionReason).toBeTruthy();
  });

  it('requires_more_info with requiredFields for MOREINFO* sentinel', async () => {
    __resetKyc(seed('MOREINFO1'));
    await submitKycApplication('app-1');
    let res = await pollKycStatus();
    for (let i = 1; i < POLLS_UNTIL_TERMINAL; i++) {
      res = await pollKycStatus();
    }
    expect(res.status).toBe('requires_more_info');
    expect(res.requiredFields).toEqual(['document.documentNumber']);
  });

  it('stops advancing once terminal (poll after approved is a no-op)', async () => {
    __resetKyc(seed('PASS123'));
    await submitKycApplication('app-1');
    for (let i = 0; i < POLLS_UNTIL_TERMINAL; i++) await pollKycStatus();
    const afterTerminal = await pollKycStatus();
    expect(afterTerminal.status).toBe('approved');
  });
});

describe('saveKycDraft server-wins guard', () => {
  it('ignores patch when service is authoritative', async () => {
    __resetKyc(seed('PASS123'));
    await submitKycApplication('app-1'); // now submitted (authoritative)
    const res = await saveKycDraft({ personalInfo: { legalName: 'Hacker', dateOfBirth: '1990-01-01', nationality: 'US' } });
    expect(res.status).toBe('submitted');
    expect(res.personalInfo?.legalName).toBe('Ada'); // unchanged
  });
});

describe('fetchKycApplication', () => {
  it('returns default when nothing seeded', async () => {
    __resetKyc();
    const res = await fetchKycApplication();
    expect(res.status).toBe('not_started');
    expect(res.currentStep).toBe('personal_info');
  });
});
