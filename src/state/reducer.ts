/**
 * T4 — KYC machine reducer.
 *
 * The reducer is the single source of truth for machine state, including
 * `currentStep`. The UI is a pure projection of this state; no navigation
 * library owns step or status.
 *
 * Guard rules:
 *  - SUBMIT_SUCCESS and POLL_TICK are genuine in-session status changes — they
 *    call assertTransition(prev.status, next.status). An illegal transition
 *    keeps the previous application and raises a defensive error (never crashes
 *    the reducer).
 *  - HYDRATE applies reconciled server/local truth on boot and is EXEMPT from
 *    the transition guard (Hole 4b) — hydration is not a transition.
 *  - EDIT_FIELD / SAVE_* keep status 'draft' (a re-save is not a transition,
 *    Hole 4a) and never call assertTransition.
 *  - POLL_TICK landing on requires_more_info routes currentStep to the earliest
 *    missing step (Hole 3).
 *
 * Pure module, no RN imports.
 */

import {
  earliestStepFor,
  isTerminalStatus,
  KycApplication,
  KycStatus,
  KycStep,
} from '../types/kyc';
import { FieldError } from '../validation/stepValidation';
import { assertTransition } from './transitions';

export type MachineStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'submitting'
  | 'polling'
  | 'error';

export interface MachineError {
  message: string;
  retryable: boolean;
}

export interface MachineState {
  machineStatus: MachineStatus;
  application: KycApplication | null;
  currentStep: KycStep;
  validationErrors: FieldError[];
  error: MachineError | null;
  pollAttempts: number;
  pollBoundHit: boolean;
  archivedNoticeShown: boolean;
}

export const initialState: MachineState = {
  machineStatus: 'idle',
  application: null,
  currentStep: 'personal_info',
  validationErrors: [],
  error: null,
  pollAttempts: 0,
  pollBoundHit: false,
  archivedNoticeShown: false,
};

/** Wizard navigation order for Next/Prev (excludes the terminal 'status' view). */
const NAV_ORDER: KycStep[] = ['personal_info', 'address', 'document', 'review'];

export type EditableSection = 'personalInfo' | 'address' | 'document';

export type Action =
  | { type: 'BOOT_START' }
  | {
      type: 'HYDRATE';
      application: KycApplication;
      currentStep: KycStep;
      winner?: 'local' | 'server';
      reason?: string;
      archivedNoticeShown?: boolean;
    }
  | { type: 'EDIT_FIELD'; section: EditableSection; key: string; value: string }
  | { type: 'SET_STEP'; step: KycStep }
  | { type: 'VALIDATE_STEP'; errors: FieldError[] }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; application?: KycApplication }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; application: KycApplication }
  | { type: 'SUBMIT_ERROR'; message: string; retryable: boolean }
  | { type: 'POLL_START' }
  | { type: 'POLL_TICK'; application: KycApplication }
  | { type: 'POLL_BOUND_HIT' }
  | { type: 'POLL_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

/** Defensive state when a guarded transition is illegal — keep prev, flag error. */
function illegalTransition(
  state: MachineState,
  from: KycStatus,
  to: KycStatus,
): MachineState {
  return {
    ...state,
    machineStatus: 'error',
    error: {
      message: `Illegal KYC transition ${from} → ${to}`,
      retryable: false,
    },
  };
}

export function reducer(state: MachineState, action: Action): MachineState {
  switch (action.type) {
    case 'BOOT_START':
      return { ...state, machineStatus: 'loading', error: null };

    case 'HYDRATE':
      // Exempt from transition guard (Hole 4b) — hydration is not a transition.
      return {
        ...state,
        application: action.application,
        currentStep: action.currentStep,
        machineStatus: 'idle',
        error: null,
        pollAttempts: 0,
        pollBoundHit: false,
        archivedNoticeShown:
          action.archivedNoticeShown ?? state.archivedNoticeShown,
      };

    case 'EDIT_FIELD': {
      if (!state.application) return state; // nothing to edit until hydrated
      const app = state.application;
      const section = app[action.section] ?? {};
      // A user edit keeps status as-is (Hole 4a — a re-save is not a
      // transition); the spread preserves app.status untouched.
      const nextApp: KycApplication = {
        ...app,
        [action.section]: { ...section, [action.key]: action.value },
      };
      return { ...state, application: nextApp };
    }

    case 'SET_STEP':
      return { ...state, currentStep: action.step, validationErrors: [] };

    case 'VALIDATE_STEP':
      return { ...state, validationErrors: action.errors };

    case 'NEXT_STEP': {
      const idx = NAV_ORDER.indexOf(state.currentStep);
      if (idx < 0 || idx === NAV_ORDER.length - 1) return state;
      return {
        ...state,
        currentStep: NAV_ORDER[idx + 1],
        validationErrors: [],
      };
    }

    case 'PREV_STEP': {
      const idx = NAV_ORDER.indexOf(state.currentStep);
      if (idx <= 0) return state;
      return {
        ...state,
        currentStep: NAV_ORDER[idx - 1],
        validationErrors: [],
      };
    }

    case 'SAVE_START':
      return { ...state, machineStatus: 'saving', error: null };

    case 'SAVE_SUCCESS':
      return {
        ...state,
        machineStatus: 'idle',
        application: action.application ?? state.application,
      };

    case 'SAVE_ERROR':
      // Non-fatal: keep in-memory state, surface a banner.
      return {
        ...state,
        machineStatus: 'idle',
        error: { message: action.message, retryable: true },
      };

    case 'SUBMIT_START':
      return { ...state, machineStatus: 'submitting', error: null };

    case 'SUBMIT_SUCCESS': {
      const from = state.application?.status ?? 'not_started';
      const to = action.application.status;
      try {
        assertTransition(from, to);
      } catch {
        return illegalTransition(state, from, to);
      }
      return {
        ...state,
        application: action.application,
        currentStep: action.application.currentStep ?? 'status',
        machineStatus: 'idle',
        error: null,
        pollAttempts: 0,
        pollBoundHit: false,
      };
    }

    case 'SUBMIT_ERROR':
      return {
        ...state,
        machineStatus: 'error',
        error: { message: action.message, retryable: action.retryable },
      };

    case 'POLL_START':
      return { ...state, machineStatus: 'polling', error: null };

    case 'POLL_TICK': {
      const from = state.application?.status ?? 'not_started';
      const to = action.application.status;
      try {
        assertTransition(from, to);
      } catch {
        return illegalTransition(state, from, to);
      }
      const settled = isTerminalStatus(to) || to === 'requires_more_info';
      const nextStep: KycStep =
        to === 'requires_more_info'
          ? earliestStepFor(action.application.requiredFields ?? []) // Hole 3
          : isTerminalStatus(to)
            ? 'status'
            : state.currentStep;
      return {
        ...state,
        application: action.application,
        currentStep: nextStep,
        machineStatus: settled ? 'idle' : 'polling',
        pollAttempts: state.pollAttempts + 1,
      };
    }

    case 'POLL_BOUND_HIT':
      return {
        ...state,
        machineStatus: 'idle',
        pollBoundHit: true,
        error: {
          message: 'Verification is taking longer than expected.',
          retryable: true,
        },
      };

    case 'POLL_ERROR':
      return {
        ...state,
        machineStatus: 'error',
        error: { message: action.message, retryable: true },
        pollAttempts: state.pollAttempts + 1,
      };

    case 'RETRY':
      return {
        ...state,
        machineStatus: 'idle',
        error: null,
        pollBoundHit: false,
      };

    case 'RESET':
      return { ...initialState };

    default: {
      const _exhaustive: never = action;
      return state ?? _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors (pure projections used by the UI / tested in E6)
// ---------------------------------------------------------------------------

export type StatusVariant = 'approved' | 'rejected' | 'pending' | 'more_info' | null;

/** Maps an application status to the StatusScreen variant (null = not on status). */
export function selectStatusVariant(app: KycApplication | null): StatusVariant {
  switch (app?.status) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'submitted':
      return 'pending';
    case 'requires_more_info':
      return 'more_info';
    default:
      return null;
  }
}
