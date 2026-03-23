import { describe, expect, it } from 'vitest';
import { getBookStudyProgress, getStudyProgressKey, resolveStudyProgress } from '@/features/books/selectors';
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
  it('uses fixed chapter sizes when words have no explicit chapter labels', () => {
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
        updatedAt: '2026-03-22T12:00:00.000Z',
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
        updatedAt: '2026-03-22T12:00:00.000Z',
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
        },
      ],
    });
  });
});
