'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { StudyTypingSession } from '@/components/study/study-typing-session';
import {
  getBookById,
  getBookStudyChapter,
  getNextStudyNavigationTarget,
  getStudyProgressKey,
  resolveStudyProgress,
} from '@/features/books/selectors';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function StudyPage() {
  const params = useParams<{ bookId: string }>();
  const searchParams = useSearchParams();
  const bookId = params.bookId;
  const { data, recordAttempt, updateStudyProgress } = useAppData();
  const book = getBookById(data, bookId);

  const chapter = Math.max(parseInt(searchParams.get('chapter') || '1', 10), 1);
  const wordId = searchParams.get('wordId');
  const fallbackChapterSize = book?.chapterSize || 20;
  const chapterData = useMemo(
    () => getBookStudyChapter(data, bookId, chapter, fallbackChapterSize),
    [bookId, chapter, data, fallbackChapterSize],
  );
  const liveWords = useMemo(() => chapterData?.words ?? [], [chapterData]);
  const chapterSize = chapterData?.size ?? fallbackChapterSize;
  const chapterLabel = chapterData?.label ?? `Chapter ${chapter}`;
  const chapterBackLabel = chapterData?.hasExplicitLabel ? chapterLabel : `${book?.name ?? ''} chapters`;

  const progressKey = useMemo(() => getStudyProgressKey(bookId, chapter, chapterSize), [bookId, chapter, chapterSize]);
  const savedProgress = data.studyProgress[progressKey];
  const resolvedProgress = useMemo(() => resolveStudyProgress(savedProgress, liveWords.length), [savedProgress, liveWords.length]);
  const anchoredIndex = useMemo(() => {
    if (!wordId) {
      return -1;
    }

    return liveWords.findIndex((word) => word.id === wordId);
  }, [liveWords, wordId]);
  const initialCurrentIndex = anchoredIndex >= 0 ? anchoredIndex : resolvedProgress.currentIndex;
  const initialCompletedCount = anchoredIndex >= 0
    ? Math.max(resolvedProgress.completedCount, anchoredIndex)
    : resolvedProgress.completedCount;
  const routeEntryKey = `${progressKey}:${wordId ?? ''}`;

  const [currentChapterWordIdsSnapshot, setCurrentChapterWordIdsSnapshot] = useState<string[]>([]);
  const initializedRouteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldInitialize =
      initializedRouteKeyRef.current !== routeEntryKey ||
      (currentChapterWordIdsSnapshot.length === 0 && liveWords.length > 0);
    if (!shouldInitialize) {
      return;
    }

    initializedRouteKeyRef.current = routeEntryKey;
    setCurrentChapterWordIdsSnapshot(liveWords.map((word) => word.id));
  }, [currentChapterWordIdsSnapshot.length, liveWords, routeEntryKey]);

  const words = useMemo(() => {
    if (currentChapterWordIdsSnapshot.length === 0) {
      return liveWords;
    }

    const wordById = new Map(data.words.map((word) => [word.id, word]));
    const snapshotWords = currentChapterWordIdsSnapshot
      .map((id) => wordById.get(id))
      .filter((word): word is NonNullable<typeof word> => word !== undefined);

    return snapshotWords.length > 0 ? snapshotWords : liveWords;
  }, [currentChapterWordIdsSnapshot, data.words, liveWords]);

  const nextTarget = useMemo(
    () => getNextStudyNavigationTarget(data, bookId, chapter, chapterSize, currentChapterWordIdsSnapshot),
    [bookId, chapter, chapterSize, currentChapterWordIdsSnapshot, data],
  );
  const nextChapterHref = nextTarget
    ? `/study/${bookId}/run?chapter=${nextTarget.chapter}${nextTarget.wordId ? `&wordId=${nextTarget.wordId}` : ''}`
    : null;

  const persistProgress = useCallback(
    (nextIndex: number, nextCompletedCount: number, totalWords: number) => {
      updateStudyProgress({
        key: progressKey,
        progress: {
          bookId,
          chapter,
          size: chapterSize,
          currentIndex: nextIndex,
          completedCount: nextCompletedCount,
          totalWords,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [bookId, chapter, chapterSize, progressKey, updateStudyProgress],
  );

  if (!book) {
    return (
      <HydrationGate>
        <EmptyState
          title="Book not found"
          description="The book may have been deleted. Please go back and select another one."
          action={
            <Link href="/books" className="button">
              Go to Books
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  if (words.length === 0) {
    return (
      <HydrationGate>
        <EmptyState
          title="No words in this chapter"
          description="Chapter data may have changed. Please return to the chapter list and re-enter."
          action={
            <Link href={`/study/${bookId}`} className="button">
              Back to Chapters
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  return (
    <HydrationGate>
      <StudyTypingSession
        words={words}
        attempts={data.attempts}
        chapterLabel={chapterLabel}
        chapterBackLabel={chapterBackLabel}
        backHref={`/study/${book.id}`}
        nextChapterHref={nextChapterHref}
        routeEntryKey={routeEntryKey}
        initialCurrentIndex={initialCurrentIndex}
        initialCompletedCount={initialCompletedCount}
        onRecordAttempt={recordAttempt}
        onPersistProgress={persistProgress}
      />
    </HydrationGate>
  );
}