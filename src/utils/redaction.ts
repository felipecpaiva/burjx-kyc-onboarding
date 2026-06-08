/**
 * T5 — PII redaction for logging.
 *
 * KYC applications carry sensitive data (legal name, date of birth, document
 * number, street address). None of it may reach logs. Any debug logging of an
 * application MUST go through `redact()`, which returns a log-safe shape with
 * the sensitive fields masked and the rest (status, step, presence flags) kept
 * for debuggability.
 *
 * Pure function, no RN imports.
 */

import { KycApplication, KycRequiredField } from '../types/kyc';

export const MASK = '***';

export interface RedactedApplication {
  id: string;
  status: KycApplication['status'];
  currentStep: KycApplication['currentStep'];
  updatedAt: string;
  hasPersonalInfo: boolean;
  hasAddress: boolean;
  hasDocument: boolean;
  personalInfo?: { legalName: string; dateOfBirth: string; nationality: string };
  address?: { country: string; city: string; line1: string };
  document?: { type: string; documentNumber: string };
  requiredFields?: KycRequiredField[];
  rejectionReason?: string;
}

/**
 * Returns a log-safe projection of an application. Masks legalName,
 * dateOfBirth, documentNumber, and address.line1 (the directly-identifying
 * fields); keeps coarse fields (nationality, country, city, document type) and
 * machine state for debugging.
 */
export function redact(app: KycApplication | null): RedactedApplication | null {
  if (!app) return null;
  return {
    id: app.id,
    status: app.status,
    currentStep: app.currentStep,
    updatedAt: app.updatedAt,
    hasPersonalInfo: !!app.personalInfo,
    hasAddress: !!app.address,
    hasDocument: !!app.document,
    personalInfo: app.personalInfo
      ? {
          legalName: MASK,
          dateOfBirth: MASK,
          nationality: app.personalInfo.nationality,
        }
      : undefined,
    address: app.address
      ? { country: app.address.country, city: app.address.city, line1: MASK }
      : undefined,
    document: app.document
      ? { type: app.document.type, documentNumber: MASK }
      : undefined,
    requiredFields: app.requiredFields,
    rejectionReason: app.rejectionReason,
  };
}

/**
 * Convenience guarded debug logger. Routes through `redact()` so callers cannot
 * accidentally log raw PII. No-op style usage keeps production logs clean.
 */
export function logRedacted(label: string, app: KycApplication | null): void {
  // eslint-disable-next-line no-console
  console.log(label, redact(app));
}
