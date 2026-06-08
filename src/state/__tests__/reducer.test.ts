/**
 * E5 (reducer portion) + E6 — reducer behavior and integration with the fake
 * service for approved/rejected outcomes; StatusScreen variant mapper.
 */

import {
  __resetKyc,
  pollKycStatus,
  POLLS_UNTIL_TERMINAL,
  submitKycApplication,
} from '../../services/fakeKycService';
import { KycApplication } from '../../types/kyc';
import {
  Action,
  initialState,
  MachineState,
  reducer,
  selectStatusVariant,
} from '../reducer';

function hydratedDraft(over: Partial<KycApplication> = {}): MachineState {
  return reducer(initialState, {
    type: 'HYDRATE',
    application: {
      id: 'app-1',
      status: 'draft',
      currentStep: 'personal_info',
      updatedAt: '2026-06-08T00:00:00.000Z',
      ...over,
    },
    currentStep: 'personal_info',
  });
}

describe('EDIT_FIELD', () => {
  it('merges a field and keeps status draft (Hole 4a — re-save is not a transition)', () => {
    let s = hydratedDraft();
    s = reducer(s, { type: 'EDIT_FIELD', section: 'personalInfo', key: 'legalName', value: 'Ada' });
    expect(s.application?.personalInfo?.legalName).toBe('Ada');
    expect(s.application?.status).toBe('draft');
    expect(s.error).toBeNull();
  });

  it('is a no-op before hydration', () => {
    const s = reducer(initialState, { type: 'EDIT_FIELD', section: 'address', key: 'city', value: 'X' });
    expect(s.application).toBeNull();
  });
});

describe('NEXT_STEP / PREV_STEP', () => {
  it('advances and reverses within nav order, clamps at ends', () => {
    let s = hydratedDraft();
    s = reducer(s, { type: 'NEXT_STEP' });
    expect(s.currentStep).toBe('address');
    s = reducer(s, { type: 'NEXT_STEP' });
    s = reducer(s, { type: 'NEXT_STEP' });
    expect(s.currentStep).toBe('review');
    s = reducer(s, { type: 'NEXT_STEP' }); // clamp at review
    expect(s.currentStep).toBe('review');
    s = reducer(s, { type: 'PREV_STEP' });
    expect(s.currentStep).toBe('document');
  });
});

describe('SUBMIT_SUCCESS guard', () => {
  it('applies a legal transition draft -> submitted', () => {
    const s = hydratedDraft();
    const next = reducer(s, {
      type: 'SUBMIT_SUCCESS',
      application: { ...s.application!, status: 'submitted', currentStep: 'status' },
    });
    expect(next.application?.status).toBe('submitted');
    expect(next.currentStep).toBe('status');
    expect(next.error).toBeNull();
  });

  it('rejects an illegal transition and keeps previous state (defensive)', () => {
    // draft -> approved is illegal as an in-session transition.
    const s = hydratedDraft();
    const next = reducer(s, {
      type: 'SUBMIT_SUCCESS',
      application: { ...s.application!, status: 'approved' },
    });
    expect(next.application?.status).toBe('draft'); // unchanged
    expect(next.machineStatus).toBe('error');
    expect(next.error?.message).toMatch(/Illegal/);
  });
});

describe('POLL_TICK routing (Hole 3) + guard', () => {
  function submittedState(): MachineState {
    const s = hydratedDraft();
    return reducer(s, {
      type: 'SUBMIT_SUCCESS',
      application: { ...s.application!, status: 'submitted', currentStep: 'status' },
    });
  }

  it('requires_more_info routes to earliest step among ALL requiredFields', () => {
    const s = submittedState();
    const next = reducer(s, {
      type: 'POLL_TICK',
      application: {
        ...s.application!,
        status: 'requires_more_info',
        requiredFields: ['document.documentNumber', 'personalInfo.legalName'],
      },
    });
    expect(next.application?.status).toBe('requires_more_info');
    expect(next.currentStep).toBe('personal_info'); // earliest, NOT document
    expect(next.machineStatus).toBe('idle'); // settled
  });

  it('terminal approved sets status step and idles', () => {
    const s = submittedState();
    const next = reducer(s, {
      type: 'POLL_TICK',
      application: { ...s.application!, status: 'approved', currentStep: 'status' },
    });
    expect(next.currentStep).toBe('status');
    expect(next.machineStatus).toBe('idle');
  });

  it('same status (submitted -> submitted) does not throw and stays polling', () => {
    const s = submittedState();
    const next = reducer(s, {
      type: 'POLL_TICK',
      application: { ...s.application!, status: 'submitted' },
    });
    expect(next.machineStatus).toBe('polling');
    expect(next.pollAttempts).toBe(1);
  });

  it('illegal poll transition keeps prev + defensive error', () => {
    const s = submittedState();
    // submitted -> not_started is illegal
    const next = reducer(s, {
      type: 'POLL_TICK',
      application: { ...s.application!, status: 'not_started' },
    });
    expect(next.application?.status).toBe('submitted');
    expect(next.error?.message).toMatch(/Illegal/);
  });
});

describe('lifecycle + async machineStatus actions', () => {
  it('BOOT_START -> loading, clears error', () => {
    const s = reducer({ ...initialState, error: { message: 'x', retryable: true } }, { type: 'BOOT_START' });
    expect(s.machineStatus).toBe('loading');
    expect(s.error).toBeNull();
  });

  it('SAVE_START/SUCCESS/ERROR', () => {
    let s = hydratedDraft();
    s = reducer(s, { type: 'SAVE_START' });
    expect(s.machineStatus).toBe('saving');
    const savedApp = { ...s.application!, updatedAt: '2026-06-08T05:00:00.000Z' };
    s = reducer(s, { type: 'SAVE_SUCCESS', application: savedApp });
    expect(s.machineStatus).toBe('idle');
    expect(s.application?.updatedAt).toBe('2026-06-08T05:00:00.000Z');

    s = reducer(s, { type: 'SAVE_ERROR', message: 'disk full' });
    expect(s.machineStatus).toBe('idle'); // non-fatal
    expect(s.error).toEqual({ message: 'disk full', retryable: true });
  });

  it('SUBMIT_START -> submitting, SUBMIT_ERROR carries retryable', () => {
    let s = reducer(hydratedDraft(), { type: 'SUBMIT_START' });
    expect(s.machineStatus).toBe('submitting');
    s = reducer(s, { type: 'SUBMIT_ERROR', message: 'NETWORK', retryable: true });
    expect(s.machineStatus).toBe('error');
    expect(s.error).toEqual({ message: 'NETWORK', retryable: true });
  });

  it('POLL_START -> polling', () => {
    const s = reducer(hydratedDraft(), { type: 'POLL_START' });
    expect(s.machineStatus).toBe('polling');
  });

  it('POLL_BOUND_HIT flags bound + retryable error', () => {
    const s = reducer(hydratedDraft(), { type: 'POLL_BOUND_HIT' });
    expect(s.pollBoundHit).toBe(true);
    expect(s.error?.retryable).toBe(true);
  });

  it('POLL_ERROR stays polling (does NOT tear down the loop) + counts attempt', () => {
    // A transient poll error must not flip the machine to a poll-stopping state;
    // the hook retries up to the bound. This is the invariant the App poll
    // wiring depends on (otherwise Hole 6a is dead in the integrated app).
    const s = reducer(hydratedDraft(), { type: 'POLL_ERROR', message: 'boom' });
    expect(s.machineStatus).toBe('polling');
    expect(s.machineStatus).not.toBe('error');
    expect(s.pollAttempts).toBe(1);
  });

  it('RETRY clears error and bound flag', () => {
    const errored: MachineState = {
      ...hydratedDraft(),
      machineStatus: 'error',
      error: { message: 'x', retryable: true },
      pollBoundHit: true,
    };
    const s = reducer(errored, { type: 'RETRY' });
    expect(s.error).toBeNull();
    expect(s.pollBoundHit).toBe(false);
    expect(s.machineStatus).toBe('idle');
  });

  it('SET_STEP / VALIDATE_STEP', () => {
    let s = hydratedDraft();
    s = reducer(s, { type: 'SET_STEP', step: 'document' });
    expect(s.currentStep).toBe('document');
    s = reducer(s, { type: 'VALIDATE_STEP', errors: [{ field: 'document.type', message: 'pick one' }] });
    expect(s.validationErrors).toHaveLength(1);
  });

  it('PREV_STEP clamps at first step', () => {
    const s = reducer(hydratedDraft(), { type: 'PREV_STEP' });
    expect(s.currentStep).toBe('personal_info');
  });

  it('RESET returns to initial', () => {
    const s = reducer({ ...hydratedDraft(), pollAttempts: 4 }, { type: 'RESET' });
    expect(s).toEqual(initialState);
  });
});

describe('selectStatusVariant mapper', () => {
  it('maps statuses to variants', () => {
    expect(selectStatusVariant({ status: 'approved' } as KycApplication)).toBe('approved');
    expect(selectStatusVariant({ status: 'rejected' } as KycApplication)).toBe('rejected');
    expect(selectStatusVariant({ status: 'submitted' } as KycApplication)).toBe('pending');
    expect(selectStatusVariant({ status: 'requires_more_info' } as KycApplication)).toBe('more_info');
    expect(selectStatusVariant({ status: 'draft' } as KycApplication)).toBeNull();
    expect(selectStatusVariant(null)).toBeNull();
  });
});

describe('E6 — reducer drives the fake service end-to-end', () => {
  afterEach(() => __resetKyc());

  /** Apply the submit+poll loop against the real fake service. */
  async function runOutcome(documentNumber: string) {
    const seed: KycApplication = {
      id: 'app-1',
      status: 'draft',
      currentStep: 'review',
      personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
      address: { country: 'US', city: 'NYC', line1: '1 Main St' },
      document: { type: 'passport', documentNumber },
      updatedAt: '2026-06-08T00:00:00.000Z',
    };
    __resetKyc(seed);
    let state = reducer(initialState, {
      type: 'HYDRATE',
      application: seed,
      currentStep: 'review',
    });

    const submitted = await submitKycApplication('app-1');
    state = reducer(state, { type: 'SUBMIT_SUCCESS', application: submitted });

    for (let i = 0; i < POLLS_UNTIL_TERMINAL; i++) {
      const polled = await pollKycStatus();
      const action: Action = { type: 'POLL_TICK', application: polled };
      state = reducer(state, action);
    }
    return state;
  }

  it('approved path: submit -> poll -> approved, transition applied', async () => {
    const state = await runOutcome('PASS123');
    expect(state.application?.status).toBe('approved');
    expect(state.currentStep).toBe('status');
    expect(selectStatusVariant(state.application)).toBe('approved');
    expect(state.error).toBeNull();
  });

  it('rejected path: submit -> poll -> rejected + reason', async () => {
    const state = await runOutcome('REJECT1');
    expect(state.application?.status).toBe('rejected');
    expect(state.application?.rejectionReason).toBeTruthy();
    expect(selectStatusVariant(state.application)).toBe('rejected');
  });
});
