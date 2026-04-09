import { describe, expect, it } from 'vitest';
import { getBookStudyProgress } from '@/features/books/selectors';
import { createEmptyAppData } from '@/lib/storage/app-data';
import {
  countTodayWrongWords,
  getDueReviewWords,
  getDueWrongWords,
  getRecentMistakeWords,
  getTodayWrongWords,
  updateReviewState,
} from '@/features/review/scheduling';

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


  it('filters due wrong words by due time and last incorrect result', () => {
    const data = createEmptyAppData();
    data.words = [
      { id: 'w1', bookId: 'b1', word: 'alpha', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w2', bookId: 'b1', word: 'beta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w3', bookId: 'b1', word: 'gamma', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w4', bookId: 'b1', word: 'delta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];

    data.reviewStates = {
      w1: {
        wordId: 'w1',
        lastResult: 'incorrect',
        correctCount: 0,
        wrongCount: 1,
        lastReviewedAt: '2026-03-21T09:00:00.000Z',
        nextReviewAt: '2026-03-22T09:00:00.000Z',
      },
      w2: {
        wordId: 'w2',
        lastResult: 'correct',
        correctCount: 1,
        wrongCount: 0,
        lastReviewedAt: '2026-03-21T09:00:00.000Z',
        nextReviewAt: '2026-03-22T09:00:00.000Z',
      },
      w3: {
        wordId: 'w3',
        lastResult: 'incorrect',
        correctCount: 0,
        wrongCount: 2,
        lastReviewedAt: '2026-03-22T08:00:00.000Z',
        nextReviewAt: '2026-03-22T13:00:00.000Z',
      },
      w4: {
        wordId: 'w4',
        lastResult: null,
        correctCount: 0,
        wrongCount: 0,
        lastReviewedAt: null,
        nextReviewAt: null,
      },
    };

    expect(getDueWrongWords(data, new Date('2026-03-22T10:00:00.000Z')).map((word) => word.id)).toEqual(['w1']);
  });

  it('reflects state transitions after answers for due wrong queue', () => {
    const data = createEmptyAppData();
    data.words = [
      { id: 'w1', bookId: 'b1', word: 'alpha', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];

    const incorrectState = updateReviewState(undefined, 'w1', 'incorrect', '2026-03-22T08:00:00.000Z');
    data.reviewStates = { w1: incorrectState };

    expect(getDueWrongWords(data, new Date('2026-03-22T12:01:00.000Z')).map((word) => word.id)).toEqual(['w1']);

    data.reviewStates.w1 = updateReviewState(data.reviewStates.w1, 'w1', 'correct', '2026-03-22T12:05:00.000Z');

    expect(getDueWrongWords(data, new Date('2026-03-22T12:06:00.000Z'))).toEqual([]);
  });
  it('returns today wrong words uniquely and skips deleted words', () => {
    const data = createEmptyAppData();
    data.words = [
      {
        id: 'w1',
        bookId: 'b1',
        word: 'alpha',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z',
      },
      {
        id: 'w2',
        bookId: 'b1',
        word: 'beta',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z',
      },
    ];
    data.attempts = [
      {
        id: 'a1',
        wordId: 'w1',
        typedAnswer: 'alpa',
        isCorrect: false,
        answeredAt: '2026-03-25T08:00:00',
      },
      {
        id: 'a2',
        wordId: 'w1',
        typedAnswer: 'alpah',
        isCorrect: false,
        answeredAt: '2026-03-25T09:00:00',
      },
      {
        id: 'a3',
        wordId: 'w2',
        typedAnswer: 'beta',
        isCorrect: true,
        answeredAt: '2026-03-25T09:30:00',
      },
      {
        id: 'a4',
        wordId: 'deleted-word',
        typedAnswer: 'ghost',
        isCorrect: false,
        answeredAt: '2026-03-25T10:00:00',
      },
      {
        id: 'a5',
        wordId: 'w2',
        typedAnswer: 'btea',
        isCorrect: false,
        answeredAt: '2026-03-24T12:00:00',
      },
    ];

    expect(getTodayWrongWords(data, new Date('2026-03-25T12:00:00')).map((word) => word.id)).toEqual(['w1']);
    expect(countTodayWrongWords(data, new Date('2026-03-25T12:00:00'))).toBe(1);
  });

  it('uses the latest incorrect attempt per source word when ordering wrong-words review groups', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'wrong-book',
        name: '错词本',
        kind: 'wrong-words',
        chapterSize: 10,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      {
        id: 'wrong-1',
        bookId: 'wrong-book',
        word: 'alpha',
        sourceWordId: 'origin-1',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'wrong-2',
        bookId: 'wrong-book',
        word: 'beta',
        sourceWordId: 'origin-2',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.attempts = [
      {
        id: 'a1',
        wordId: 'origin-1',
        typedAnswer: 'alpa',
        isCorrect: false,
        answeredAt: '2026-03-25T08:00:00.000Z',
      },
      {
        id: 'a2',
        wordId: 'origin-2',
        typedAnswer: 'btea',
        isCorrect: false,
        answeredAt: '2026-03-25T09:00:00.000Z',
      },
      {
        id: 'a3',
        wordId: 'origin-1',
        typedAnswer: 'alpah',
        isCorrect: false,
        answeredAt: '2026-03-25T10:00:00.000Z',
      },
      {
        id: 'a4',
        wordId: 'origin-2',
        typedAnswer: 'beta',
        isCorrect: true,
        answeredAt: '2026-03-25T11:00:00.000Z',
      },
    ];

    const progress = getBookStudyProgress(data, 'wrong-book', 10);

    expect(progress.chapters[0]?.words.map((word) => word.id)).toEqual(['wrong-1', 'wrong-2']);
  });
});
