/**
 * E2 — Allowed state transitions + HYDRATE bypass (Hole 4b).
 */

import { reducer, initialState, MachineState } from '../reducer';
import { KycApplication } from '../../types/kyc';
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
} from '../transitions';

describe('transition table membership', () => {
  it('every documented legal edge is in the table', () => {
    expect(ALLOWED_TRANSITIONS.not_started).toEqual(['draft']);
    expect(ALLOWED_TRANSITIONS.draft).toEqual(['submitted']);
    expect(ALLOWED_TRANSITIONS.submitted).toEqual(
      expect.arrayContaining(['approved', 'rejected', 'requires_more_info']),
    );
    expect(ALLOWED_TRANSITIONS.requires_more_info).toEqual(
      expect.arrayContaining(['draft', 'submitted']),
    );
    expect(ALLOWED_TRANSITIONS.approved).toEqual([]);
    expect(ALLOWED_TRANSITIONS.rejected).toEqual([]);
  });
});

describe('canTransition', () => {
  it('identity is not a transition', () => {
    expect(canTransition('draft', 'draft')).toBe(false);
    expect(canTransition('submitted', 'submitted')).toBe(false);
  });

  it('legal edges', () => {
    expect(canTransition('submitted', 'approved')).toBe(true);
    expect(canTransition('submitted', 'rejected')).toBe(true);
    expect(canTransition('submitted', 'requires_more_info')).toBe(true);
    expect(canTransition('requires_more_info', 'draft')).toBe(true);
    expect(canTransition('requires_more_info', 'submitted')).toBe(true);
  });
});

describe('assertTransition throws on illegal edges', () => {
  it('terminal statuses cannot transition', () => {
    expect(() => assertTransition('approved', 'draft')).toThrow(/Illegal/);
    expect(() => assertTransition('rejected', 'draft')).toThrow(/Illegal/);
    expect(() => assertTransition('approved', 'submitted')).toThrow(/Illegal/);
  });

  it('cannot skip from not_started to submitted', () => {
    expect(() => assertTransition('not_started', 'submitted')).toThrow(/Illegal/);
  });

  it('cannot go submitted -> draft', () => {
    expect(() => assertTransition('submitted', 'draft')).toThrow(/Illegal/);
  });

  it('cannot go draft -> approved', () => {
    expect(() => assertTransition('draft', 'approved')).toThrow(/Illegal/);
  });

  it('identity does NOT throw (re-save)', () => {
    expect(() => assertTransition('draft', 'draft')).not.toThrow();
    expect(() => assertTransition('approved', 'approved')).not.toThrow();
  });

  it('legal edges do not throw', () => {
    expect(() => assertTransition('submitted', 'approved')).not.toThrow();
    expect(() => assertTransition('requires_more_info', 'submitted')).not.toThrow();
  });
});

describe('HYDRATE bypasses the transition guard (Hole 4b)', () => {
  // Discriminating test: if the reducer routed HYDRATE through assertTransition,
  // this draft -> approved hydration (a non-table edge) would raise an error.
  it('applies a non-table edge (draft -> approved) without error', () => {
    const draftState: MachineState = {
      ...initialState,
      application: {
        id: 'a',
        status: 'draft',
        currentStep: 'review',
        updatedAt: '2026-06-08T00:00:00.000Z',
      },
      currentStep: 'review',
    };
    const approvedApp: KycApplication = {
      id: 'a',
      status: 'approved',
      currentStep: 'status',
      updatedAt: '2026-06-08T01:00:00.000Z',
    };
    const next = reducer(draftState, {
      type: 'HYDRATE',
      application: approvedApp,
      currentStep: 'status',
    });
    expect(next.application?.status).toBe('approved');
    expect(next.currentStep).toBe('status');
    expect(next.machineStatus).toBe('idle');
    expect(next.error).toBeNull(); // no defensive error -> guard was not consulted
  });
});
