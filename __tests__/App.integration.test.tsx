/**
 * App integration — exercises the boot + poll wiring that unit tests can't see
 * (the App/screens layer is excluded from the coverage gate). Specifically
 * locks the regression where a single transient poll error tore down the poll
 * loop in the integrated app (Hole 6a was dead despite E8 being green in
 * isolation).
 */

import { act, render, screen } from '@testing-library/react-native';
import { KycApplication } from '../src/types/kyc';

jest.mock('../src/services/draftStorage', () => ({
  loadDraft: jest.fn().mockResolvedValue(null),
  saveDraft: jest.fn().mockResolvedValue(undefined),
  archiveDraft: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/fakeKycService', () => ({
  fetchKycApplication: jest.fn(),
  saveKycDraft: jest.fn(),
  submitKycApplication: jest.fn(),
  seedKyc: jest.fn(),
  pollKycStatus: jest.fn(),
}));

import { fetchKycApplication, pollKycStatus } from '../src/services/fakeKycService';
import App from '../App';

const submitted: KycApplication = {
  id: 'kyc-local',
  status: 'submitted',
  currentStep: 'status',
  personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
  address: { country: 'US', city: 'NYC', line1: '1 Main St' },
  document: { type: 'passport', documentNumber: 'PASS123' },
  updatedAt: '2026-06-08T00:00:00.000Z',
};
const approved: KycApplication = { ...submitted, status: 'approved' };

const mockFetch = fetchKycApplication as jest.Mock;
const mockPoll = pollKycStatus as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

it('resumes a submitted application and recovers from a transient poll error to approved', async () => {
  // Boot resolves to a submitted application -> StatusScreen pending + polling.
  mockFetch.mockResolvedValue(submitted);
  // First poll errors (transient), second poll approves.
  mockPoll.mockRejectedValueOnce(new Error('flaky network')).mockResolvedValue(approved);

  render(<App />);
  await flush(); // let boot reconcile + HYDRATE settle

  expect(screen.getByText('Verification in progress')).toBeTruthy();

  // First poll fires and REJECTS — the loop must keep going, not tear down.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });
  expect(screen.queryByText('You are verified')).toBeNull(); // still pending after the error

  // Second poll resolves approved.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2000);
  });

  expect(screen.getByText('You are verified')).toBeTruthy();
  expect(mockPoll).toHaveBeenCalledTimes(2); // proves it retried past the error
});
