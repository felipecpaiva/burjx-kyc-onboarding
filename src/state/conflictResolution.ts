/**
 * T4 — Conflict resolution between the local draft and the fake service state.
 *
 * Strategy (source-of-truth rules):
 *  - Service is authoritative once status is submitted/more_info/approved/
 *    rejected. Local edits must not overwrite it.
 *  - While the service is still not_started/draft, a newer local draft wins.
 *  - requires_more_info routes the user to the earliest missing step.
 *
 * Red-team fixes folded in:
 *  - Hole 1: when the service is authoritative AND a local draft exists, the
 *    caller archives the local draft (archiveLocal) — never silently deletes.
 *  - Hole 2: in the more_info prefill, editable sub-objects prefer the LOCAL
 *    value when it is strictly newer than the server's; status/decision
 *    metadata stays server-authoritative.
 *  - Hole 3: route to the EARLIEST wizard step among ALL requiredFields.
 *  - Hole 5: normalize both ISO timestamps; for draft-vs-draft, local wins on
 *    tie (localT >= serverT); unparseable timestamps -> keep local.
 *
 * Pure module, no RN imports.
 */

import {
  earliestStepFor,
  isServerAuthoritative,
  KycApplication,
  KycStep,
  LocalDraft,
} from '../types/kyc';

export interface Reconciled {
  winner: 'local' | 'server';
  application: KycApplication;
  nextStep: KycStep;
  reason: string;
  /** True when the caller must archive the local draft (Hole 1). */
  archiveLocal: boolean;
}

/**
 * Overlay editable sub-objects (personalInfo/address/document) from the local
 * draft onto the server application ONLY when the local edit is strictly newer
 * (Hole 2). Never alters status / requiredFields / rejectionReason — those stay
 * server-authoritative.
 */
export function prefill(server: KycApplication, local: LocalDraft): KycApplication {
  const localT = Date.parse(local.localUpdatedAt);
  const serverT = Date.parse(server.updatedAt);
  const localNewer = Number.isFinite(localT) && Number.isFinite(serverT) && localT > serverT;
  if (!localNewer) return server;

  const la = local.application;
  return {
    ...server,
    personalInfo: la.personalInfo ?? server.personalInfo,
    address: la.address ?? server.address,
    document: la.document ?? server.document,
    // status, requiredFields, rejectionReason, id, currentStep, updatedAt: server-owned
  };
}

export function reconcile(
  local: LocalDraft | null,
  server: KycApplication,
): Reconciled {
  if (isServerAuthoritative(server.status)) {
    if (server.status === 'requires_more_info') {
      const fields = server.requiredFields ?? [];
      const nextStep = earliestStepFor(fields); // Hole 3
      const application = local ? prefill(server, local) : server; // Hole 2
      return {
        winner: 'server',
        application,
        nextStep,
        reason: 'requires_more_info routing',
        archiveLocal: false,
      };
    }
    // submitted / approved / rejected -> server authoritative; preserve local
    // edits by archiving rather than deleting (Hole 1).
    return {
      winner: 'server',
      application: server,
      nextStep: 'status',
      reason: `server ${server.status} authoritative`,
      archiveLocal: !!local,
    };
  }

  // Service is not_started | draft.
  if (!local) {
    return {
      winner: 'server',
      application: server,
      nextStep: server.currentStep ?? 'personal_info',
      reason: 'no local draft',
      archiveLocal: false,
    };
  }

  const localT = Date.parse(local.localUpdatedAt);
  const serverT = Date.parse(server.updatedAt);
  const unparseable = !Number.isFinite(localT) || !Number.isFinite(serverT);

  if (unparseable || localT >= serverT) {
    // Hole 5: tie favors local (protect in-progress edits); unparseable ->
    // treat as conflict and keep local (don't silently discard).
    return {
      winner: 'local',
      application: local.application,
      nextStep: local.application.currentStep ?? 'personal_info',
      reason: unparseable
        ? 'unparseable timestamps -> keep local (dont lose)'
        : 'local >= server draft',
      archiveLocal: false,
    };
  }

  return {
    winner: 'server',
    application: server,
    nextStep: server.currentStep ?? 'personal_info',
    reason: 'server strictly newer',
    archiveLocal: false,
  };
}
