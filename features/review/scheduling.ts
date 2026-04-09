import type { AppData, ReviewResult, ReviewState, WordEntry } from '@/lib/types/domain';

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

export function getDueWrongWords(data: AppData, now: Date): WordEntry[] {
  return getDueReviewWords(data, now).filter((word) => data.reviewStates[word.id]?.lastResult === 'incorrect');
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

export interface WrongWordByMistake {
  word: WordEntry;
  lastMistakeAt: string;
}

function getTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getWrongWordsByMistakeTime(data: AppData, limit: number): WrongWordByMistake[] {
  if (limit <= 0) {
    return [];
  }

  const latestIncorrectByWordId = new Map<string, number>();

  data.attempts.forEach((attempt) => {
    if (attempt.isCorrect) {
      return;
    }

    const answeredAt = getTimestamp(attempt.answeredAt);
    if (answeredAt === null) {
      return;
    }

    const current = latestIncorrectByWordId.get(attempt.wordId);
    if (current === undefined || answeredAt > current) {
      latestIncorrectByWordId.set(attempt.wordId, answeredAt);
    }
  });

  return data.words
    .map((word, index) => {
      const ownMistakeAt = latestIncorrectByWordId.get(word.id);
      const sourceMistakeAt = word.sourceWordId ? latestIncorrectByWordId.get(word.sourceWordId) : undefined;
      const latestMistakeAt = Math.max(ownMistakeAt ?? -1, sourceMistakeAt ?? -1);
      const fallbackAt = getTimestamp(word.updatedAt) ?? getTimestamp(word.createdAt) ?? 0;

      return {
        word,
        index,
        latestMistakeAt,
        fallbackAt,
      };
    })
    .filter((entry) => entry.latestMistakeAt >= 0)
    .sort((left, right) => {
      const mistakeDiff = right.latestMistakeAt - left.latestMistakeAt;
      if (mistakeDiff !== 0) {
        return mistakeDiff;
      }

      const fallbackDiff = right.fallbackAt - left.fallbackAt;
      if (fallbackDiff !== 0) {
        return fallbackDiff;
      }

      return left.index - right.index;
    })
    .slice(0, limit)
    .map((entry) => ({
      word: entry.word,
      lastMistakeAt: new Date(entry.latestMistakeAt).toISOString(),
    }));
}
export function countBookDueWords(data: AppData, bookId: string, now: Date): number {
  return getDueReviewWords(data, now).filter((word) => word.bookId === bookId).length;
}

