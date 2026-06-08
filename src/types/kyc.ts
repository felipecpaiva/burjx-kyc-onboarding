/**
 * T2 — Core KYC domain contracts + derived maps and helpers.
 *
 * The `KycStatus`, `KycStep`, `KycRequiredField`, `DocumentType`, and
 * `KycApplication` types are the contracts provided verbatim by the assessment
 * spec. Everything below them is derived machinery used by the state machine
 * (transitions, reducer), conflict resolution, and per-step validation.
 *
 * Pure types + pure helpers only — no React Native imports, so this module is
 * unit-testable with zero rendering.
 */

// ---------------------------------------------------------------------------
// Provided contracts (verbatim from the assessment spec)
// ---------------------------------------------------------------------------

export type KycStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'requires_more_info'
  | 'approved'
  | 'rejected';

export type KycStep =
  | 'personal_info'
  | 'address'
  | 'document'
  | 'review'
  | 'status';

export type KycRequiredField =
  | 'personalInfo.legalName'
  | 'personalInfo.dateOfBirth'
  | 'personalInfo.nationality'
  | 'address.country'
  | 'address.city'
  | 'address.line1'
  | 'document.type'
  | 'document.documentNumber';

export type DocumentType = 'passport' | 'national_id' | 'drivers_license';

export interface KycApplication {
  id: string;
  status: KycStatus;
  currentStep: KycStep;
  personalInfo?: {
    legalName: string;
    dateOfBirth: string;
    nationality: string;
  };
  address?: {
    country: string;
    city: string;
    line1: string;
  };
  document?: {
    type: DocumentType;
    documentNumber: string;
  };
  rejectionReason?: string;
  requiredFields?: KycRequiredField[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Single source of truth: required field -> owning wizard step
// Per-step validation (T9) and requires_more_info routing (T4) both derive
// from this map — no duplicated field lists.
// ---------------------------------------------------------------------------

export const REQUIRED_FIELD_TO_STEP: Record<KycRequiredField, KycStep> = {
  'personalInfo.legalName': 'personal_info',
  'personalInfo.dateOfBirth': 'personal_info',
  'personalInfo.nationality': 'personal_info',
  'address.country': 'address',
  'address.city': 'address',
  'address.line1': 'address',
  'document.type': 'document',
  'document.documentNumber': 'document',
};

/** Canonical wizard order; index drives "earliest step" routing (Hole 3). */
export const WIZARD_ORDER = [
  'personal_info',
  'address',
  'document',
  'review',
  'status',
] as const;

/** Steps the user can edit (own user-supplied fields). */
export const EDITABLE_STEPS = ['personal_info', 'address', 'document'] as const;

/**
 * Inverse of REQUIRED_FIELD_TO_STEP, derived (not hand-maintained).
 * Used by T9 per-step validation to know which fields a step owns.
 */
export const STEP_REQUIRED_FIELDS: Record<KycStep, KycRequiredField[]> = (
  Object.keys(REQUIRED_FIELD_TO_STEP) as KycRequiredField[]
).reduce(
  (acc, field) => {
    const step = REQUIRED_FIELD_TO_STEP[field];
    acc[step].push(field);
    return acc;
  },
  {
    personal_info: [],
    address: [],
    document: [],
    review: [],
    status: [],
  } as Record<KycStep, KycRequiredField[]>,
);

// ---------------------------------------------------------------------------
// Local persistence shape
// ---------------------------------------------------------------------------

/** What we persist locally: the application plus a local edit timestamp (ISO). */
export interface LocalDraft {
  application: KycApplication;
  localUpdatedAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Status classification helpers
// ---------------------------------------------------------------------------

/**
 * Statuses where the fake service is authoritative and local edits must not
 * silently overwrite service state.
 */
export const SERVER_AUTHORITATIVE_STATUSES: KycStatus[] = [
  'submitted',
  'requires_more_info',
  'approved',
  'rejected',
];

/** Terminal statuses — no further transitions allowed. */
export const TERMINAL_STATUSES = ['approved', 'rejected'] as const;

export const isTerminalStatus = (s: KycStatus): boolean =>
  (TERMINAL_STATUSES as readonly string[]).includes(s);

export const isServerAuthoritative = (s: KycStatus): boolean =>
  SERVER_AUTHORITATIVE_STATUSES.includes(s);

/**
 * Earliest wizard step among a set of required fields (Hole 3).
 *
 * `requires_more_info` may list several missing fields; routing to
 * `requiredFields[0]` could skip an earlier step. We route to the earliest
 * step by WIZARD_ORDER index instead. Empty / unknown -> personal_info.
 */
export function earliestStepFor(fields: KycRequiredField[]): KycStep {
  const steps = fields.map((f) => REQUIRED_FIELD_TO_STEP[f]);
  return WIZARD_ORDER.find((s) => steps.includes(s)) ?? 'personal_info';
}
