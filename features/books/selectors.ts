import type { AppData, DictationAttempt, StudyProgress, WordBook, WordEntry } from '@/lib/types/domain';

export interface ResolvedStudyProgress {
  currentIndex: number;
  completedCount: number;
  totalWords: number;
  isCompleted: boolean;
}

export type ChapterStudyStatus = 'last-studied' | 'completed' | 'in-progress' | 'unstarted';

export interface ChapterStudyProgress extends ResolvedStudyProgress {
  chapter: number;
  label: string;
  hasExplicitLabel: boolean;
  size: number;
  startWordNumber: number;
  endWordNumber: number;
  words: WordEntry[];
  isLastStudied: boolean;
  status: ChapterStudyStatus;
  lastStudiedAt?: string;
}

export interface BookStudyProgressSummary {
  totalWords: number;
  completedCount: number;
  totalChapters: number;
  usesExplicitChapters: boolean;
  chapters: ChapterStudyProgress[];
}

export interface StudyNavigationTarget {
  chapter: number;
  wordId?: string;
}

interface ChapterWordGroup {
  label: string;
  hasExplicitLabel: boolean;
  size: number;
  startWordNumber: number;
  endWordNumber: number;
  words: WordEntry[];
}

function isWrongWordsBook(book: WordBook | undefined): boolean {
  return book?.kind === 'wrong-words' || book?.name === '错词本';
}

function getTimestamp(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getWordFallbackTimestamp(word: WordEntry): number {
  return getTimestamp(word.updatedAt) ?? getTimestamp(word.createdAt) ?? 0;
}

function buildLatestIncorrectAttemptIndex(attempts: DictationAttempt[]): Map<string, number> {
  const latestIncorrectAttemptByWordId = new Map<string, number>();

  attempts.forEach((attempt) => {
    if (attempt.isCorrect) {
      return;
    }

    const timestamp = getTimestamp(attempt.answeredAt);
    if (timestamp === null) {
      return;
    }

    const current = latestIncorrectAttemptByWordId.get(attempt.wordId);
    if (current === undefined || timestamp > current) {
      latestIncorrectAttemptByWordId.set(attempt.wordId, timestamp);
    }
  });

  return latestIncorrectAttemptByWordId;
}

function sortWrongWordsByRecentMistake(words: WordEntry[], attempts: DictationAttempt[]): WordEntry[] {
  const latestIncorrectAttemptByWordId = buildLatestIncorrectAttemptIndex(attempts);

  return words
    .map((word, index) => ({
      word,
      index,
      recentMistakeAt: word.sourceWordId
        ? latestIncorrectAttemptByWordId.get(word.sourceWordId) ?? null
        : null,
      fallbackAt: getWordFallbackTimestamp(word),
    }))
    .sort((left, right) => {
      const recentMistakeDiff = (right.recentMistakeAt ?? -1) - (left.recentMistakeAt ?? -1);
      if (recentMistakeDiff !== 0) {
        return recentMistakeDiff;
      }

      const fallbackDiff = right.fallbackAt - left.fallbackAt;
      if (fallbackDiff !== 0) {
        return fallbackDiff;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.word);
}

export function getBookWords(data: AppData, bookId: string): WordEntry[] {
  return data.words.filter((word) => word.bookId === bookId);
}

export function getBookById(data: AppData, bookId: string): WordBook | undefined {
  return data.books.find((book) => book.id === bookId);
}

export function getBookStats(data: AppData, bookId: string, now: Date) {
  const words = getBookWords(data, bookId);
  const dueCount = words.filter((word) => {
    const nextReviewAt = data.reviewStates[word.id]?.nextReviewAt;
    return nextReviewAt ? new Date(nextReviewAt).getTime() <= now.getTime() : false;
  }).length;
  const missedCount = words.filter((word) => data.reviewStates[word.id]?.lastResult === 'incorrect').length;

  return {
    totalWords: words.length,
    dueCount,
    missedCount,
  };
}

export function getStudyProgressKey(bookId: string, chapter: number, size: number): string {
  return `${bookId}:${chapter}:${size}`;
}

export function resolveStudyProgress(progress: StudyProgress | undefined, totalWords: number): ResolvedStudyProgress {
  if (totalWords <= 0) {
    return {
      currentIndex: 0,
      completedCount: 0,
      totalWords,
      isCompleted: false,
    };
  }

  const completedCount = Math.min(Math.max(progress?.completedCount ?? 0, 0), totalWords);
  const isCompleted = completedCount >= totalWords;
  const currentIndex = isCompleted
    ? 0
    : Math.min(Math.max(progress?.currentIndex ?? 0, 0), totalWords - 1);

  return {
    currentIndex,
    completedCount,
    totalWords,
    isCompleted,
  };
}

function normalizeChapterLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getProgressTimestamp(progress: StudyProgress | undefined): number | null {
  return getTimestamp(progress?.updatedAt);
}

function buildExplicitChapterGroups(words: WordEntry[]): ChapterWordGroup[] {
  const chapterMap = new Map<string, ChapterWordGroup>();

  words.forEach((word, index) => {
    const label = normalizeChapterLabel(word.chapter) ?? '未分组';
    const existing = chapterMap.get(label);

    if (existing) {
      existing.words.push(word);
      existing.size += 1;
      existing.endWordNumber = index + 1;
      return;
    }

    chapterMap.set(label, {
      label,
      hasExplicitLabel: normalizeChapterLabel(word.chapter) !== undefined,
      size: 1,
      startWordNumber: index + 1,
      endWordNumber: index + 1,
      words: [word],
    });
  });

  return Array.from(chapterMap.values());
}

function buildFixedSizeChapterGroups(words: WordEntry[], chapterSize: number, labelUnit: '章' | '组' = '章'): ChapterWordGroup[] {
  const safeChapterSize = chapterSize > 0 ? chapterSize : 20;
  const totalChapters = Math.ceil(words.length / safeChapterSize);

  return Array.from({ length: totalChapters }, (_, index) => {
    const chapterWords = words.slice(index * safeChapterSize, (index + 1) * safeChapterSize);

    return {
      label: `第 ${index + 1} ${labelUnit}`,
      hasExplicitLabel: false,
      size: safeChapterSize,
      startWordNumber: index * safeChapterSize + 1,
      endWordNumber: index * safeChapterSize + chapterWords.length,
      words: chapterWords,
    };
  });
}

function buildChapterWordGroups(data: AppData, bookId: string, chapterSize: number): {
  usesExplicitChapters: boolean;
  groups: ChapterWordGroup[];
} {
  const book = getBookById(data, bookId);
  const words = getBookWords(data, bookId);

  if (isWrongWordsBook(book)) {
    const sortedWords = sortWrongWordsByRecentMistake(words, data.attempts);

    return {
      usesExplicitChapters: false,
      groups: buildFixedSizeChapterGroups(sortedWords, chapterSize, '组'),
    };
  }

  const usesExplicitChapters = words.some((word) => normalizeChapterLabel(word.chapter) !== undefined);

  return {
    usesExplicitChapters,
    groups: usesExplicitChapters
      ? buildExplicitChapterGroups(words)
      : buildFixedSizeChapterGroups(words, chapterSize),
  };
}

export function getBookStudyChapters(data: AppData, bookId: string, chapterSize: number): ChapterStudyProgress[] {
  const { groups } = buildChapterWordGroups(data, bookId, chapterSize);

  const chaptersWithProgress = groups.map((group, index) => {
    const chapter = index + 1;
    const size = group.size;
    const rawProgress = data.studyProgress[getStudyProgressKey(bookId, chapter, size)];
    const resolved = resolveStudyProgress(rawProgress, group.words.length);

    return {
      chapter,
      label: group.label,
      hasExplicitLabel: group.hasExplicitLabel,
      size,
      startWordNumber: group.startWordNumber,
      endWordNumber: group.endWordNumber,
      words: group.words,
      lastStudiedAt: rawProgress?.updatedAt,
      progressTimestamp: getProgressTimestamp(rawProgress),
      ...resolved,
    };
  });

  const lastStudiedChapter = chaptersWithProgress.reduce<{ chapter: number; timestamp: number } | null>((latest, chapter) => {
    if (chapter.progressTimestamp === null) {
      return latest;
    }

    if (!latest || chapter.progressTimestamp > latest.timestamp) {
      return {
        chapter: chapter.chapter,
        timestamp: chapter.progressTimestamp,
      };
    }

    return latest;
  }, null);

  return chaptersWithProgress.map(({ progressTimestamp, ...chapter }) => {
    const hasStarted = chapter.completedCount > 0 || chapter.currentIndex > 0 || progressTimestamp !== null;
    const isLastStudied = lastStudiedChapter?.chapter === chapter.chapter;

    return {
      ...chapter,
      isLastStudied,
      status: isLastStudied
        ? 'last-studied'
        : chapter.isCompleted
          ? 'completed'
          : hasStarted
            ? 'in-progress'
            : 'unstarted',
    };
  });
}

export function getBookStudyChapter(
  data: AppData,
  bookId: string,
  chapter: number,
  chapterSize: number,
): ChapterStudyProgress | undefined {
  return getBookStudyChapters(data, bookId, chapterSize).find((entry) => entry.chapter === chapter);
}

export function getNextStudyNavigationTarget(
  data: AppData,
  bookId: string,
  chapter: number,
  chapterSize: number,
  completedWordIdsSnapshot: string[] = [],
): StudyNavigationTarget | undefined {
  const book = getBookById(data, bookId);
  const chapters = getBookStudyChapters(data, bookId, chapterSize);
  const currentChapterPosition = chapters.findIndex((entry) => entry.chapter === chapter);

  if (currentChapterPosition < 0) {
    return undefined;
  }

  if (!isWrongWordsBook(book)) {
    const nextChapter = chapters[currentChapterPosition + 1];
    return nextChapter ? { chapter: nextChapter.chapter } : undefined;
  }

  const completedWordIds = new Set(completedWordIdsSnapshot);
  const laterWords = chapters
    .slice(currentChapterPosition)
    .flatMap((entry) => entry.words.map((word) => ({ chapter: entry.chapter, wordId: word.id })));
  const nextWord = laterWords.find((entry) => !completedWordIds.has(entry.wordId));

  return nextWord
    ? {
        chapter: nextWord.chapter,
        wordId: nextWord.wordId,
      }
    : undefined;
}

export function getBookStudyProgress(data: AppData, bookId: string, chapterSize: number): BookStudyProgressSummary {
  const words = getBookWords(data, bookId);
  const chapters = getBookStudyChapters(data, bookId, chapterSize);

  return {
    totalWords: words.length,
    completedCount: chapters.reduce((sum, chapter) => sum + chapter.completedCount, 0),
    totalChapters: chapters.length,
    usesExplicitChapters: chapters.some((chapter) => chapter.hasExplicitLabel),
    chapters,
  };
}
