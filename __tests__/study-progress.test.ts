import { describe, expect, it } from 'vitest';
import {
  getBookStudyProgress,
  getNextStudyNavigationTarget,
  getStudyProgressKey,
  resolveStudyProgress,
} from '@/features/books/selectors';
import { createEmptyAppData } from '@/lib/storage/app-data';

function createBookWord(id: string, bookId: string, word: string, updatedAt: string, sourceWordId?: string) {
  return {
    id,
    bookId,
    word,
    sourceWordId,
    createdAt: '2026-03-20T12:00:00.000Z',
    updatedAt,
  };
}

function createAttempt(id: string, wordId: string, answeredAt: string) {
  return {
    id,
    wordId,
    typedAnswer: id,
    isCorrect: false,
    answeredAt,
  };
}

describe('resolveStudyProgress', () => {
  it('returns defaults when no progress exists', () => {
    expect(resolveStudyProgress(undefined, 5)).toEqual({
      currentIndex: 0,
      completedCount: 0,
      totalWords: 5,
      isCompleted: false,
    });
  });

  it('clamps out-of-range values and resets completed chapters to the start', () => {
    expect(
      resolveStudyProgress(
        {
          bookId: 'book-1',
          chapter: 1,
          size: 3,
          currentIndex: 8,
          completedCount: 9,
          totalWords: 3,
          updatedAt: '2026-03-22T12:00:00.000Z',
        },
        3,
      ),
    ).toEqual({
      currentIndex: 0,
      completedCount: 3,
      totalWords: 3,
      isCompleted: true,
    });
  });
});

describe('getBookStudyProgress', () => {
  it('uses fixed chapter sizes when words have no explicit chapter labels', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-1',
        name: 'Wordspell',
        kind: 'normal',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      { id: 'w1', bookId: 'book-1', word: 'alpha', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w2', bookId: 'book-1', word: 'beta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w3', bookId: 'book-1', word: 'gamma', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w4', bookId: 'book-1', word: 'delta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w5', bookId: 'book-1', word: 'epsilon', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];
    data.studyProgress = {
      [getStudyProgressKey('book-1', 1, 2)]: {
        bookId: 'book-1',
        chapter: 1,
        size: 2,
        currentIndex: 1,
        completedCount: 1,
        totalWords: 2,
        updatedAt: '2026-03-22T12:00:00.000Z',
      },
      [getStudyProgressKey('book-1', 2, 2)]: {
        bookId: 'book-1',
        chapter: 2,
        size: 2,
        currentIndex: 2,
        completedCount: 4,
        totalWords: 2,
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
    };

    expect(getBookStudyProgress(data, 'book-1', 2)).toEqual({
      totalWords: 5,
      completedCount: 3,
      totalChapters: 3,
      usesExplicitChapters: false,
      chapters: [
        {
          chapter: 1,
          label: '第 1 章',
          hasExplicitLabel: false,
          size: 2,
          startWordNumber: 1,
          endWordNumber: 2,
          words: [data.words[0], data.words[1]],
          currentIndex: 1,
          completedCount: 1,
          totalWords: 2,
          isCompleted: false,
          isLastStudied: true,
          status: 'last-studied',
          lastStudiedAt: '2026-03-22T12:00:00.000Z',
        },
        {
          chapter: 2,
          label: '第 2 章',
          hasExplicitLabel: false,
          size: 2,
          startWordNumber: 3,
          endWordNumber: 4,
          words: [data.words[2], data.words[3]],
          currentIndex: 0,
          completedCount: 2,
          totalWords: 2,
          isCompleted: true,
          isLastStudied: false,
          status: 'completed',
          lastStudiedAt: '2026-03-21T12:00:00.000Z',
        },
        {
          chapter: 3,
          label: '第 3 章',
          hasExplicitLabel: false,
          size: 2,
          startWordNumber: 5,
          endWordNumber: 5,
          words: [data.words[4]],
          currentIndex: 0,
          completedCount: 0,
          totalWords: 1,
          isCompleted: false,
          isLastStudied: false,
          status: 'unstarted',
          lastStudiedAt: undefined,
        },
      ],
    });
  });

  it('groups words by explicit chapter label in first-seen order', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-2',
        name: 'iDictation',
        kind: 'normal',
        chapterSize: 20,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      {
        id: 'w10',
        bookId: 'book-2',
        word: 'alpha',
        chapter: 'C10',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w11',
        bookId: 'book-2',
        word: 'beta',
        chapter: 'C10',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w12',
        bookId: 'book-2',
        word: 'gamma',
        chapter: 'C2',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.studyProgress = {
      [getStudyProgressKey('book-2', 1, 2)]: {
        bookId: 'book-2',
        chapter: 1,
        size: 2,
        currentIndex: 1,
        completedCount: 1,
        totalWords: 2,
        updatedAt: '2026-03-22T12:00:00.000Z',
      },
      [getStudyProgressKey('book-2', 2, 1)]: {
        bookId: 'book-2',
        chapter: 2,
        size: 1,
        currentIndex: 0,
        completedCount: 1,
        totalWords: 1,
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
    };

    expect(getBookStudyProgress(data, 'book-2', 20)).toEqual({
      totalWords: 3,
      completedCount: 2,
      totalChapters: 2,
      usesExplicitChapters: true,
      chapters: [
        {
          chapter: 1,
          label: 'C10',
          hasExplicitLabel: true,
          size: 2,
          startWordNumber: 1,
          endWordNumber: 2,
          words: [data.words[0], data.words[1]],
          currentIndex: 1,
          completedCount: 1,
          totalWords: 2,
          isCompleted: false,
          isLastStudied: true,
          status: 'last-studied',
          lastStudiedAt: '2026-03-22T12:00:00.000Z',
        },
        {
          chapter: 2,
          label: 'C2',
          hasExplicitLabel: true,
          size: 1,
          startWordNumber: 3,
          endWordNumber: 3,
          words: [data.words[2]],
          currentIndex: 0,
          completedCount: 1,
          totalWords: 1,
          isCompleted: true,
          isLastStudied: false,
          status: 'completed',
          lastStudiedAt: '2026-03-21T12:00:00.000Z',
        },
      ],
    });
  });

  it('does not mark a last-studied chapter when there is no study record', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-3',
        name: 'Fresh Start',
        kind: 'normal',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      { id: 'w20', bookId: 'book-3', word: 'alpha', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w21', bookId: 'book-3', word: 'beta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w22', bookId: 'book-3', word: 'gamma', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];

    const progress = getBookStudyProgress(data, 'book-3', 2);

    expect(progress.chapters.map((chapter) => ({
      chapter: chapter.chapter,
      isLastStudied: chapter.isLastStudied,
      status: chapter.status,
    }))).toEqual([
      { chapter: 1, isLastStudied: false, status: 'unstarted' },
      { chapter: 2, isLastStudied: false, status: 'unstarted' },
    ]);
  });

  it('keeps last-studied priority even when the latest chapter is completed', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-4',
        name: 'Completed Latest',
        kind: 'normal',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      { id: 'w30', bookId: 'book-4', word: 'alpha', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w31', bookId: 'book-4', word: 'beta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w32', bookId: 'book-4', word: 'gamma', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w33', bookId: 'book-4', word: 'delta', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];
    data.studyProgress = {
      [getStudyProgressKey('book-4', 1, 2)]: {
        bookId: 'book-4',
        chapter: 1,
        size: 2,
        currentIndex: 1,
        completedCount: 1,
        totalWords: 2,
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
      [getStudyProgressKey('book-4', 2, 2)]: {
        bookId: 'book-4',
        chapter: 2,
        size: 2,
        currentIndex: 0,
        completedCount: 2,
        totalWords: 2,
        updatedAt: '2026-03-22T12:00:00.000Z',
      },
    };

    const progress = getBookStudyProgress(data, 'book-4', 2);

    expect(progress.chapters.map((chapter) => ({
      chapter: chapter.chapter,
      isCompleted: chapter.isCompleted,
      isLastStudied: chapter.isLastStudied,
      status: chapter.status,
    }))).toEqual([
      { chapter: 1, isCompleted: false, isLastStudied: false, status: 'in-progress' },
      { chapter: 2, isCompleted: true, isLastStudied: true, status: 'last-studied' },
    ]);
  });

  it('sorts wrong words by most recent mistake and ignores original chapters', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'wrong-book',
        name: '错词本',
        kind: 'wrong-words',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      {
        id: 'wrong-1',
        bookId: 'wrong-book',
        word: 'alpha',
        chapter: 'C10',
        sourceWordId: 'origin-1',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'wrong-2',
        bookId: 'wrong-book',
        word: 'beta',
        chapter: 'C2',
        sourceWordId: 'origin-2',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
      {
        id: 'wrong-3',
        bookId: 'wrong-book',
        word: 'gamma',
        chapter: 'C5',
        sourceWordId: 'origin-3',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z',
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
        answeredAt: '2026-03-25T10:00:00.000Z',
      },
      {
        id: 'a3',
        wordId: 'origin-3',
        typedAnswer: 'gmama',
        isCorrect: false,
        answeredAt: '2026-03-25T09:00:00.000Z',
      },
    ];

    const progress = getBookStudyProgress(data, 'wrong-book', 2);

    expect(progress.usesExplicitChapters).toBe(false);
    expect(progress.chapters.map((chapter) => ({
      label: chapter.label,
      wordIds: chapter.words.map((word) => word.id),
    }))).toEqual([
      { label: '第 1 组', wordIds: ['wrong-2', 'wrong-3'] },
      { label: '第 2 组', wordIds: ['wrong-1'] },
    ]);
  });

  it('recalculates wrong-words groups when group size changes', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'wrong-book',
        name: '错词本',
        kind: 'wrong-words',
        chapterSize: 3,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      { id: 'w1', bookId: 'wrong-book', word: 'alpha', sourceWordId: 'o1', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w2', bookId: 'wrong-book', word: 'beta', sourceWordId: 'o2', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w3', bookId: 'wrong-book', word: 'gamma', sourceWordId: 'o3', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w4', bookId: 'wrong-book', word: 'delta', sourceWordId: 'o4', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
      { id: 'w5', bookId: 'wrong-book', word: 'epsilon', sourceWordId: 'o5', createdAt: '2026-03-20T12:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
    ];
    data.attempts = [
      { id: 'a1', wordId: 'o1', typedAnswer: '1', isCorrect: false, answeredAt: '2026-03-25T05:00:00.000Z' },
      { id: 'a2', wordId: 'o2', typedAnswer: '2', isCorrect: false, answeredAt: '2026-03-25T04:00:00.000Z' },
      { id: 'a3', wordId: 'o3', typedAnswer: '3', isCorrect: false, answeredAt: '2026-03-25T03:00:00.000Z' },
      { id: 'a4', wordId: 'o4', typedAnswer: '4', isCorrect: false, answeredAt: '2026-03-25T02:00:00.000Z' },
      { id: 'a5', wordId: 'o5', typedAnswer: '5', isCorrect: false, answeredAt: '2026-03-25T01:00:00.000Z' },
    ];

    expect(getBookStudyProgress(data, 'wrong-book', 3).chapters).toHaveLength(2);
    expect(getBookStudyProgress(data, 'wrong-book', 2).chapters.map((chapter) => chapter.words.length)).toEqual([2, 2, 1]);
  });

  it('falls back to updatedAt or createdAt when sourceWordId or mistake record is missing', () => {
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
        id: 'wrong-a',
        bookId: 'wrong-book',
        word: 'alpha',
        sourceWordId: 'origin-a',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z',
      },
      {
        id: 'wrong-b',
        bookId: 'wrong-book',
        word: 'beta',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-23T12:00:00.000Z',
      },
      {
        id: 'wrong-c',
        bookId: 'wrong-book',
        word: 'gamma',
        sourceWordId: 'origin-c',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: 'invalid-date',
      },
    ];
    data.attempts = [
      {
        id: 'a1',
        wordId: 'origin-a',
        typedAnswer: 'alpa',
        isCorrect: false,
        answeredAt: '2026-03-25T08:00:00.000Z',
      },
    ];

    const progress = getBookStudyProgress(data, 'wrong-book', 10);

    expect(progress.chapters[0]?.words.map((word) => word.id)).toEqual(['wrong-a', 'wrong-c', 'wrong-b']);
  });
});

describe('getNextStudyNavigationTarget', () => {
  it('returns the first unfinished word after regrouping for wrong-words books', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'wrong-book',
        name: '错词本',
        kind: 'wrong-words',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      createBookWord('w1', 'wrong-book', 'alpha', '2026-03-20T12:00:00.000Z', 'o1'),
      createBookWord('w2', 'wrong-book', 'beta', '2026-03-20T12:00:00.000Z', 'o2'),
      createBookWord('w3', 'wrong-book', 'gamma', '2026-03-20T12:00:00.000Z', 'o3'),
      createBookWord('w4', 'wrong-book', 'delta', '2026-03-20T12:00:00.000Z', 'o4'),
    ];
    data.attempts = [
      createAttempt('a1', 'o1', '2026-03-25T04:00:00.000Z'),
      createAttempt('a2', 'o2', '2026-03-25T03:00:00.000Z'),
      createAttempt('a3', 'o3', '2026-03-25T02:00:00.000Z'),
      createAttempt('a4', 'o4', '2026-03-25T01:00:00.000Z'),
      createAttempt('a5', 'o1', '2026-03-25T08:00:00.000Z'),
      createAttempt('a6', 'o2', '2026-03-25T07:00:00.000Z'),
    ];

    expect(getNextStudyNavigationTarget(data, 'wrong-book', 1, 2, ['w1', 'w2'])).toEqual({
      chapter: 2,
      wordId: 'w3',
    });
  });

  it('returns a wordId anchor when the next unfinished word stays in the same numeric group', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'wrong-book',
        name: '错词本',
        kind: 'wrong-words',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      createBookWord('w1', 'wrong-book', 'alpha', '2026-03-20T12:00:00.000Z', 'o1'),
      createBookWord('w2', 'wrong-book', 'beta', '2026-03-20T12:00:00.000Z', 'o2'),
      createBookWord('w3', 'wrong-book', 'gamma', '2026-03-20T12:00:00.000Z', 'o3'),
      createBookWord('w4', 'wrong-book', 'delta', '2026-03-20T12:00:00.000Z', 'o4'),
    ];
    data.attempts = [
      createAttempt('a1', 'o1', '2026-03-25T04:00:00.000Z'),
      createAttempt('a2', 'o2', '2026-03-25T03:00:00.000Z'),
      createAttempt('a3', 'o3', '2026-03-25T02:00:00.000Z'),
      createAttempt('a4', 'o4', '2026-03-25T01:00:00.000Z'),
      createAttempt('a5', 'o3', '2026-03-25T09:00:00.000Z'),
      createAttempt('a6', 'o2', '2026-03-25T08:00:00.000Z'),
    ];

    expect(getNextStudyNavigationTarget(data, 'wrong-book', 1, 2, ['w1', 'w2'])).toEqual({
      chapter: 1,
      wordId: 'w3',
    });
  });

  it('keeps ordinary books on simple next-chapter navigation', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-1',
        name: 'Wordspell',
        kind: 'normal',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      createBookWord('w1', 'book-1', 'alpha', '2026-03-20T12:00:00.000Z'),
      createBookWord('w2', 'book-1', 'beta', '2026-03-20T12:00:00.000Z'),
      createBookWord('w3', 'book-1', 'gamma', '2026-03-20T12:00:00.000Z'),
      createBookWord('w4', 'book-1', 'delta', '2026-03-20T12:00:00.000Z'),
    ];

    expect(getNextStudyNavigationTarget(data, 'book-1', 1, 2, ['w1', 'w2'])).toEqual({ chapter: 2 });
  });
});
