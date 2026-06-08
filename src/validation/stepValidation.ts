/**
 * T9 — Per-step field validation.
 *
 * Field requirements derive from STEP_REQUIRED_FIELDS (T2) so there is exactly
 * one source of truth for "which fields does this step own". Pure functions, no
 * RN imports.
 *
 * DOB policy (decided 2026-06-08): a plausible date of birth must be non-empty,
 * parseable, not in the future, AND correspond to an age of at least 18 years.
 */

import {
  KycApplication,
  KycRequiredField,
  KycStep,
  STEP_REQUIRED_FIELDS,
} from '../types/kyc';

/** Minimum age (years) accepted for KYC. */
export const MIN_AGE_YEARS = 18;

export interface FieldError {
  field: KycRequiredField;
  message: string;
}

export interface StepValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/** True when a string value is present and not just whitespace. */
function isNonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Whole years between `dob` and `now`, floored. Used for the 18+ gate.
 * Accounts for month/day so someone whose birthday hasn't occurred yet this
 * year is correctly one year younger.
 */
export function ageInYears(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * DOB is plausible when: non-empty, parseable, not in the future, and age >= 18.
 * `now` is injectable for deterministic tests; defaults to current time.
 */
export function isPlausibleDOB(value: string, now: Date = new Date()): boolean {
  if (!isNonEmpty(value)) return false;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return false;
  const dob = new Date(ts);
  if (dob.getTime() > now.getTime()) return false; // future DOB
  return ageInYears(dob, now) >= MIN_AGE_YEARS;
}

const DOCUMENT_TYPES = ['passport', 'national_id', 'drivers_license'] as const;

/**
 * Validate a single required field against the application.
 * Returns an error message string when invalid, or null when valid.
 * `now` is threaded through for DOB age checks (deterministic in tests).
 */
export function validateField(
  field: KycRequiredField,
  app: KycApplication,
  now: Date = new Date(),
): string | null {
  switch (field) {
    case 'personalInfo.legalName':
      return isNonEmpty(app.personalInfo?.legalName)
        ? null
        : 'Legal name is required.';
    case 'personalInfo.dateOfBirth':
      return isPlausibleDOB(app.personalInfo?.dateOfBirth ?? '', now)
        ? null
        : 'Enter a valid date of birth (must be 18 or older).';
    case 'personalInfo.nationality':
      return isNonEmpty(app.personalInfo?.nationality)
        ? null
        : 'Nationality is required.';
    case 'address.country':
      return isNonEmpty(app.address?.country) ? null : 'Country is required.';
    case 'address.city':
      return isNonEmpty(app.address?.city) ? null : 'City is required.';
    case 'address.line1':
      return isNonEmpty(app.address?.line1)
        ? null
        : 'Address line 1 is required.';
    case 'document.type':
      return app.document?.type &&
        (DOCUMENT_TYPES as readonly string[]).includes(app.document.type)
        ? null
        : 'Select a document type.';
    case 'document.documentNumber':
      return isNonEmpty(app.document?.documentNumber)
        ? null
        : 'Document number is required.';
    default: {
      // Exhaustiveness guard — a new KycRequiredField must be handled here.
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
}

/**
 * Validate an explicit set of required fields (used to gate resubmission from
 * `requires_more_info` — Hole 3: gate on ALL requiredFields, not just the
 * routed one — and as the shared implementation for per-step validation).
 */
export function validateFields(
  fields: KycRequiredField[],
  app: KycApplication,
  now: Date = new Date(),
): StepValidationResult {
  const errors: FieldError[] = [];
  for (const field of fields) {
    const message = validateField(field, app, now);
    if (message) errors.push({ field, message });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate every field owned by `step`. The wizard "Next" button gates on
 * `result.valid`.
 */
export function validateStep(
  step: KycStep,
  app: KycApplication,
  now: Date = new Date(),
): StepValidationResult {
  return validateFields(STEP_REQUIRED_FIELDS[step], app, now);
}

/** Lookup the error message for a field from a validation result list. */
export function errorFor(
  errors: FieldError[],
  field: KycRequiredField,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}
