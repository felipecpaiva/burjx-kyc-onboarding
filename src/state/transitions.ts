/**
 * T4 — Allowed KYC status transitions (explicit transition table).
 *
 * The machine owns status changes. This table is the single authority for which
 * status -> status moves are legal DURING a session (submit, poll).
 *
 * Identity (from === to) is NOT a transition — re-saving a draft keeps status
 * 'draft' and must NOT pass through this guard (Hole 4a). Hydration from
 * server truth on boot is also exempt and applied via the reducer's HYDRATE
 * action without consulting this table (Hole 4b).
 *
 * Pure module, no RN imports.
 */

import { KycStatus } from '../types/kyc';

export const ALLOWED_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  not_started: ['draft'],
  draft: ['submitted'], // status CHANGE only; a re-save stays 'draft' (not a transition)
  submitted: ['approved', 'rejected', 'requires_more_info'],
  requires_more_info: ['draft', 'submitted'],
  approved: [], // terminal
  rejected: [], // terminal
};

/** True when `from -> to` is a legal, non-identity transition. */
export function canTransition(from: KycStatus, to: KycStatus): boolean {
  return from !== to && ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Throws on an illegal, non-identity transition. Identity (from === to) is a
 * no-op (re-save), never an error. Used by the reducer to guard in-session
 * status changes (SUBMIT_SUCCESS, POLL_TICK). NOT called by HYDRATE.
 */
export function assertTransition(from: KycStatus, to: KycStatus): void {
  if (from !== to && !ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal KYC transition ${from} → ${to}`);
  }
}
