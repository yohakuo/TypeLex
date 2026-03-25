import type { AppData, DictationAttempt, ReviewState, StudyProgress, WordBook, WordEntry } from '@/lib/types/domain';

export const APP_DATA_VERSION = 1;
export const STORAGE_KEY = 'wordspell.app-data.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord<T>(value: unknown): Record<string, T> {
  return isRecord(value) ? (value as Record<string, T>) : {};
}

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

export function parseAppDataSnapshot(input: unknown): AppData {
  if (!isRecord(input)) {
    return createEmptyAppData();
  }

  return {
    version: APP_DATA_VERSION,
    books: asArray<WordBook>(input.books),
    words: asArray<WordEntry>(input.words),
    reviewStates: asRecord<ReviewState>(input.reviewStates),
    attempts: asArray<DictationAttempt>(input.attempts),
    studyProgress: asRecord<StudyProgress>(input.studyProgress),
  };
}

export function parseAppDataJson(raw: string): AppData {
  try {
    return parseAppDataSnapshot(JSON.parse(raw));
  } catch {
    return createEmptyAppData();
  }
}

export function loadAppData(): AppData {
  if (typeof window === 'undefined') {
    return createEmptyAppData();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createEmptyAppData();
  }

  return parseAppDataJson(raw);
}

export function saveAppData(data: AppData): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isAppDataEmpty(data: AppData): boolean {
  return (
    data.books.length === 0
    && data.words.length === 0
    && data.attempts.length === 0
    && Object.keys(data.reviewStates).length === 0
    && Object.keys(data.studyProgress).length === 0
  );
}
