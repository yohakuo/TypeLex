import type { AppData } from '@/lib/types/domain';

export const APP_DATA_VERSION = 1;
export const STORAGE_KEY = 'wordspell.app-data.v1';

export function createEmptyAppData(): AppData {
  return {
    version: APP_DATA_VERSION,
    books: [],
    words: [],
    reviewStates: {},
    attempts: [],
    studyProgress: {},
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadAppData(): AppData {
  if (typeof window === 'undefined') {
    return createEmptyAppData();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createEmptyAppData();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;

    if (parsed.version !== APP_DATA_VERSION) {
      return createEmptyAppData();
    }

    return {
      version: APP_DATA_VERSION,
      books: Array.isArray(parsed.books) ? parsed.books : [],
      words: Array.isArray(parsed.words) ? parsed.words : [],
      reviewStates: parsed.reviewStates && typeof parsed.reviewStates === 'object' ? parsed.reviewStates : {},
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      studyProgress: parsed.studyProgress && typeof parsed.studyProgress === 'object' ? parsed.studyProgress : {},
    };
  } catch {
    return createEmptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
