import type { AppData, ReviewResult, ReviewState, WordBook, WordEntry } from '@/lib/types/domain';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createDefaultReviewState(wordId: string): ReviewState {
  return {
    wordId,
    lastResult: null,
    correctCount: 0,
    wrongCount: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
  };
}

export function updateReviewState(
  current: ReviewState | undefined,
  wordId: string,
  result: ReviewResult,
  reviewedAt: string,
): ReviewState {
  const base = current ?? createDefaultReviewState(wordId);
  const correctCount = result === 'correct' ? base.correctCount + 1 : 0;
  const wrongCount = result === 'incorrect' ? base.wrongCount + 1 : base.wrongCount;
  const reviewedAtMs = new Date(reviewedAt).getTime();

  const nextDelay =
    result === 'correct'
      ? correctCount <= 1
        ? DAY
        : correctCount === 2
          ? 3 * DAY
          : Math.min(14 * DAY, 3 * DAY + (correctCount - 2) * 2 * DAY)
      : 4 * HOUR;

  return {
    wordId: base.wordId,
    lastResult: result,
    correctCount,
    wrongCount,
    lastReviewedAt: reviewedAt,
    nextReviewAt: new Date(reviewedAtMs + nextDelay).toISOString(),
  };
}

export function getDueReviewWords(data: AppData, now: Date): WordEntry[] {
  return data.words.filter((word) => {
    const state = data.reviewStates[word.id];

    if (!state?.nextReviewAt) {
      return false;
    }

    return new Date(state.nextReviewAt).getTime() <= now.getTime();
  });
}

export function getTodayWrongWords(data: AppData, now: Date): WordEntry[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const wrongWordIds = new Set(
    data.attempts
      .filter((attempt) => !attempt.isCorrect && new Date(attempt.answeredAt).getTime() >= startOfToday.getTime())
      .map((attempt) => attempt.wordId),
  );

  return data.words.filter((word) => wrongWordIds.has(word.id));
}

export function countTodayWrongWords(data: AppData, now: Date): number {
  return getTodayWrongWords(data, now).length;
}

export function getRecentMistakeWords(data: AppData): WordEntry[] {
  const recentIncorrectIds = new Set(
    data.attempts
      .filter((attempt) => !attempt.isCorrect)
      .slice(-20)
      .map((attempt) => attempt.wordId),
  );

  return data.words.filter((word) => recentIncorrectIds.has(word.id));
}

export function countBookDueWords(data: AppData, bookId: string, now: Date): number {
  return getDueReviewWords(data, now).filter((word) => word.bookId === bookId).length;
}

