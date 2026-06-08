/**
 * E3 — Draft persistence: round-trip, clear, corrupt/error handling,
 * setItem-reject -> DraftSaveError, and archiveDraft moving active -> archive
 * (Hole 1).
 */

// Manual mock with jest.fn surfaces so each test can drive an in-memory store
// or force rejections.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { KycApplication } from '../../types/kyc';
import {
  ACTIVE_KEY,
  ARCHIVE_KEY,
  archiveDraft,
  clearDraft,
  DraftSaveError,
  loadDraft,
  saveDraft,
} from '../draftStorage';

const mockAS = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

/** Wire the mock to a simple in-memory key/value store. */
function useMemoryStore(initial: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  mockAS.getItem.mockImplementation(async (k: string) => store.get(k) ?? null);
  mockAS.setItem.mockImplementation(async (k: string, v: string) => {
    store.set(k, v);
  });
  mockAS.removeItem.mockImplementation(async (k: string) => {
    store.delete(k);
  });
  return store;
}

const app: KycApplication = {
  id: 'app-1',
  status: 'draft',
  currentStep: 'address',
  personalInfo: { legalName: 'Ada', dateOfBirth: '1990-01-01', nationality: 'US' },
  updatedAt: '2026-06-08T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('save/load round-trip', () => {
  it('persists and reloads the draft', async () => {
    useMemoryStore();
    const saved = await saveDraft(app, new Date('2026-06-08T12:00:00.000Z'));
    expect(saved.localUpdatedAt).toBe('2026-06-08T12:00:00.000Z');

    const loaded = await loadDraft();
    expect(loaded?.application.id).toBe('app-1');
    expect(loaded?.application.currentStep).toBe('address');
    expect(loaded?.localUpdatedAt).toBe('2026-06-08T12:00:00.000Z');
  });
});

describe('loadDraft resilience', () => {
  it('returns null when nothing stored', async () => {
    useMemoryStore();
    expect(await loadDraft()).toBeNull();
  });

  it('returns null on corrupt JSON', async () => {
    useMemoryStore({ [ACTIVE_KEY]: '{not valid json' });
    expect(await loadDraft()).toBeNull();
  });

  it('returns null on wrong shape (old schema)', async () => {
    useMemoryStore({ [ACTIVE_KEY]: JSON.stringify({ foo: 'bar' }) });
    expect(await loadDraft()).toBeNull();
  });

  it('returns null when getItem rejects', async () => {
    useMemoryStore();
    mockAS.getItem.mockRejectedValueOnce(new Error('disk error'));
    expect(await loadDraft()).toBeNull();
  });
});

describe('saveDraft error handling', () => {
  it('throws DraftSaveError when setItem rejects', async () => {
    useMemoryStore();
    mockAS.setItem.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(saveDraft(app)).rejects.toBeInstanceOf(DraftSaveError);
  });
});

describe('clearDraft', () => {
  it('removes the active draft -> load returns null', async () => {
    useMemoryStore();
    await saveDraft(app);
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });
});

describe('archiveDraft (Hole 1 — archive, never delete)', () => {
  it('moves active -> archive: active gone, archive present', async () => {
    const store = useMemoryStore();
    await saveDraft(app, new Date('2026-06-08T12:00:00.000Z'));
    expect(store.has(ACTIVE_KEY)).toBe(true);

    await archiveDraft();

    expect(store.has(ACTIVE_KEY)).toBe(false); // active removed
    expect(store.has(ARCHIVE_KEY)).toBe(true); // archive present
    const archived = JSON.parse(store.get(ARCHIVE_KEY) as string);
    expect(archived.application.id).toBe('app-1');
  });

  it('is a no-op when there is no active draft', async () => {
    const store = useMemoryStore();
    await archiveDraft();
    expect(store.has(ARCHIVE_KEY)).toBe(false);
  });
});
