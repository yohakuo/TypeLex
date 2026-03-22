'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { getBookById, getBookWords, getStudyProgressKey, resolveStudyProgress } from '@/features/books/selectors';
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
  const allWords = useMemo(() => getBookWords(data, bookId), [bookId, data]);

  const chapter = Math.max(parseInt(searchParams.get('chapter') || '0', 10), 0);
  const requestedSize = Math.max(parseInt(searchParams.get('size') || '20', 10), 1);
  const chapterSize = chapter > 0 ? requestedSize : allWords.length || requestedSize;

  const words = useMemo(() => {
    if (chapter > 0) {
      return allWords.slice((chapter - 1) * chapterSize, chapter * chapterSize);
    }
    return allWords;
  }, [allWords, chapter, chapterSize]);

  const progressKey = useMemo(
    () => getStudyProgressKey(bookId, chapter || 1, chapterSize),
    [bookId, chapter, chapterSize],
  );
  const savedProgress = data.studyProgress[progressKey];
  const resolvedProgress = useMemo(
    () => resolveStudyProgress(savedProgress, words.length),
    [savedProgress, words.length],
  );

  const [currentIndex, setCurrentIndex] = useState(resolvedProgress.currentIndex);
  const [answer, setAnswer] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<{ word: string; typed: string; correct: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentIndex(resolvedProgress.currentIndex);
    setAnswer('');
    setCursorIndex(0);
  }, [resolvedProgress.currentIndex, progressKey]);

  const currentWord = words[currentIndex] ?? null;
  const currentCompletedCount = resolvedProgress.isCompleted
    ? words.length
    : Math.min(Math.max(resolvedProgress.completedCount, currentIndex), words.length);
  const currentProgressPercent = words.length > 0 ? Math.round((currentCompletedCount / words.length) * 100) : 0;

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
          chapter: chapter || 1,
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

  const moveToIndex = useCallback(
    (nextIndex: number) => {
      if (words.length === 0) {
        return;
      }

      const normalizedIndex = ((nextIndex % words.length) + words.length) % words.length;
      const wrapped = nextIndex >= words.length;
      const completedCount = wrapped ? words.length : Math.max(currentCompletedCount, normalizedIndex);

      setAnswer('');
      setCursorIndex(0);
      setCurrentIndex(normalizedIndex);
      persistProgress(normalizedIndex, completedCount);
    },
    [currentCompletedCount, persistProgress, words.length],
  );

  const { speak, supported } = useSpeechSynthesis();
  const { playTypeSound, playCorrectSound, playIncorrectSound } = useSoundEffects();

  const speakCurrent = useCallback(() => {
    if (currentWord) {
      speak(currentWord.word);
    }
  }, [currentWord, speak]);

  useEffect(() => {
    speakCurrent();
  }, [speakCurrent]);

  useEffect(() => {
    containerRef.current?.focus();
  }, [currentIndex]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault();
        speakCurrent();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex > 0) {
          moveToIndex(currentIndex - 1);
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToIndex(currentIndex + 1);
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
        if (currentWord && answer.length > 0) {
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
          setLastAttempt({
            word: currentWord.word,
            typed: answer,
            correct: isCorrect,
          });
          moveToIndex(currentIndex + 1);
        }
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
    currentIndex,
    currentWord,
    moveToIndex,
    playCorrectSound,
    playIncorrectSound,
    playTypeSound,
    recordAttempt,
    speakCurrent,
    answer,
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
          description="该章节没有单词或单词书为空。"
          action={
            <Link href={`/books/${bookId}`} className="button">
              管理单词
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  return (
    <HydrationGate>
      <div className="typing-page" ref={containerRef} tabIndex={0}>
        <div className="typing-topbar" style={{ position: 'relative' }}>
          <Link href={`/study/${book.id}`} className="typing-back-link">
            ← 返回 {book.name} 章节列表
          </Link>

          {lastAttempt && (
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '40px',
                fontSize: '0.9rem',
                color: lastAttempt.correct ? '#10b981' : '#ef4444',
              }}
            >
              上个词: {lastAttempt.correct ? '✓ ' : '✗ '}
              <strong style={{ marginLeft: '4px' }}>{lastAttempt.word}</strong>
              {!lastAttempt.correct && (
                <span style={{ textDecoration: 'line-through', color: '#6b7280', marginLeft: '8px' }}>
                  {lastAttempt.typed}
                </span>
              )}
            </div>
          )}

          <span className="typing-progress">
            第 {currentIndex + 1} 题 / {words.length}
            {' · '}
            已完成 {currentCompletedCount} / {words.length}
            {' · '}
            {currentProgressPercent}%
          </span>
        </div>

        <div className="typing-center">
          {!supported && (
            <p className="notice notice-error">
              当前浏览器不支持语音合成，听写功能仍然可用，但无法播放发音。
            </p>
          )}

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
