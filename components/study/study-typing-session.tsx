'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCorrectAnswer } from '@/features/study/answer';
import { useSpeechSynthesis } from '@/lib/speech/use-speech-synthesis';
import { useSoundEffects } from '@/lib/speech/use-sound-effects';
import type { DictationAttempt, WordEntry } from '@/lib/types/domain';

interface StudyTypingSessionProps {
  words: WordEntry[];
  attempts: DictationAttempt[];
  chapterLabel: string;
  chapterBackLabel: string;
  backHref: string;
  nextChapterHref?: string | null;
  routeEntryKey?: string;
  initialCurrentIndex?: number;
  initialCompletedCount?: number;
  onRecordAttempt: (params: { wordId: string; typedAnswer: string; isCorrect: boolean }) => void;
  onPersistProgress?: (nextIndex: number, nextCompletedCount: number, totalWords: number) => void;
}

export function StudyTypingSession({
  words,
  attempts,
  chapterLabel,
  chapterBackLabel,
  backHref,
  nextChapterHref = null,
  routeEntryKey,
  initialCurrentIndex = 0,
  initialCompletedCount = 0,
  onRecordAttempt,
  onPersistProgress,
}: StudyTypingSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(initialCurrentIndex);
  const [completedCount, setCompletedCount] = useState(initialCompletedCount);
  const [answer, setAnswer] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRouteKeyRef = useRef<string | undefined>(routeEntryKey);

  const resetInputState = useCallback(() => {
    setAnswer('');
    setCursorIndex(0);
  }, []);

  useEffect(() => {
    const routeChanged = initializedRouteKeyRef.current !== routeEntryKey;
    if (!routeChanged) {
      return;
    }

    initializedRouteKeyRef.current = routeEntryKey;
    setCurrentIndex(initialCurrentIndex);
    setCompletedCount(initialCompletedCount);
    setShowCompletionPrompt(false);
    resetInputState();
  }, [initialCompletedCount, initialCurrentIndex, resetInputState, routeEntryKey]);

  useEffect(() => {
    if (words.length === 0 || currentIndex <= words.length - 1) {
      return;
    }

    setCurrentIndex(words.length - 1);
  }, [currentIndex, words.length]);

  const currentWord = words[currentIndex] ?? null;
  const currentCompletedCount = showCompletionPrompt
    ? words.length
    : Math.min(Math.max(completedCount, currentIndex), words.length);
  const currentProgressPercent = words.length > 0 ? Math.round((currentCompletedCount / words.length) * 100) : 0;

  const { speak, supported } = useSpeechSynthesis();
  const { playTypeSound, playCorrectSound, playIncorrectSound } = useSoundEffects();

  const persistProgress = useCallback(
    (nextIndex: number, nextCompletedCount: number) => {
      if (!onPersistProgress || words.length === 0) {
        return;
      }

      const boundedCompletedCount = Math.min(Math.max(nextCompletedCount, 0), words.length);
      const isCompleted = boundedCompletedCount >= words.length;
      const safeIndex = isCompleted ? 0 : Math.min(Math.max(nextIndex, 0), words.length - 1);

      onPersistProgress(safeIndex, boundedCompletedCount, words.length);
    },
    [onPersistProgress, words.length],
  );

  const moveToIndex = useCallback(
    (nextIndex: number) => {
      if (words.length === 0) {
        return;
      }

      const boundedIndex = Math.min(Math.max(nextIndex, 0), words.length - 1);
      const nextCompletedCount = Math.max(currentCompletedCount, boundedIndex);

      resetInputState();
      setShowCompletionPrompt(false);
      setCurrentIndex(boundedIndex);
      setCompletedCount(nextCompletedCount);
      persistProgress(boundedIndex, nextCompletedCount);
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
    setCompletedCount(words.length);
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

    onRecordAttempt({
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
    onRecordAttempt,
    playCorrectSound,
    playIncorrectSound,
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

    const latestAttempt = [...attempts].reverse().find((attempt) => attempt.wordId === previousWord.id);
    if (!latestAttempt) {
      return null;
    }

    return {
      word: previousWord.word,
      meaningParts: (previousWord.meaning || '')
        .split(/[;,锛岋紱]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    };
  }, [attempts, currentIndex, words]);

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

  return (
    <div className="typing-page" ref={containerRef} tabIndex={0}>
      <div className="typing-topbar">
        <div style={{ display: 'grid', gap: '8px' }}>
          <Link href={backHref} className="typing-back-link">
            返回{chapterBackLabel}
          </Link>

          {previousWordAttempt ? (
            <div className="typing-previous-word">
              <div className="typing-previous-word-label">上一个单词</div>
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
          <p className="notice notice-error">当前浏览器不支持语音播放。</p>
        ) : null}

        {showCompletionPrompt ? (
          <div className="panel" style={{ width: 'min(520px, 100%)', textAlign: 'center' }}>
            <p className="kicker">已完成</p>
            <h2 style={{ marginBottom: '12px' }}>{chapterLabel}已完成</h2>
            <p className="muted" style={{ marginBottom: '20px' }}>你可以继续下一组，或返回首页。</p>
            <div className="button-row" style={{ justifyContent: 'center' }}>
              {nextChapterHref ? (
                <Link href={nextChapterHref} className="button">
                  下一章
                </Link>
              ) : null}
              <Link href="/" className="button-secondary">
                首页
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="typing-hint">听音拼写，按 Enter 提交答案。</p>

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
        <span className="shortcut-key">Tab</span> 重播
        <span className="shortcut-sep">|</span>
        <span className="shortcut-key">Up</span> / <span className="shortcut-key">Down</span> 上一个/下一个
        <span className="shortcut-sep">|</span>
        <span className="shortcut-key">Left</span> / <span className="shortcut-key">Right</span> 移动光标
        <span className="shortcut-sep">|</span>
        <span className="shortcut-key">Enter</span> 提交
        <span className="shortcut-sep">|</span>
        <span className="shortcut-key">Backspace</span> 删除
      </div>
    </div>
  );
}
