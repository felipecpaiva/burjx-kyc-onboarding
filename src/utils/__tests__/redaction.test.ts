/**
 * Redaction — proves PII is masked before logging (security requirement:
 * "avoid logging sensitive KYC data"). This is the test backing the no-PII-in-
 * logs guarantee.
 */

import { KycApplication } from '../../types/kyc';
import { MASK, redact } from '../redaction';

const full: KycApplication = {
  id: 'app-1',
  status: 'draft',
  currentStep: 'review',
  personalInfo: { legalName: 'Ada Lovelace', dateOfBirth: '1990-01-01', nationality: 'GB' },
  address: { country: 'GB', city: 'London', line1: '10 Downing St' },
  document: { type: 'passport', documentNumber: 'X1234567' },
  requiredFields: ['document.documentNumber'],
  rejectionReason: 'n/a',
  updatedAt: '2026-06-08T00:00:00.000Z',
};

describe('redact', () => {
  it('returns null for null input', () => {
    expect(redact(null)).toBeNull();
  });

  it('masks directly-identifying fields', () => {
    const r = redact(full)!;
    expect(r.personalInfo?.legalName).toBe(MASK);
    expect(r.personalInfo?.dateOfBirth).toBe(MASK);
    expect(r.document?.documentNumber).toBe(MASK);
    expect(r.address?.line1).toBe(MASK);
  });

  it('keeps coarse / non-identifying fields for debuggability', () => {
    const r = redact(full)!;
    expect(r.id).toBe('app-1');
    expect(r.status).toBe('draft');
    expect(r.currentStep).toBe('review');
    expect(r.personalInfo?.nationality).toBe('GB');
    expect(r.address?.country).toBe('GB');
    expect(r.address?.city).toBe('London');
    expect(r.document?.type).toBe('passport');
    expect(r.hasPersonalInfo).toBe(true);
    expect(r.hasDocument).toBe(true);
  });

  it('no raw PII value survives anywhere in the serialized output', () => {
    const serialized = JSON.stringify(redact(full));
    expect(serialized).not.toContain('Ada Lovelace');
    expect(serialized).not.toContain('1990-01-01');
    expect(serialized).not.toContain('X1234567');
    expect(serialized).not.toContain('10 Downing St');
  });

  it('handles a sparse application (no sub-objects)', () => {
    const sparse: KycApplication = {
      id: 'a',
      status: 'not_started',
      currentStep: 'personal_info',
      updatedAt: '2026-06-08T00:00:00.000Z',
    };
    const r = redact(sparse)!;
    expect(r.hasPersonalInfo).toBe(false);
    expect(r.hasAddress).toBe(false);
    expect(r.hasDocument).toBe(false);
    expect(r.personalInfo).toBeUndefined();
  });
});
