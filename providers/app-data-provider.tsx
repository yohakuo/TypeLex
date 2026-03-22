'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createDefaultReviewState, updateReviewState } from '@/features/review/scheduling';
import { createEmptyAppData, createId, loadAppData, saveAppData } from '@/lib/storage/app-data';
import { parseWordsCsv } from '@/lib/csv/words-csv';
import type {
  AppData,
  DictationAttempt,
  ReviewResult,
  StudyProgress,
  WordBook,
  WordEntry,
  WordInput,
} from '@/lib/types/domain';

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

interface AppDataContextValue {
  data: AppData;
  hydrated: boolean;
  createBook: (name: string, chapterSize?: number) => { ok: boolean; error?: string; book?: WordBook };
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

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeWordInput(input: WordInput): WordInput {
  return {
    word: input.word.trim(),
    meaning: normalizeOptionalText(input.meaning),
    example: normalizeOptionalText(input.example),
    notes: normalizeOptionalText(input.notes),
  };
}

function hasDuplicateWord(words: WordEntry[], bookId: string, value: string, excludeWordId?: string): boolean {
  const normalized = value.trim().toLowerCase();

  return words.some(
    (word) => word.bookId === bookId && word.id !== excludeWordId && word.word.trim().toLowerCase() === normalized,
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
    example: normalized.example,
    notes: normalized.notes,
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

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(createEmptyAppData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadAppData();
    setData(loaded);
    setHydrated(true);

    if (loaded.books.length === 0) {
      fetch('/王陆807.csv')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch default dict');
          return res.text();
        })
        .then((text) => {
          const parsed = parseWordsCsv(text);
          if (parsed.rows.length > 0) {
            setData((current) => {
              if (current.books.length > 0) return current;

              const now = new Date().toISOString();
              const bookId = createId();
              const book: WordBook = {
                id: bookId,
                name: '王陆807',
                chapterSize: 20,
                createdAt: now,
                updatedAt: now,
              };

              const entries: WordEntry[] = parsed.rows.map((row) => ({
                id: createId(),
                bookId,
                word: row.word.trim().toLowerCase(),
                meaning: row.meaning?.trim(),
                example: row.example?.trim(),
                notes: row.notes?.trim(),
                createdAt: now,
                updatedAt: now,
              }));

              const nextReviewStates = { ...current.reviewStates };
              entries.forEach((word) => {
                nextReviewStates[word.id] = createDefaultReviewState(word.id);
              });

              return {
                ...current,
                books: [book],
                words: entries,
                reviewStates: nextReviewStates,
              };
            });
          }
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveAppData(data);
  }, [data, hydrated]);

  const createBook = useCallback((name: string, chapterSize: number = 20) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, error: 'Book name is required.' };
    }

    const now = new Date().toISOString();
    const book: WordBook = {
      id: createId(),
      name: trimmed,
      chapterSize,
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      books: [...current.books, book],
    }));

    return { ok: true, book };
  }, []);

  const updateBook = useCallback((bookId: string, name: string, chapterSize: number) => {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, error: 'Book name is required.' };
    }

    setData((current) => {
      const bookExists = current.books.some(b => b.id === bookId);
      if (!bookExists) return current;

      return {
        ...current,
        books: current.books.map(b => b.id === bookId ? { ...b, name: trimmed, chapterSize, updatedAt: new Date().toISOString() } : b)
      };
    });

    return { ok: true };
  }, []);

  const deleteBook = useCallback((bookId: string) => {
    setData((current) => {
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
  }, []);

  const createWord = useCallback((bookId: string, input: WordInput) => {
    const normalized = normalizeWordInput(input);

    if (!normalized.word) {
      return { ok: false, error: 'Word is required.' };
    }

    if (hasDuplicateWord(data.words, bookId, normalized.word)) {
      return { ok: false, error: 'This word already exists in the selected book.' };
    }

    const word = buildWordEntry(bookId, normalized);

    setData((current) => {
      const nextWords = [...current.words, word];
      const book = current.books.find((entry) => entry.id === bookId);

      return {
        ...current,
        words: nextWords,
        books: current.books.map((entry) =>
          entry.id === bookId && book
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
      };
    });

    return { ok: true, word };
  }, [data.words]);

  const updateWord = useCallback((wordId: string, input: WordInput) => {
    const normalized = normalizeWordInput(input);

    if (!normalized.word) {
      return { ok: false, error: 'Word is required.' };
    }

    const currentWord = data.words.find((word) => word.id === wordId);

    if (!currentWord) {
      return { ok: false, error: 'Word not found.' };
    }

    if (hasDuplicateWord(data.words, currentWord.bookId, normalized.word, wordId)) {
      return { ok: false, error: 'This word already exists in the selected book.' };
    }

    setData((current) => {
      const updatedAt = new Date().toISOString();
      const nextWords = current.words.map((word) =>
        word.id === wordId
          ? {
              ...word,
              word: normalized.word,
              meaning: normalized.meaning,
              example: normalized.example,
              notes: normalized.notes,
              updatedAt,
            }
          : word,
      );

      return {
        ...current,
        words: nextWords,
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
  }, [data.words]);

  const deleteWord = useCallback((wordId: string) => {
    setData((current) => {
      const nextReviewStates = { ...current.reviewStates };
      delete nextReviewStates[wordId];

      return {
        ...current,
        words: current.words.filter((word) => word.id !== wordId),
        reviewStates: nextReviewStates,
        attempts: current.attempts.filter((attempt) => attempt.wordId !== wordId),
      };
    });
  }, []);

  const importWords = useCallback((bookId: string, words: WordInput[]) => {
    const seen = new Set(
      data.words
        .filter((word) => word.bookId === bookId)
        .map((word) => word.word.trim().toLowerCase()),
    );

    const entries = words
      .map((word) => normalizeWordInput(word))
      .filter((word) => {
        if (!word.word) {
          return false;
        }

        const normalized = word.word.toLowerCase();

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

    setData((current) => {
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
  }, [data.words]);

  const recordAttempt = useCallback((params: RecordAttemptParams) => {
    const answeredAt = params.answeredAt ?? new Date().toISOString();
    const result: ReviewResult = params.isCorrect ? 'correct' : 'incorrect';

    setData((current) => ({
      ...current,
      attempts: [...current.attempts, buildAttempt({ ...params, answeredAt })],
      reviewStates: {
        ...current.reviewStates,
        [params.wordId]: updateReviewState(current.reviewStates[params.wordId], params.wordId, result, answeredAt),
      },
    }));
  }, []);

  const updateStudyProgress = useCallback(({ key, progress }: UpdateStudyProgressInput) => {
    setData((current) => ({
      ...current,
      studyProgress: {
        ...current.studyProgress,
        [key]: progress,
      },
    }));
  }, []);

  const clearStudyProgress = useCallback((key: string) => {
    setData((current) => {
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
  }, []);

  const resetAllData = useCallback(() => {
    setData(createEmptyAppData());
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      hydrated,
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
