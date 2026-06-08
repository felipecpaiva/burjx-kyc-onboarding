/**
 * E1 — Step validation.
 * Covers each required field valid/empty, DOB edge cases (empty, unparseable,
 * future, under-18 error, valid 18+ ok), whitespace document number, and
 * missing document type.
 */

import { KycApplication } from '../../types/kyc';
import {
  ageInYears,
  isPlausibleDOB,
  validateField,
  validateFields,
  validateStep,
} from '../stepValidation';

// Fixed "today" so DOB age math is deterministic.
const NOW = new Date('2026-06-08T00:00:00.000Z');

function appWith(overrides: Partial<KycApplication>): KycApplication {
  return {
    id: 'app-1',
    status: 'draft',
    currentStep: 'personal_info',
    updatedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('isPlausibleDOB', () => {
  it('rejects empty / whitespace', () => {
    expect(isPlausibleDOB('', NOW)).toBe(false);
    expect(isPlausibleDOB('   ', NOW)).toBe(false);
  });

  it('rejects unparseable date', () => {
    expect(isPlausibleDOB('not-a-date', NOW)).toBe(false);
  });

  it('rejects a future date of birth', () => {
    expect(isPlausibleDOB('2030-01-01', NOW)).toBe(false);
  });

  it('rejects under-18', () => {
    // 17 years old on NOW
    expect(isPlausibleDOB('2009-06-09', NOW)).toBe(false);
  });

  it('accepts exactly 18 today (birthday boundary)', () => {
    expect(isPlausibleDOB('2008-06-08', NOW)).toBe(true);
  });

  it('rejects someone who turns 18 tomorrow', () => {
    expect(isPlausibleDOB('2008-06-09', NOW)).toBe(false);
  });

  it('accepts comfortably 18+', () => {
    expect(isPlausibleDOB('1990-01-01', NOW)).toBe(true);
  });
});

describe('ageInYears', () => {
  it('subtracts a year when birthday has not occurred yet this year', () => {
    expect(ageInYears(new Date('2000-12-31'), new Date('2026-06-08'))).toBe(25);
    expect(ageInYears(new Date('2000-01-01'), new Date('2026-06-08'))).toBe(26);
  });
});

describe('validateField — personal_info', () => {
  it('legalName: empty fails, present passes', () => {
    expect(
      validateField('personalInfo.legalName', appWith({ personalInfo: { legalName: '', dateOfBirth: '1990-01-01', nationality: 'US' } }), NOW),
    ).toMatch(/legal name/i);
    expect(
      validateField('personalInfo.legalName', appWith({ personalInfo: { legalName: 'Ada Lovelace', dateOfBirth: '1990-01-01', nationality: 'US' } }), NOW),
    ).toBeNull();
  });

  it('nationality: empty fails, present passes', () => {
    expect(
      validateField('personalInfo.nationality', appWith({ personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: '' } }), NOW),
    ).toMatch(/nationality/i);
    expect(
      validateField('personalInfo.nationality', appWith({ personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'GB' } }), NOW),
    ).toBeNull();
  });

  it('dateOfBirth: under-18 fails with 18+ message, 18+ passes', () => {
    expect(
      validateField('personalInfo.dateOfBirth', appWith({ personalInfo: { legalName: 'Ada', dateOfBirth: '2015-01-01', nationality: 'US' } }), NOW),
    ).toMatch(/18 or older/i);
    expect(
      validateField('personalInfo.dateOfBirth', appWith({ personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' } }), NOW),
    ).toBeNull();
  });
});

describe('validateField — address', () => {
  it('country/city/line1 required', () => {
    const empty = appWith({ address: { country: '', city: '', line1: '' } });
    expect(validateField('address.country', empty, NOW)).toMatch(/country/i);
    expect(validateField('address.city', empty, NOW)).toMatch(/city/i);
    expect(validateField('address.line1', empty, NOW)).toMatch(/address line 1/i);

    const full = appWith({ address: { country: 'US', city: 'NYC', line1: '1 Main St' } });
    expect(validateField('address.country', full, NOW)).toBeNull();
    expect(validateField('address.city', full, NOW)).toBeNull();
    expect(validateField('address.line1', full, NOW)).toBeNull();
  });
});

describe('validateField — document', () => {
  it('missing document type fails', () => {
    const noType = appWith({ document: { type: undefined as never, documentNumber: 'X123' } });
    expect(validateField('document.type', noType, NOW)).toMatch(/document type/i);
  });

  it('valid document type passes', () => {
    const ok = appWith({ document: { type: 'passport', documentNumber: 'X123' } });
    expect(validateField('document.type', ok, NOW)).toBeNull();
  });

  it('whitespace-only document number fails', () => {
    const ws = appWith({ document: { type: 'passport', documentNumber: '   ' } });
    expect(validateField('document.documentNumber', ws, NOW)).toMatch(/document number/i);
  });

  it('present document number passes', () => {
    const ok = appWith({ document: { type: 'passport', documentNumber: 'AB12345' } });
    expect(validateField('document.documentNumber', ok, NOW)).toBeNull();
  });
});

describe('validateStep', () => {
  it('personal_info invalid when any owned field missing', () => {
    const app = appWith({ personalInfo: { legalName: '', dateOfBirth: '1990-01-01', nationality: 'US' } });
    const res = validateStep('personal_info', app, NOW);
    expect(res.valid).toBe(false);
    expect(res.errors.map((e) => e.field)).toContain('personalInfo.legalName');
  });

  it('personal_info valid when all owned fields present + 18+', () => {
    const app = appWith({ personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' } });
    expect(validateStep('personal_info', app, NOW).valid).toBe(true);
  });

  it('review/status steps have no required fields -> always valid', () => {
    const app = appWith({});
    expect(validateStep('review', app, NOW).valid).toBe(true);
    expect(validateStep('status', app, NOW).valid).toBe(true);
  });
});

describe('validateFields (resubmit gate — Hole 3)', () => {
  it('fails when any of multiple required fields invalid', () => {
    const app = appWith({
      personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
      document: { type: 'passport', documentNumber: '' },
    });
    const res = validateFields(
      ['personalInfo.legalName', 'document.documentNumber'],
      app,
      NOW,
    );
    expect(res.valid).toBe(false);
    expect(res.errors.map((e) => e.field)).toEqual(['document.documentNumber']);
  });

  it('passes when all listed fields valid', () => {
    const app = appWith({
      personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
      document: { type: 'passport', documentNumber: 'AB12345' },
    });
    expect(
      validateFields(['personalInfo.legalName', 'document.documentNumber'], app, NOW).valid,
    ).toBe(true);
  });
});
