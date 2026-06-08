/**
 * T5 — Local draft persistence (AsyncStorage).
 *
 * Stores only what is needed to resume: the application plus a local edit
 * timestamp. Keys are versioned so an old/incompatible schema is treated as
 * absent rather than crashing.
 *
 * Archive-not-delete (Hole 1): when the service becomes authoritative while an
 * unsynced local draft exists, the draft is MOVED to an archive key — never
 * silently destroyed.
 *
 * Production note: AsyncStorage is unencrypted. For real PII this would be
 * replaced by an encrypted store (expo-secure-store / Keychain / Keystore) or
 * field-level encryption before persistence. See NOTES.md.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { KycApplication, LocalDraft } from '../types/kyc';

export const ACTIVE_KEY = 'burjx.kyc.draft.v1';
export const ARCHIVE_KEY = 'burjx.kyc.draft.archived.v1';

/** Thrown when persisting a draft fails. Caller shows a non-fatal banner. */
export class DraftSaveError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DraftSaveError';
  }
}

/** Minimal shape validation so corrupt / old-schema data resolves to null. */
function isValidDraft(value: unknown): value is LocalDraft {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.localUpdatedAt !== 'string') return false;
  const app = v.application as Record<string, unknown> | undefined;
  if (typeof app !== 'object' || app === null) return false;
  return (
    typeof app.id === 'string' &&
    typeof app.status === 'string' &&
    typeof app.currentStep === 'string' &&
    typeof app.updatedAt === 'string'
  );
}

/**
 * Persist the active draft. Throws DraftSaveError if the write fails — the
 * caller keeps in-memory state and surfaces a non-fatal banner.
 */
export async function saveDraft(
  app: KycApplication,
  now: Date = new Date(),
): Promise<LocalDraft> {
  const draft: LocalDraft = {
    application: app,
    localUpdatedAt: now.toISOString(),
  };
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(draft));
    return draft;
  } catch (err) {
    throw new DraftSaveError('Failed to persist KYC draft', err);
  }
}

/**
 * Load the active draft. Returns null on absent / corrupt / read-error — never
 * throws, so boot cannot crash on bad persisted data.
 */
export async function loadDraft(): Promise<LocalDraft | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(ACTIVE_KEY);
  } catch {
    return null; // read failure -> treat as no draft
  }
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidDraft(parsed) ? parsed : null;
  } catch {
    return null; // corrupt JSON -> treat as no draft
  }
}

/**
 * Move the active draft to the archive key (Hole 1). Copies active -> archive,
 * then removes active. No-op if there is no active draft.
 */
export async function archiveDraft(): Promise<void> {
  const raw = await AsyncStorage.getItem(ACTIVE_KEY);
  if (raw == null) return;
  await AsyncStorage.setItem(ARCHIVE_KEY, raw);
  await AsyncStorage.removeItem(ACTIVE_KEY);
}

/**
 * Remove the active draft. Used ONLY when the user starts a genuinely new
 * application — never to discard unsynced edits on boot (use archiveDraft for
 * that).
 */
export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_KEY);
}
