import type { AppData, StudyProgress, WordBook, WordEntry } from '@/lib/types/domain';

export interface ResolvedStudyProgress {
  currentIndex: number;
  completedCount: number;
  totalWords: number;
  isCompleted: boolean;
}

export interface ChapterStudyProgress extends ResolvedStudyProgress {
  chapter: number;
  startWordNumber: number;
  endWordNumber: number;
}

export interface BookStudyProgressSummary {
  totalWords: number;
  completedCount: number;
  totalChapters: number;
  chapters: ChapterStudyProgress[];
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

export function getBookStudyProgress(data: AppData, bookId: string, chapterSize: number): BookStudyProgressSummary {
  const words = getBookWords(data, bookId);
  const safeChapterSize = chapterSize > 0 ? chapterSize : 20;
  const totalChapters = Math.ceil(words.length / safeChapterSize);
  const chapters: ChapterStudyProgress[] = Array.from({ length: totalChapters }, (_, index) => {
    const chapter = index + 1;
    const chapterWords = words.slice(index * safeChapterSize, chapter * safeChapterSize);
    const resolved = resolveStudyProgress(
      data.studyProgress[getStudyProgressKey(bookId, chapter, safeChapterSize)],
      chapterWords.length,
    );

    return {
      chapter,
      startWordNumber: index * safeChapterSize + 1,
      endWordNumber: index * safeChapterSize + chapterWords.length,
      ...resolved,
    };
  });

  return {
    totalWords: words.length,
    completedCount: chapters.reduce((sum, chapter) => sum + chapter.completedCount, 0),
    totalChapters,
    chapters,
  };
}
