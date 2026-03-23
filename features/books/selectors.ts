import type { AppData, StudyProgress, WordBook, WordEntry } from '@/lib/types/domain';

export interface ResolvedStudyProgress {
  currentIndex: number;
  completedCount: number;
  totalWords: number;
  isCompleted: boolean;
}

export interface ChapterStudyProgress extends ResolvedStudyProgress {
  chapter: number;
  label: string;
  hasExplicitLabel: boolean;
  size: number;
  startWordNumber: number;
  endWordNumber: number;
  words: WordEntry[];
}

export interface BookStudyProgressSummary {
  totalWords: number;
  completedCount: number;
  totalChapters: number;
  usesExplicitChapters: boolean;
  chapters: ChapterStudyProgress[];
}

interface ChapterWordGroup {
  label: string;
  hasExplicitLabel: boolean;
  size: number;
  startWordNumber: number;
  endWordNumber: number;
  words: WordEntry[];
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

function buildFixedSizeChapterGroups(words: WordEntry[], chapterSize: number): ChapterWordGroup[] {
  const safeChapterSize = chapterSize > 0 ? chapterSize : 20;
  const totalChapters = Math.ceil(words.length / safeChapterSize);

  return Array.from({ length: totalChapters }, (_, index) => {
    const chapterWords = words.slice(index * safeChapterSize, (index + 1) * safeChapterSize);

    return {
      label: `第 ${index + 1} 章`,
      hasExplicitLabel: false,
      size: safeChapterSize,
      startWordNumber: index * safeChapterSize + 1,
      endWordNumber: index * safeChapterSize + chapterWords.length,
      words: chapterWords,
    };
  });
}

function buildChapterWordGroups(words: WordEntry[], chapterSize: number): {
  usesExplicitChapters: boolean;
  groups: ChapterWordGroup[];
} {
  const usesExplicitChapters = words.some((word) => normalizeChapterLabel(word.chapter) !== undefined);

  return {
    usesExplicitChapters,
    groups: usesExplicitChapters
      ? buildExplicitChapterGroups(words)
      : buildFixedSizeChapterGroups(words, chapterSize),
  };
}

export function getBookStudyChapters(data: AppData, bookId: string, chapterSize: number): ChapterStudyProgress[] {
  const words = getBookWords(data, bookId);
  const { groups } = buildChapterWordGroups(words, chapterSize);

  return groups.map((group, index) => {
    const chapter = index + 1;
    const size = group.size;
    const resolved = resolveStudyProgress(data.studyProgress[getStudyProgressKey(bookId, chapter, size)], group.words.length);

    return {
      chapter,
      label: group.label,
      hasExplicitLabel: group.hasExplicitLabel,
      size,
      startWordNumber: group.startWordNumber,
      endWordNumber: group.endWordNumber,
      words: group.words,
      ...resolved,
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

export function getBookStudyProgress(data: AppData, bookId: string, chapterSize: number): BookStudyProgressSummary {
  const words = getBookWords(data, bookId);
  const { usesExplicitChapters } = buildChapterWordGroups(words, chapterSize);
  const chapters = getBookStudyChapters(data, bookId, chapterSize);

  return {
    totalWords: words.length,
    completedCount: chapters.reduce((sum, chapter) => sum + chapter.completedCount, 0),
    totalChapters: chapters.length,
    usesExplicitChapters,
    chapters,
  };
}
