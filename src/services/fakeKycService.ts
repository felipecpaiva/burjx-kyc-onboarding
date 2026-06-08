/**
 * T3 — Fake KYC service.
 *
 * Local async stand-in for a real KYC/verification backend. No network, no
 * secrets. Behavior is deterministic and test-controllable: the verification
 * outcome is decided at submit time from a sentinel encoded in
 * `document.documentNumber`, and `pollKycStatus` advances a counter toward that
 * outcome.
 *
 * Sentinels (matched on document.documentNumber):
 *   'NETFAIL'           -> submit() rejects with Error('NETWORK_ERROR'); NOT
 *                          cached, so a retry after editing succeeds.
 *   startsWith 'REJECT' -> polling eventually -> rejected (+ rejectionReason).
 *   startsWith 'MOREINFO' -> polling eventually -> requires_more_info with
 *                          requiredFields ['document.documentNumber'].
 *   anything else       -> polling eventually -> approved.
 *
 * Replaceable by a real adapter later — same 4-function contract.
 */

import { isTerminalStatus, KycApplication } from '../types/kyc';

export const POLLS_UNTIL_TERMINAL = 3;

const delay = (ms = 150): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface ServiceState {
  current: KycApplication | null;
  submitResults: Map<string, KycApplication>;
  pollCount: number;
  pendingTerminal: KycApplication | null;
}

const state: ServiceState = {
  current: null,
  submitResults: new Map(),
  pollCount: 0,
  pendingTerminal: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultApplication(): KycApplication {
  return {
    id: 'kyc-local',
    status: 'not_started',
    currentStep: 'personal_info',
    updatedAt: nowIso(),
  };
}

/**
 * Single test-control surface. Resets ALL module state. Optionally seeds the
 * `current` application (e.g. a draft carrying a sentinel document number).
 */
export function __resetKyc(seed?: KycApplication): void {
  state.current = seed ?? null;
  state.submitResults = new Map();
  state.pollCount = 0;
  state.pendingTerminal = null;
}

/**
 * Give the in-memory "backend" session memory on app boot. The fake service is
 * module-scoped and otherwise forgets everything on reload; seeding it with the
 * resumed application keeps fetch/poll consistent with what the UI hydrated, so
 * resuming a draft (or a previously-submitted/terminal app) does not produce an
 * illegal poll transition against an amnesiac service.
 */
export function seedKyc(app: KycApplication): void {
  state.current = app;
  state.pollCount = 0;
  state.pendingTerminal = null;
}

/** Statuses where the application is locked and user edits must be rejected. */
function isLockedStatus(status: KycApplication['status']): boolean {
  return status === 'submitted' || isTerminalStatus(status);
}

function classifyOutcome(documentNumber: string | undefined): KycApplication['status'] {
  const dn = documentNumber ?? '';
  if (dn.startsWith('REJECT')) return 'rejected';
  if (dn.startsWith('MOREINFO')) return 'requires_more_info';
  return 'approved';
}

function buildTerminal(base: KycApplication): KycApplication {
  const outcome = classifyOutcome(base.document?.documentNumber);
  if (outcome === 'rejected') {
    return {
      ...base,
      status: 'rejected',
      currentStep: 'status',
      rejectionReason: 'Document could not be verified.',
      updatedAt: nowIso(),
    };
  }
  if (outcome === 'requires_more_info') {
    return {
      ...base,
      status: 'requires_more_info',
      currentStep: 'document',
      requiredFields: ['document.documentNumber'],
      updatedAt: nowIso(),
    };
  }
  return {
    ...base,
    status: 'approved',
    currentStep: 'status',
    updatedAt: nowIso(),
  };
}

/** Returns the current application, or a default not_started one. */
export async function fetchKycApplication(): Promise<KycApplication> {
  await delay();
  return state.current ?? defaultApplication();
}

/**
 * Merge a draft patch. If the application is LOCKED (submitted/approved/
 * rejected), the service wins and the patch is ignored. Edits ARE allowed while
 * the status is requires_more_info — that status explicitly solicits user
 * corrections — and applying a correction moves the status back to 'draft' so
 * the user can resubmit. Any merge invalidates a prior submission's cached
 * result (the corrected draft is a genuinely new submission).
 */
export async function saveKycDraft(
  patch: Partial<KycApplication>,
): Promise<KycApplication> {
  await delay();
  const base = state.current ?? defaultApplication();
  if (isLockedStatus(base.status)) {
    return base; // locked; do not overwrite
  }
  const merged: KycApplication = {
    ...base,
    ...patch,
    // nested objects merge shallowly so a partial patch keeps prior subfields
    personalInfo: patch.personalInfo
      ? { ...base.personalInfo, ...patch.personalInfo }
      : base.personalInfo,
    address: patch.address ? { ...base.address, ...patch.address } : base.address,
    document: patch.document ? { ...base.document, ...patch.document } : base.document,
    status: 'draft',
    updatedAt: nowIso(),
  } as KycApplication;
  state.current = merged;
  // A new draft edit supersedes any prior submission for this id, so the next
  // submit re-evaluates instead of replaying a stale cached outcome.
  state.submitResults.delete(merged.id);
  state.pendingTerminal = null;
  return merged;
}

/**
 * Submit the application. Idempotent by `applicationId` (a second submit
 * returns the cached submitted result). NETFAIL rejects BEFORE caching so a
 * retry works. On success the status becomes 'submitted' and the eventual
 * terminal/more_info outcome is staged for polling.
 */
export async function submitKycApplication(
  applicationId: string,
): Promise<KycApplication> {
  await delay();

  const cached = state.submitResults.get(applicationId);
  if (cached) return cached;

  const base = state.current ?? defaultApplication();

  // Simulated transport failure — thrown BEFORE caching so retry is possible.
  if (base.document?.documentNumber === 'NETFAIL') {
    throw new Error('NETWORK_ERROR');
  }

  // Stage the eventual outcome; polling will reveal it after N attempts.
  state.pendingTerminal = buildTerminal(base);
  state.pollCount = 0;

  const submitted: KycApplication = {
    ...base,
    status: 'submitted',
    currentStep: 'status',
    updatedAt: nowIso(),
  };
  state.current = submitted;
  state.submitResults.set(applicationId, submitted);
  return submitted;
}

/**
 * Poll for status. Returns immediately (no advance) if already terminal or
 * more_info, or if not in a submitted/pending state. Otherwise advances the
 * poll counter; once it reaches POLLS_UNTIL_TERMINAL it resolves to the staged
 * outcome.
 */
export async function pollKycStatus(): Promise<KycApplication> {
  await delay();
  const current = state.current ?? defaultApplication();

  // Already settled, or nothing to poll for -> return as-is (no crash).
  if (isTerminalStatus(current.status) || current.status === 'requires_more_info') {
    return current;
  }
  if (current.status !== 'submitted') {
    return current;
  }

  state.pollCount += 1;
  if (state.pollCount >= POLLS_UNTIL_TERMINAL && state.pendingTerminal) {
    state.current = state.pendingTerminal;
    return state.current;
  }
  return current; // still pending
}
