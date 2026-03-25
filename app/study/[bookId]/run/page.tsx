'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import {
  getBookById,
  getBookStudyChapter,
  getBookStudyChapters,
  getStudyProgressKey,
  resolveStudyProgress,
} from '@/features/books/selectors';
import { isCorrectAnswer } from '@/features/study/answer';
import { useSpeechSynthesis } from '@/lib/speech/use-speech-synthesis';
import { useSoundEffects } from '@/lib/speech/use-sound-effects';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function StudyPage() {
  const params = useParams<{ bookId: string }>();
  const searchParams = useSearchParams();
  const bookId = params.bookId;
  const { data, recordAttempt, updateStudyProgress } = useAppData();
  const book = getBookById(data, bookId);

  const chapter = Math.max(parseInt(searchParams.get('chapter') || '1', 10), 1);
  const fallbackChapterSize = book?.chapterSize || 20;
  const chapterData = useMemo(
    () => getBookStudyChapter(data, bookId, chapter, fallbackChapterSize),
    [bookId, chapter, data, fallbackChapterSize],
  );
  const chapters = useMemo(() => getBookStudyChapters(data, bookId, fallbackChapterSize), [bookId, data, fallbackChapterSize]);
  const currentChapterPosition = chapters.findIndex((entry) => entry.chapter === chapter);
  const nextChapter = currentChapterPosition >= 0 ? chapters[currentChapterPosition + 1] : undefined;
  const words = useMemo(() => chapterData?.words ?? [], [chapterData]);
  const chapterSize = chapterData?.size ?? fallbackChapterSize;

  const progressKey = useMemo(() => getStudyProgressKey(bookId, chapter, chapterSize), [bookId, chapter, chapterSize]);
  const savedProgress = data.studyProgress[progressKey];
  const resolvedProgress = useMemo(() => resolveStudyProgress(savedProgress, words.length), [savedProgress, words.length]);
  const chapterLabel = chapterData?.label ?? `第 ${chapter} 章`;
  const chapterBackLabel = chapterData?.hasExplicitLabel ? chapterLabel : `${book?.name ?? ''} 章节列表`;

  const [currentIndex, setCurrentIndex] = useState(resolvedProgress.currentIndex);
  const [answer, setAnswer] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentWord = words[currentIndex] ?? null;
  const currentCompletedCount = resolvedProgress.isCompleted
    ? words.length
    : Math.min(Math.max(resolvedProgress.completedCount, currentIndex), words.length);
  const currentProgressPercent = words.length > 0 ? Math.round((currentCompletedCount / words.length) * 100) : 0;

  const { speak, supported } = useSpeechSynthesis();
  const { playTypeSound, playCorrectSound, playIncorrectSound } = useSoundEffects();

  const persistProgress = useCallback(
    (nextIndex: number, completedCount: number) => {
      if (words.length === 0) {
        return;
      }

      const boundedCompletedCount = Math.min(Math.max(completedCount, 0), words.length);
      const isCompleted = boundedCompletedCount >= words.length;
      const safeIndex = isCompleted ? 0 : Math.min(Math.max(nextIndex, 0), words.length - 1);

      updateStudyProgress({
        key: progressKey,
        progress: {
          bookId,
          chapter,
          size: chapterSize,
          currentIndex: safeIndex,
          completedCount: boundedCompletedCount,
          totalWords: words.length,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [bookId, chapter, chapterSize, progressKey, updateStudyProgress, words.length],
  );

  const resetInputState = useCallback(() => {
    setAnswer('');
    setCursorIndex(0);
  }, []);

  const moveToIndex = useCallback(
    (nextIndex: number) => {
      if (words.length === 0) {
        return;
      }

      const boundedIndex = Math.min(Math.max(nextIndex, 0), words.length - 1);
      const completedCount = Math.max(currentCompletedCount, boundedIndex);

      resetInputState();
      setShowCompletionPrompt(false);
      setCurrentIndex(boundedIndex);
      persistProgress(boundedIndex, completedCount);
    },
    [currentCompletedCount, persistProgress, resetInputState, words.length],
  );

  const moveToPreviousWord = useCallback(() => {
    if (currentIndex <= 0) {
      return;
    }

    moveToIndex(currentIndex - 1);
  }, [currentIndex, moveToIndex]);

  const moveToNextWord = useCallback(() => {
    if (currentIndex >= words.length - 1) {
      return;
    }

    moveToIndex(currentIndex + 1);
  }, [currentIndex, moveToIndex, words.length]);

  const completeChapter = useCallback(() => {
    persistProgress(0, words.length);
    resetInputState();
    setShowCompletionPrompt(true);
  }, [persistProgress, resetInputState, words.length]);

  const submitCurrentAnswer = useCallback(() => {
    if (!currentWord || answer.length === 0) {
      return;
    }

    const isCorrect = isCorrectAnswer(answer, currentWord.word);
    if (isCorrect) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    recordAttempt({
      wordId: currentWord.id,
      typedAnswer: answer,
      isCorrect,
    });

    const isLastWord = currentIndex >= words.length - 1;
    if (isLastWord) {
      completeChapter();
      return;
    }

    moveToIndex(currentIndex + 1);
  }, [
    answer,
    completeChapter,
    currentIndex,
    currentWord,
    moveToIndex,
    playCorrectSound,
    playIncorrectSound,
    recordAttempt,
    words.length,
  ]);

  const previousWordAttempt = useMemo(() => {
    if (currentIndex <= 0) {
      return null;
    }

    const previousWord = words[currentIndex - 1];
    if (!previousWord) {
      return null;
    }

    const latestAttempt = [...data.attempts].reverse().find((attempt) => attempt.wordId === previousWord.id);
    if (!latestAttempt) {
      return null;
    }

    return {
      word: previousWord.word,
      meaningParts: (previousWord.meaning || '')
        .split(/[；;]+/)
        .map((part) => part.trim())
        .filter(Boolean),
      typed: latestAttempt.typedAnswer,
      correct: latestAttempt.isCorrect,
    };
  }, [currentIndex, data.attempts, words]);

  const speakCurrent = useCallback(() => {
    if (currentWord) {
      speak(currentWord.word);
    }
  }, [currentWord, speak]);

  useEffect(() => {
    if (showCompletionPrompt) {
      return;
    }

    setCurrentIndex(resolvedProgress.currentIndex);
    resetInputState();
  }, [progressKey, resolvedProgress.currentIndex, resetInputState, showCompletionPrompt]);

  useEffect(() => {
    speakCurrent();
  }, [speakCurrent]);

  useEffect(() => {
    containerRef.current?.focus();
  }, [currentIndex, showCompletionPrompt]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (showCompletionPrompt) {
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        speakCurrent();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveToPreviousWord();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToNextWord();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCursorIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCursorIndex((prev) => Math.min(prev + 1, answer.length));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        submitCurrentAnswer();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        if (cursorIndex === 0) {
          return;
        }
        setAnswer((prev) => prev.slice(0, cursorIndex - 1) + prev.slice(cursorIndex));
        setCursorIndex((prev) => prev - 1);
        playTypeSound();
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setAnswer((prev) => prev.slice(0, cursorIndex) + event.key + prev.slice(cursorIndex));
        setCursorIndex((prev) => prev + 1);
        playTypeSound();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    answer.length,
    cursorIndex,
    moveToNextWord,
    moveToPreviousWord,
    playTypeSound,
    showCompletionPrompt,
    speakCurrent,
    submitCurrentAnswer,
  ]);

  if (!book) {
    return (
      <HydrationGate>
        <EmptyState
          title="未找到单词本"
          description="请返回单词本列表选择一个有效的单词本进行听写练习。"
          action={
            <Link href="/books" className="button">
              返回单词本列表
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
          title="没有可练习的单词"
          description="该章节没有单词、章节不存在，或单词书为空。"
          action={
            <Link href={`/study/${bookId}`} className="button">
              返回章节列表
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  return (
    <HydrationGate>
      <div className="typing-page" ref={containerRef} tabIndex={0}>
        <div className="typing-topbar">
          <div style={{ display: 'grid', gap: '8px' }}>
            <Link href={`/study/${book.id}`} className="typing-back-link">
              ← 返回 {chapterBackLabel}
            </Link>

            {previousWordAttempt ? (
              <div className="typing-previous-word">
                <div className="typing-previous-word-label">上个词</div>
                <div className="typing-previous-word-text">{previousWordAttempt.word}</div>
                {previousWordAttempt.meaningParts.length > 0 ? (
                  <div className="typing-previous-word-meanings">
                    {previousWordAttempt.meaningParts.map((meaning, index) => (
                      <span key={`${meaning}-${index}`} className="typing-previous-word-meaning">
                        {meaning}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: '8px', justifyItems: 'end', textAlign: 'right' }}>
            <span className="typing-progress">{currentIndex + 1}/{words.length},{currentProgressPercent}%</span>
            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>{chapterLabel}</span>
          </div>
        </div>

        <div className="typing-center">
          {!supported ? (
            <p className="notice notice-error">当前浏览器不支持语音合成，听写功能仍然可用，但无法播放发音。</p>
          ) : null}

          {showCompletionPrompt ? (
            <div className="panel" style={{ width: 'min(520px, 100%)', textAlign: 'center' }}>
              <p className="kicker">章节完成</p>
              <h2 style={{ marginBottom: '12px' }}>{chapterLabel} 已完成</h2>
              <p className="muted" style={{ marginBottom: '20px' }}>
                本章单词已全部完成！
              </p>
              <div className="button-row" style={{ justifyContent: 'center' }}>
                {nextChapter ? (
                  <Link href={`/study/${bookId}/run?chapter=${nextChapter.chapter}`} className="button">
                    下一章
                  </Link>
                ) : null}
                <Link href="/" className="button-secondary">
                  返回首页
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="typing-hint">听单词发音，拼写出来</p>

              <div className="typing-display" aria-live="polite">
                {answer.split('').map((char, i) => (
                  <span key={i}>
                    {cursorIndex === i ? <span className="typing-caret" /> : null}
                    <span className="typing-char typing-char-entered">{char}</span>
                  </span>
                ))}
                {cursorIndex === answer.length ? <span className="typing-caret" /> : null}
              </div>
            </>
          )}
        </div>

        <div className="typing-shortcuts">
          <span className="shortcut-key">Tab</span> 重播发音
          <span className="shortcut-sep">|</span>
          <span className="shortcut-key">↑</span> / <span className="shortcut-key">↓</span> 切换单词
          <span className="shortcut-sep">|</span>
          <span className="shortcut-key">←</span> / <span className="shortcut-key">→</span> 移动光标
          <span className="shortcut-sep">|</span>
          <span className="shortcut-key">Enter</span> 确认并下一个
          <span className="shortcut-sep">|</span>
          <span className="shortcut-key">Backspace</span> 删除
        </div>
      </div>
    </HydrationGate>
  );
}
