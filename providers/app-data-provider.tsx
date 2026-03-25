'use client';

import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createDefaultReviewState, updateReviewState } from '@/features/review/scheduling';
import { normalizeWordInput, normalizeWordKey, parseWordsCsv } from '@/lib/csv/words-csv';
import {
  createEmptyAppData,
  createId,
  isAppDataEmpty,
  loadAppData,
  saveAppData,
} from '@/lib/storage/app-data';
import {
  createDefaultSyncMetadata,
  loadSyncMetadata,
  saveSyncMetadata,
} from '@/lib/storage/sync-metadata';
import { fetchRemoteSnapshot, upsertRemoteSnapshot } from '@/lib/sync/snapshot-store';
import { getSupabaseBrowserClient, hasSupabaseEnv } from '@/lib/sync/supabase-client';
import { reconcileSnapshot } from '@/lib/sync/reconcile';
import type {
  AppData,
  DictationAttempt,
  ReviewResult,
  StudyProgress,
  WordBook,
  WordEntry,
  WordInput,
} from '@/lib/types/domain';
import type {
  RemoteAppSnapshot,
  SyncConflictState,
  SyncMetadata,
  SyncState,
} from '@/lib/types/sync';

interface RecordAttemptParams {
  wordId: string;
  typedAnswer: string;
  isCorrect: boolean;
  answeredAt?: string;
}

interface UpdateStudyProgressInput {
  key: string;
  progress: StudyProgress;
}

interface SyncControls {
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  confirmInitialUpload: () => Promise<void>;
  resolveConflictUseRemote: () => Promise<void>;
  resolveConflictUseLocal: () => Promise<void>;
  clearError: () => void;
}

interface CreateBookOptions {
  kind?: WordBook['kind'];
}

interface AppDataContextValue {
  data: AppData;
  hydrated: boolean;
  sync: SyncState;
  syncControls: SyncControls;
  createBook: (name: string, chapterSize?: number, options?: CreateBookOptions) => { ok: boolean; error?: string; book?: WordBook };
  updateBook: (bookId: string, name: string, chapterSize: number) => { ok: boolean; error?: string };
  deleteBook: (bookId: string) => void;
  createWord: (bookId: string, input: WordInput) => { ok: boolean; error?: string; word?: WordEntry };
  updateWord: (wordId: string, input: WordInput) => { ok: boolean; error?: string };
  deleteWord: (wordId: string) => void;
  importWords: (bookId: string, words: WordInput[]) => number;
  recordAttempt: (params: RecordAttemptParams) => void;
  updateStudyProgress: (input: UpdateStudyProgressInput) => void;
  clearStudyProgress: (key: string) => void;
  resetAllData: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function hasDuplicateWord(words: WordEntry[], bookId: string, value: string, excludeWordId?: string): boolean {
  const normalized = normalizeWordKey(value);

  return words.some(
    (word) => word.bookId === bookId && word.id !== excludeWordId && normalizeWordKey(word.word) === normalized,
  );
}

function buildWordEntry(bookId: string, input: WordInput): WordEntry {
  const now = new Date().toISOString();
  const normalized = normalizeWordInput(input);

  return {
    id: createId(),
    bookId,
    word: normalized.word,
    meaning: normalized.meaning,
    phonetic: normalized.phonetic,
    example: normalized.example,
    exampleTranslate: normalized.exampleTranslate,
    chapter: normalized.chapter,
    notes: normalized.notes,
    sourceWordId: normalized.sourceWordId,
    createdAt: now,
    updatedAt: now,
  };
}

function buildAttempt(params: Required<RecordAttemptParams>): DictationAttempt {
  return {
    id: createId(),
    wordId: params.wordId,
    typedAnswer: params.typedAnswer,
    isCorrect: params.isCorrect,
    answeredAt: params.answeredAt,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '同步失败，请稍后重试。';
}

function getSyncStatusLabel(sync: {
  available: boolean;
  session: Session | null;
  authReady: boolean;
  isBusy: boolean;
  isOnline: boolean;
  errorMessage: string | null;
  metadata: SyncMetadata;
  conflict: SyncConflictState | null;
}): SyncState['statusLabel'] {
  if (!sync.available) {
    return '本地模式';
  }

  if (!sync.authReady) {
    return '检查登录中';
  }

  if (!sync.session) {
    return '开启同步';
  }

  if (sync.conflict) {
    return '冲突待处理';
  }

  if (sync.metadata.pendingInitialUpload) {
    return '确认首次上传';
  }

  if (!sync.isOnline) {
    return sync.metadata.dirty ? '离线待同步' : '离线';
  }

  if (sync.isBusy) {
    return '同步中';
  }

  if (sync.errorMessage) {
    return '同步出错';
  }

  if (sync.metadata.dirty) {
    return '待同步';
  }

  return '已同步';
}

function getSyncStatus(sync: {
  available: boolean;
  session: Session | null;
  authReady: boolean;
  isBusy: boolean;
  isOnline: boolean;
  errorMessage: string | null;
  metadata: SyncMetadata;
  conflict: SyncConflictState | null;
}): SyncState['status'] {
  if (!sync.available) {
    return 'disabled';
  }

  if (!sync.authReady) {
    return 'checking';
  }

  if (!sync.session) {
    return 'signed-out';
  }

  if (sync.conflict) {
    return 'conflict';
  }

  if (sync.metadata.pendingInitialUpload) {
    return 'needs-initial-upload';
  }

  if (!sync.isOnline) {
    return 'offline';
  }

  if (sync.errorMessage) {
    return 'error';
  }

  if (sync.isBusy) {
    return 'checking';
  }

  if (sync.metadata.dirty) {
    return 'pending';
  }

  return 'synced';
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(createEmptyAppData);
  const [hydrated, setHydrated] = useState(false);
  const [metadata, setMetadataState] = useState<SyncMetadata>(createDefaultSyncMetadata);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SyncConflictState | null>(null);

  const dataRef = useRef(data);
  const metadataRef = useRef(metadata);
  const sessionRef = useRef(session);
  const clientRef = useRef<SupabaseClient | null>(null);
  const isOnlineRef = useRef(isOnline);
  const syncingRef = useRef(false);
  const seedAttemptedRef = useRef(false);

  const syncAvailable = hasSupabaseEnv();

  const replaceData = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const updateMetadata = useCallback((updater: (current: SyncMetadata) => SyncMetadata) => {
    const next = updater(metadataRef.current);
    metadataRef.current = next;
    setMetadataState(next);
    saveSyncMetadata(next);
    return next;
  }, []);

  const markLocalDirty = useCallback(() => {
    updateMetadata((current) => ({
      ...current,
      dirty: true,
    }));
  }, [updateMetadata]);

  const applyLocalChange = useCallback((updater: (current: AppData) => AppData) => {
    const current = dataRef.current;
    const next = updater(current);

    if (next === current) {
      return current;
    }

    replaceData(next);
    markLocalDirty();
    setConflict((currentConflict) => currentConflict ? { ...currentConflict, localData: next } : currentConflict);
    return next;
  }, [markLocalDirty, replaceData]);

  const applyRemoteSnapshot = useCallback((remote: RemoteAppSnapshot, userId: string) => {
    replaceData(remote.snapshot);
    setConflict(null);
    setSyncErrorMessage(null);
    updateMetadata((current) => ({
      ...current,
      dirty: false,
      pendingInitialUpload: false,
      lastSyncedAt: new Date().toISOString(),
      lastRemoteUpdatedAt: remote.updatedAt,
      lastSyncedUserId: userId,
    }));
  }, [replaceData, updateMetadata]);

  const pushCurrentSnapshot = useCallback(async (snapshot: AppData, userId: string) => {
    const client = clientRef.current;

    if (!client) {
      throw new Error('Supabase client is not available.');
    }

    const remote = await upsertRemoteSnapshot(client, userId, snapshot, metadataRef.current.deviceId);
    setConflict(null);
    setSyncErrorMessage(null);
    updateMetadata((current) => ({
      ...current,
      dirty: false,
      pendingInitialUpload: false,
      lastSyncedAt: new Date().toISOString(),
      lastRemoteUpdatedAt: remote.updatedAt,
      lastSyncedUserId: userId,
    }));
  }, [updateMetadata]);

  const runSync = useCallback(async () => {
    const currentSession = sessionRef.current;
    const client = clientRef.current;

    if (!syncAvailable || !currentSession || !client || !isOnlineRef.current || syncingRef.current) {
      return;
    }

    syncingRef.current = true;
    setIsSyncBusy(true);
    setSyncErrorMessage(null);

    try {
      const remote = await fetchRemoteSnapshot(client, currentSession.user.id);
      const currentMetadata = metadataRef.current;
      const lastRemoteUpdatedAt = currentMetadata.lastSyncedUserId === currentSession.user.id
        ? currentMetadata.lastRemoteUpdatedAt
        : null;
      const action = reconcileSnapshot({
        localData: dataRef.current,
        localDirty: currentMetadata.dirty,
        lastRemoteUpdatedAt,
        remoteSnapshot: remote,
        online: true,
      });

      if (action.type === 'pull' && remote) {
        applyRemoteSnapshot(remote, currentSession.user.id);
      } else if (action.type === 'push') {
        await pushCurrentSnapshot(dataRef.current, currentSession.user.id);
      } else if (action.type === 'confirm-initial-upload') {
        updateMetadata((current) => ({
          ...current,
          pendingInitialUpload: true,
          lastSyncedUserId: currentSession.user.id,
        }));
        setConflict(null);
      } else if (action.type === 'conflict' && remote) {
        setConflict({
          localData: dataRef.current,
          remoteSnapshot: remote,
        });
      } else if (remote) {
        updateMetadata((current) => ({
          ...current,
          dirty: false,
          lastSyncedAt: new Date().toISOString(),
          lastRemoteUpdatedAt: remote.updatedAt,
          lastSyncedUserId: currentSession.user.id,
        }));
        setConflict(null);
      }
    } catch (error) {
      setSyncErrorMessage(getErrorMessage(error));
    } finally {
      syncingRef.current = false;
      setIsSyncBusy(false);
    }
  }, [applyRemoteSnapshot, pushCurrentSnapshot, syncAvailable, updateMetadata]);

  const seedDefaultBook = useCallback(async () => {
    if (seedAttemptedRef.current || !isAppDataEmpty(dataRef.current)) {
      return;
    }

    seedAttemptedRef.current = true;

    try {
      const res = await fetch('/王陆807.csv');
      if (!res.ok) {
        throw new Error('Failed to fetch default dict');
      }

      const text = await res.text();
      const parsed = parseWordsCsv(text);
      if (parsed.rows.length === 0) {
        return;
      }

      const now = new Date().toISOString();
      const bookId = createId();
      const book: WordBook = {
        id: bookId,
        name: '王陆807',
        chapterSize: 20,
        kind: 'normal',
        createdAt: now,
        updatedAt: now,
      };

      const entries: WordEntry[] = parsed.rows.map((row) => {
        const normalized = normalizeWordInput(row);

        return {
          id: createId(),
          bookId,
          word: normalized.word.toLowerCase(),
          meaning: normalized.meaning,
          phonetic: normalized.phonetic,
          example: normalized.example,
          exampleTranslate: normalized.exampleTranslate,
          chapter: normalized.chapter,
          notes: normalized.notes,
          sourceWordId: normalized.sourceWordId,
          createdAt: now,
          updatedAt: now,
        };
      });

      const nextReviewStates = Object.fromEntries(
        entries.map((word) => [word.id, createDefaultReviewState(word.id)]),
      );

      applyLocalChange(() => ({
        ...createEmptyAppData(),
        books: [book],
        words: entries,
        reviewStates: nextReviewStates,
      }));
    } catch (error) {
      console.error(error);
    }
  }, [applyLocalChange]);

  useEffect(() => {
    const loaded = loadAppData();
    const loadedMetadata = loadSyncMetadata();

    replaceData(loaded);
    metadataRef.current = loadedMetadata;
    setMetadataState(loadedMetadata);
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    setHydrated(true);
  }, [replaceData]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveAppData(data);
  }, [data, hydrated]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    clientRef.current = client;

    if (!client) {
      setAuthReady(true);
      return;
    }

    let active = true;

    client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setSyncErrorMessage(getErrorMessage(error));
      }

      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setSyncErrorMessage(null);
      setConflict(null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !authReady) {
      return;
    }

    if (!session?.user.id) {
      setConflict(null);
      return;
    }

    if (metadataRef.current.lastSyncedUserId === session.user.id) {
      return;
    }

    updateMetadata((current) => ({
      ...current,
      lastSyncedAt: null,
      lastRemoteUpdatedAt: null,
      lastSyncedUserId: session.user.id,
      pendingInitialUpload: false,
    }));
  }, [authReady, hydrated, session?.user.id, updateMetadata]);

  useEffect(() => {
    if (!hydrated || !authReady) {
      return;
    }

    if (!isAppDataEmpty(dataRef.current)) {
      return;
    }

    void seedDefaultBook();
  }, [authReady, hydrated, seedDefaultBook]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [hydrated]);

  const createBook = useCallback((name: string, chapterSize: number = 20, options?: CreateBookOptions) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, error: 'Book name is required.' };
    }

    const now = new Date().toISOString();
    const book: WordBook = {
      id: createId(),
      name: trimmed,
      kind: options?.kind ?? 'normal',
      chapterSize,
      createdAt: now,
      updatedAt: now,
    };

    applyLocalChange((current) => ({
      ...current,
      books: [...current.books, book],
    }));

    return { ok: true, book };
  }, [applyLocalChange]);

  const updateBook = useCallback((bookId: string, name: string, chapterSize: number) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, error: 'Book name is required.' };
    }

    const currentData = dataRef.current;
    const bookExists = currentData.books.some((book) => book.id === bookId);

    if (!bookExists) {
      return { ok: false, error: 'Book not found.' };
    }

    applyLocalChange((current) => ({
      ...current,
      books: current.books.map((book) =>
        book.id === bookId
          ? { ...book, name: trimmed, chapterSize, updatedAt: new Date().toISOString() }
          : book,
      ),
    }));

    return { ok: true };
  }, [applyLocalChange]);

  const deleteBook = useCallback((bookId: string) => {
    applyLocalChange((current) => {
      const wordIds = new Set(current.words.filter((word) => word.bookId === bookId).map((word) => word.id));
      const nextReviewStates = Object.fromEntries(
        Object.entries(current.reviewStates).filter(([wordId]) => !wordIds.has(wordId)),
      );

      return {
        ...current,
        books: current.books.filter((book) => book.id !== bookId),
        words: current.words.filter((word) => word.bookId !== bookId),
        reviewStates: nextReviewStates,
        attempts: current.attempts.filter((attempt) => !wordIds.has(attempt.wordId)),
        studyProgress: Object.fromEntries(
          Object.entries(current.studyProgress).filter(([, progress]) => progress.bookId !== bookId),
        ),
      };
    });
  }, [applyLocalChange]);

  const createWord = useCallback((bookId: string, input: WordInput) => {
    const normalized = normalizeWordInput(input);
    const currentData = dataRef.current;

    if (!normalized.word) {
      return { ok: false, error: 'Word is required.' };
    }

    if (hasDuplicateWord(currentData.words, bookId, normalized.word)) {
      return { ok: false, error: 'This word already exists in the selected book.' };
    }

    const word = buildWordEntry(bookId, normalized);

    applyLocalChange((current) => ({
      ...current,
      words: [...current.words, word],
      books: current.books.map((entry) =>
        entry.id === bookId
          ? {
              ...entry,
              updatedAt: word.updatedAt,
            }
          : entry,
      ),
      reviewStates: {
        ...current.reviewStates,
        [word.id]: createDefaultReviewState(word.id),
      },
    }));

    return { ok: true, word };
  }, [applyLocalChange]);

  const updateWord = useCallback((wordId: string, input: WordInput) => {
    const normalized = normalizeWordInput(input);
    const currentData = dataRef.current;

    if (!normalized.word) {
      return { ok: false, error: 'Word is required.' };
    }

    const currentWord = currentData.words.find((word) => word.id === wordId);

    if (!currentWord) {
      return { ok: false, error: 'Word not found.' };
    }

    if (hasDuplicateWord(currentData.words, currentWord.bookId, normalized.word, wordId)) {
      return { ok: false, error: 'This word already exists in the selected book.' };
    }

    applyLocalChange((current) => {
      const updatedAt = new Date().toISOString();

      return {
        ...current,
        words: current.words.map((word) =>
          word.id === wordId
            ? {
                ...word,
                word: normalized.word,
                meaning: normalized.meaning,
                phonetic: normalized.phonetic,
                example: normalized.example,
                exampleTranslate: normalized.exampleTranslate,
                chapter: normalized.chapter,
                notes: normalized.notes,
                sourceWordId: normalized.sourceWordId ?? word.sourceWordId,
                updatedAt,
              }
            : word,
        ),
        books: current.books.map((book) =>
          book.id === currentWord.bookId
            ? {
                ...book,
                updatedAt,
              }
            : book,
        ),
      };
    });

    return { ok: true };
  }, [applyLocalChange]);

  const deleteWord = useCallback((wordId: string) => {
    applyLocalChange((current) => {
      const nextReviewStates = { ...current.reviewStates };
      delete nextReviewStates[wordId];

      return {
        ...current,
        words: current.words.filter((word) => word.id !== wordId),
        reviewStates: nextReviewStates,
        attempts: current.attempts.filter((attempt) => attempt.wordId !== wordId),
      };
    });
  }, [applyLocalChange]);

  const importWords = useCallback((bookId: string, words: WordInput[]) => {
    const currentData = dataRef.current;
    const seen = new Set(
      currentData.words
        .filter((word) => word.bookId === bookId)
        .map((word) => normalizeWordKey(word.word)),
    );

    const entries = words
      .map((word) => normalizeWordInput(word))
      .filter((word) => {
        if (!word.word) {
          return false;
        }

        const normalized = normalizeWordKey(word.word);

        if (seen.has(normalized)) {
          return false;
        }

        seen.add(normalized);
        return true;
      })
      .map((word) => buildWordEntry(bookId, word));

    if (entries.length === 0) {
      return 0;
    }

    applyLocalChange((current) => {
      const nextReviewStates = { ...current.reviewStates };

      entries.forEach((word) => {
        nextReviewStates[word.id] = createDefaultReviewState(word.id);
      });

      return {
        ...current,
        words: [...current.words, ...entries],
        reviewStates: nextReviewStates,
        books: current.books.map((book) =>
          book.id === bookId
            ? {
                ...book,
                updatedAt: new Date().toISOString(),
              }
            : book,
        ),
      };
    });

    return entries.length;
  }, [applyLocalChange]);

  const recordAttempt = useCallback((params: RecordAttemptParams) => {
    const answeredAt = params.answeredAt ?? new Date().toISOString();
    const result: ReviewResult = params.isCorrect ? 'correct' : 'incorrect';

    applyLocalChange((current) => ({
      ...current,
      attempts: [...current.attempts, buildAttempt({ ...params, answeredAt })],
      reviewStates: {
        ...current.reviewStates,
        [params.wordId]: updateReviewState(current.reviewStates[params.wordId], params.wordId, result, answeredAt),
      },
    }));
  }, [applyLocalChange]);

  const updateStudyProgress = useCallback(({ key, progress }: UpdateStudyProgressInput) => {
    applyLocalChange((current) => ({
      ...current,
      studyProgress: {
        ...current.studyProgress,
        [key]: progress,
      },
    }));
  }, [applyLocalChange]);

  const clearStudyProgress = useCallback((key: string) => {
    applyLocalChange((current) => {
      if (!(key in current.studyProgress)) {
        return current;
      }

      const nextStudyProgress = { ...current.studyProgress };
      delete nextStudyProgress[key];

      return {
        ...current,
        studyProgress: nextStudyProgress,
      };
    });
  }, [applyLocalChange]);

  const resetAllData = useCallback(() => {
    applyLocalChange(() => createEmptyAppData());
  }, [applyLocalChange]);

  const sendMagicLink = useCallback(async (email: string) => {
    const client = clientRef.current;

    if (!client) {
      return { ok: false, error: 'Supabase environment variables are not configured.' };
    }

    const trimmed = email.trim();
    if (!trimmed) {
      return { ok: false, error: '请输入邮箱地址。' };
    }

    const { error } = await client.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: typeof window === 'undefined' ? undefined : `${window.location.origin}/settings`,
      },
    });

    if (error) {
      return { ok: false, error: getErrorMessage(error) };
    }

    setSyncErrorMessage(null);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const client = clientRef.current;

    if (!client) {
      return;
    }

    const { error } = await client.auth.signOut();
    if (error) {
      setSyncErrorMessage(getErrorMessage(error));
      return;
    }

    setConflict(null);
    setSyncErrorMessage(null);
  }, []);

  const confirmInitialUpload = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      return;
    }

    setIsSyncBusy(true);
    setSyncErrorMessage(null);

    try {
      await pushCurrentSnapshot(dataRef.current, currentSession.user.id);
    } catch (error) {
      setSyncErrorMessage(getErrorMessage(error));
    } finally {
      setIsSyncBusy(false);
    }
  }, [pushCurrentSnapshot]);

  const resolveConflictUseRemote = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!currentSession || !conflict) {
      return;
    }

    applyRemoteSnapshot(conflict.remoteSnapshot, currentSession.user.id);
  }, [applyRemoteSnapshot, conflict]);

  const resolveConflictUseLocal = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      return;
    }

    setIsSyncBusy(true);
    setSyncErrorMessage(null);

    try {
      await pushCurrentSnapshot(dataRef.current, currentSession.user.id);
    } catch (error) {
      setSyncErrorMessage(getErrorMessage(error));
    } finally {
      setIsSyncBusy(false);
    }
  }, [pushCurrentSnapshot]);

  const clearError = useCallback(() => {
    setSyncErrorMessage(null);
  }, []);

  const sync = useMemo<SyncState>(() => {
    const base = {
      available: syncAvailable,
      session,
      authReady,
      isBusy: isSyncBusy,
      isOnline,
      errorMessage: syncErrorMessage,
      metadata,
      conflict,
    };

    return {
      available: syncAvailable,
      status: getSyncStatus(base),
      statusLabel: getSyncStatusLabel(base),
      isOnline,
      isBusy: isSyncBusy,
      email: session?.user.email ?? null,
      session,
      errorMessage: syncErrorMessage,
      metadata,
      conflict,
    };
  }, [authReady, conflict, isOnline, isSyncBusy, metadata, session, syncAvailable, syncErrorMessage]);

  const syncControls = useMemo<SyncControls>(() => ({
    sendMagicLink,
    signOut,
    syncNow: async () => {
      await runSync();
    },
    confirmInitialUpload,
    resolveConflictUseRemote,
    resolveConflictUseLocal,
    clearError,
  }), [clearError, confirmInitialUpload, resolveConflictUseLocal, resolveConflictUseRemote, runSync, sendMagicLink, signOut]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      hydrated,
      sync,
      syncControls,
      createBook,
      updateBook,
      deleteBook,
      createWord,
      updateWord,
      deleteWord,
      importWords,
      recordAttempt,
      updateStudyProgress,
      clearStudyProgress,
      resetAllData,
    }),
    [
      clearStudyProgress,
      createBook,
      createWord,
      data,
      deleteBook,
      deleteWord,
      hydrated,
      importWords,
      recordAttempt,
      resetAllData,
      sync,
      syncControls,
      updateBook,
      updateStudyProgress,
      updateWord,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }

  return context;
}

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated } = useAppData();

  if (!hydrated) {
    return <section className="panel">Loading your local study data...</section>;
  }

  return <>{children}</>;
}

export function PrimaryActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="button">
      {children}
    </Link>
  );
}
