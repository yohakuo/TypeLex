import { createDefaultReviewState, updateReviewState } from '@/features/review/scheduling';
import { normalizeWordInput, normalizeWordKey } from '@/lib/csv/words-csv';
import { createEmptyAppData, createId } from '@/lib/storage/app-data';
import type {
  AppData,
  DictationAttempt,
  ReviewResult,
  StudyProgress,
  WordBook,
  WordEntry,
  WordInput,
} from '@/lib/types/domain';

interface MutationDeps {
  createId?: () => string;
  now?: () => string;
}

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

interface CreateBookOptions {
  kind?: WordBook['kind'];
}

interface MutationResultBase {
  ok: boolean;
  error?: string;
  data: AppData;
}

interface CreateBookResult extends MutationResultBase {
  book?: WordBook;
}

interface CreateWordResult extends MutationResultBase {
  word?: WordEntry;
}

interface ImportWordsResult {
  data: AppData;
  importedCount: number;
}

function resolveDeps(deps?: MutationDeps): Required<MutationDeps> {
  return {
    createId: deps?.createId ?? createId,
    now: deps?.now ?? (() => new Date().toISOString()),
  };
}

function hasDuplicateWord(words: WordEntry[], bookId: string, value: string, excludeWordId?: string): boolean {
  const normalized = normalizeWordKey(value);

  return words.some(
    (word) => word.bookId === bookId && word.id !== excludeWordId && normalizeWordKey(word.word) === normalized,
  );
}

function buildWordEntry(bookId: string, input: WordInput, deps?: MutationDeps): WordEntry {
  const { createId: createWordId, now } = resolveDeps(deps);
  const timestamp = now();
  const normalized = normalizeWordInput(input);

  return {
    id: createWordId(),
    bookId,
    word: normalized.word,
    meaning: normalized.meaning,
    phonetic: normalized.phonetic,
    example: normalized.example,
    exampleTranslate: normalized.exampleTranslate,
    chapter: normalized.chapter,
    notes: normalized.notes,
    sourceWordId: normalized.sourceWordId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildAttempt(params: Required<RecordAttemptParams>, deps?: MutationDeps): DictationAttempt {
  const { createId: createAttemptId } = resolveDeps(deps);

  return {
    id: createAttemptId(),
    wordId: params.wordId,
    typedAnswer: params.typedAnswer,
    isCorrect: params.isCorrect,
    answeredAt: params.answeredAt,
  };
}

export function createBookMutation(
  data: AppData,
  name: string,
  chapterSize: number = 20,
  options?: CreateBookOptions,
  deps?: MutationDeps,
): CreateBookResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { ok: false, error: 'Book name is required.', data };
  }

  const { createId: createBookId, now } = resolveDeps(deps);
  const timestamp = now();
  const book: WordBook = {
    id: createBookId(),
    name: trimmed,
    kind: options?.kind ?? 'normal',
    chapterSize,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ok: true,
    book,
    data: {
      ...data,
      books: [...data.books, book],
    },
  };
}

export function updateBookMutation(
  data: AppData,
  bookId: string,
  name: string,
  chapterSize: number,
  deps?: MutationDeps,
): MutationResultBase {
  const trimmed = name.trim();

  if (!trimmed) {
    return { ok: false, error: 'Book name is required.', data };
  }

  const bookExists = data.books.some((book) => book.id === bookId);

  if (!bookExists) {
    return { ok: false, error: 'Book not found.', data };
  }

  const { now } = resolveDeps(deps);
  const updatedAt = now();

  return {
    ok: true,
    data: {
      ...data,
      books: data.books.map((book) =>
        book.id === bookId
          ? { ...book, name: trimmed, chapterSize, updatedAt }
          : book,
      ),
    },
  };
}

export function deleteBookMutation(data: AppData, bookId: string): AppData {
  const wordIds = new Set(data.words.filter((word) => word.bookId === bookId).map((word) => word.id));
  const reviewStates = Object.fromEntries(
    Object.entries(data.reviewStates).filter(([wordId]) => !wordIds.has(wordId)),
  );

  return {
    ...data,
    books: data.books.filter((book) => book.id !== bookId),
    words: data.words.filter((word) => word.bookId !== bookId),
    reviewStates,
    attempts: data.attempts.filter((attempt) => !wordIds.has(attempt.wordId)),
    studyProgress: Object.fromEntries(
      Object.entries(data.studyProgress).filter(([, progress]) => progress.bookId !== bookId),
    ),
  };
}

export function createWordMutation(data: AppData, bookId: string, input: WordInput, deps?: MutationDeps): CreateWordResult {
  const normalized = normalizeWordInput(input);

  if (!normalized.word) {
    return { ok: false, error: 'Word is required.', data };
  }

  if (hasDuplicateWord(data.words, bookId, normalized.word)) {
    return { ok: false, error: 'This word already exists in the selected book.', data };
  }

  const word = buildWordEntry(bookId, normalized, deps);

  return {
    ok: true,
    word,
    data: {
      ...data,
      words: [...data.words, word],
      books: data.books.map((entry) =>
        entry.id === bookId
          ? {
              ...entry,
              updatedAt: word.updatedAt,
            }
          : entry,
      ),
      reviewStates: {
        ...data.reviewStates,
        [word.id]: createDefaultReviewState(word.id),
      },
    },
  };
}

export function updateWordMutation(data: AppData, wordId: string, input: WordInput, deps?: MutationDeps): MutationResultBase {
  const normalized = normalizeWordInput(input);

  if (!normalized.word) {
    return { ok: false, error: 'Word is required.', data };
  }

  const currentWord = data.words.find((word) => word.id === wordId);

  if (!currentWord) {
    return { ok: false, error: 'Word not found.', data };
  }

  if (hasDuplicateWord(data.words, currentWord.bookId, normalized.word, wordId)) {
    return { ok: false, error: 'This word already exists in the selected book.', data };
  }

  const { now } = resolveDeps(deps);
  const updatedAt = now();

  return {
    ok: true,
    data: {
      ...data,
      words: data.words.map((word) =>
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
      books: data.books.map((book) =>
        book.id === currentWord.bookId
          ? {
              ...book,
              updatedAt,
            }
          : book,
      ),
    },
  };
}

export function deleteWordMutation(data: AppData, wordId: string): AppData {
  const reviewStates = { ...data.reviewStates };
  delete reviewStates[wordId];

  return {
    ...data,
    words: data.words.filter((word) => word.id !== wordId),
    reviewStates,
    attempts: data.attempts.filter((attempt) => attempt.wordId !== wordId),
  };
}

export function importWordsMutation(
  data: AppData,
  bookId: string,
  words: WordInput[],
  deps?: MutationDeps,
): ImportWordsResult {
  const seen = new Set(
    data.words
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
    .map((word) => buildWordEntry(bookId, word, deps));

  if (entries.length === 0) {
    return { data, importedCount: 0 };
  }

  const { now } = resolveDeps(deps);
  const updatedAt = now();
  const reviewStates = { ...data.reviewStates };

  entries.forEach((word) => {
    reviewStates[word.id] = createDefaultReviewState(word.id);
  });

  return {
    importedCount: entries.length,
    data: {
      ...data,
      words: [...data.words, ...entries],
      reviewStates,
      books: data.books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              updatedAt,
            }
          : book,
      ),
    },
  };
}

export function recordAttemptMutation(data: AppData, params: RecordAttemptParams, deps?: MutationDeps): AppData {
  const { now } = resolveDeps(deps);
  const answeredAt = params.answeredAt ?? now();
  const result: ReviewResult = params.isCorrect ? 'correct' : 'incorrect';

  return {
    ...data,
    attempts: [...data.attempts, buildAttempt({ ...params, answeredAt }, deps)],
    reviewStates: {
      ...data.reviewStates,
      [params.wordId]: updateReviewState(data.reviewStates[params.wordId], params.wordId, result, answeredAt),
    },
  };
}

export function updateStudyProgressMutation(data: AppData, input: UpdateStudyProgressInput): AppData {
  return {
    ...data,
    studyProgress: {
      ...data.studyProgress,
      [input.key]: input.progress,
    },
  };
}

export function clearStudyProgressMutation(data: AppData, key: string): AppData {
  if (!(key in data.studyProgress)) {
    return data;
  }

  const studyProgress = { ...data.studyProgress };
  delete studyProgress[key];

  return {
    ...data,
    studyProgress,
  };
}

export function resetAllDataMutation(): AppData {
  return createEmptyAppData();
}
