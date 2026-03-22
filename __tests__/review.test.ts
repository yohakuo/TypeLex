import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from '@/lib/storage/app-data';
import { updateReviewState, getDueReviewWords, getRecentMistakeWords } from '@/features/review/scheduling';

describe('updateReviewState', () => {
  it('schedules correct answers farther out', () => {
    const first = updateReviewState(undefined, 'word-1', 'correct', '2026-03-22T12:00:00.000Z');
    const second = updateReviewState(first, 'word-1', 'correct', '2026-03-23T12:00:00.000Z');

    expect(first.correctCount).toBe(1);
    expect(first.wrongCount).toBe(0);
    expect(first.nextReviewAt).toBe('2026-03-23T12:00:00.000Z');
    expect(second.correctCount).toBe(2);
    expect(second.nextReviewAt).toBe('2026-03-26T12:00:00.000Z');
  });

  it('brings incorrect answers back soon', () => {
    const state = updateReviewState(undefined, 'word-2', 'incorrect', '2026-03-22T12:00:00.000Z');

    expect(state.correctCount).toBe(0);
    expect(state.wrongCount).toBe(1);
    expect(state.nextReviewAt).toBe('2026-03-22T16:00:00.000Z');
  });
});

describe('review selectors', () => {
  it('returns due and recently missed words', () => {
    const data = createEmptyAppData();
    data.words = [
      {
        id: 'w1',
        bookId: 'b1',
        word: 'accommodate',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w2',
        bookId: 'b1',
        word: 'rhythm',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.reviewStates = {
      w1: {
        wordId: 'w1',
        lastResult: 'correct',
        correctCount: 1,
        wrongCount: 0,
        lastReviewedAt: '2026-03-21T09:00:00.000Z',
        nextReviewAt: '2026-03-22T09:00:00.000Z',
      },
      w2: {
        wordId: 'w2',
        lastResult: 'incorrect',
        correctCount: 0,
        wrongCount: 2,
        lastReviewedAt: '2026-03-22T08:00:00.000Z',
        nextReviewAt: '2026-03-22T13:00:00.000Z',
      },
    };
    data.attempts = [
      {
        id: 'a1',
        wordId: 'w2',
        typedAnswer: 'rithem',
        isCorrect: false,
        answeredAt: '2026-03-22T08:00:00.000Z',
      },
    ];

    expect(getDueReviewWords(data, new Date('2026-03-22T10:00:00.000Z')).map((word) => word.id)).toEqual(['w1']);
    expect(getRecentMistakeWords(data).map((word) => word.id)).toEqual(['w2']);
  });
});
