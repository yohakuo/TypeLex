import { describe, expect, it } from 'vitest';
import {
  getBookStudyProgress,
  getStudyProgressKey,
  resolveStudyProgress,
} from '@/features/books/selectors';
import { createEmptyAppData } from '@/lib/storage/app-data';

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
  it('aggregates chapter progress into a book summary', () => {
    const data = createEmptyAppData();
    data.books = [
      {
        id: 'book-1',
        name: 'Wordspell',
        chapterSize: 2,
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
    ];
    data.words = [
      {
        id: 'w1',
        bookId: 'book-1',
        word: 'alpha',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w2',
        bookId: 'book-1',
        word: 'beta',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w3',
        bookId: 'book-1',
        word: 'gamma',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w4',
        bookId: 'book-1',
        word: 'delta',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
      {
        id: 'w5',
        bookId: 'book-1',
        word: 'epsilon',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-20T12:00:00.000Z',
      },
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
        updatedAt: '2026-03-22T12:00:00.000Z',
      },
    };

    expect(getBookStudyProgress(data, 'book-1', 2)).toEqual({
      totalWords: 5,
      completedCount: 3,
      totalChapters: 3,
      chapters: [
        {
          chapter: 1,
          startWordNumber: 1,
          endWordNumber: 2,
          currentIndex: 1,
          completedCount: 1,
          totalWords: 2,
          isCompleted: false,
        },
        {
          chapter: 2,
          startWordNumber: 3,
          endWordNumber: 4,
          currentIndex: 0,
          completedCount: 2,
          totalWords: 2,
          isCompleted: true,
        },
        {
          chapter: 3,
          startWordNumber: 5,
          endWordNumber: 5,
          currentIndex: 0,
          completedCount: 0,
          totalWords: 1,
          isCompleted: false,
        },
      ],
    });
  });
});
