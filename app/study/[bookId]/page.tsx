'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { getBookById, getBookStudyProgress } from '@/features/books/selectors';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

const CHAPTER_SIZES = [20, 50, 100, 200];

function isWrongWordsBook(bookName?: string, kind?: string): boolean {
  return kind === 'wrong-words' || bookName === '错词本';
}

function WrongWordsGroupSizeControl({
  bookId,
  name,
  chapterSize,
}: {
  bookId: string;
  name: string;
  chapterSize: number;
}) {
  const { updateBook } = useAppData();
  const [selectedSize, setSelectedSize] = useState<number | 'custom'>(chapterSize);
  const [customSize, setCustomSize] = useState<number>(chapterSize);

  useEffect(() => {
    if (CHAPTER_SIZES.includes(chapterSize)) {
      setSelectedSize(chapterSize);
      setCustomSize(chapterSize);
      return;
    }

    setSelectedSize('custom');
    setCustomSize(chapterSize);
  }, [chapterSize]);

  const applySize = (nextSize: number) => {
    if (nextSize <= 0) {
      return;
    }

    updateBook(bookId, name, nextSize);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>每组词数</h2>
          <p className="section-subtitle">按最近错误时间排序后分组，修改后会立即重算。</p>
        </div>
      </div>

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ marginBottom: '8px', fontWeight: 500, fontSize: '0.9rem' }}>每组单词数</legend>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {CHAPTER_SIZES.map((size) => (
            <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.9rem' }}>
              <input
                type="radio"
                name="wrongWordsChapterSize"
                checked={selectedSize === size}
                onChange={() => {
                  setSelectedSize(size);
                  setCustomSize(size);
                  applySize(size);
                }}
              />
              {size}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.9rem' }}>
            <input
              type="radio"
              name="wrongWordsChapterSize"
              checked={selectedSize === 'custom'}
              onChange={() => setSelectedSize('custom')}
            />
            自定义
          </label>
        </div>
        {selectedSize === 'custom' && (
          <label style={{ marginTop: '8px' }}>
            <input
              type="number"
              min="1"
              value={customSize}
              onChange={(event) => {
                const nextValue = parseInt(event.target.value, 10) || 1;
                setCustomSize(nextValue);
                applySize(nextValue);
              }}
              placeholder="输入自定义数量"
            />
          </label>
        )}
      </fieldset>
    </section>
  );
}

export default function ChapterSelectionPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const { data } = useAppData();
  const book = getBookById(data, bookId);
  const chapterSize = book?.chapterSize || 20;
  const progress = useMemo(() => getBookStudyProgress(data, bookId, chapterSize), [bookId, chapterSize, data]);
  const words = useMemo(
    () => progress.chapters.flatMap((chapter) => chapter.words),
    [progress.chapters],
  );
  const wrongWordsBook = isWrongWordsBook(book?.name, book?.kind);
  const chapterSummary = wrongWordsBook
    ? `共 ${words.length} 个单词，按最近错误时间排序，每组 ${chapterSize} 个单词。请选择一组开始听写。`
    : progress.usesExplicitChapters
      ? `共 ${words.length} 个单词，按源章节分组。请选择一章开始听写。`
      : `共 ${words.length} 个单词，每章 ${chapterSize} 个单词。请选择一章开始听写。`;

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
          title="此单词本还没有单词"
          description="请先向此单词本添加至少一个单词，再开始听写练习。"
          action={
            <Link href={`/books/${bookId}`} className="button">
              去加单词
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div className="chapter-page-header">
            <Link href="/" className="button-secondary chapter-back-link">
              ← 返回首页
            </Link>
            <div>
              <h1>{book.name} - 选择章节</h1>
              <p>{chapterSummary}</p>
            </div>
          </div>
        </section>

        {wrongWordsBook && (
          <WrongWordsGroupSizeControl bookId={book.id} name={book.name} chapterSize={chapterSize} />
        )}

        <section className="panel progress-overview">
          <div className="section-heading">
            <div>
              <h2>整本进度</h2>
              <p className="section-subtitle">
                已完成 {progress.completedCount} / {progress.totalWords} 个单词
                {' · '}
                {progress.totalWords > 0 ? Math.round((progress.completedCount / progress.totalWords) * 100) : 0}%
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{wrongWordsBook ? '分组列表' : '分章列表'}</h2>
              <p className="section-subtitle">优先从最近学习的章节继续，也可以随时重练已完成章节。</p>
            </div>
          </div>
          <div className="chapter-grid">
            {progress.chapters.map((chapter) => {
              const percent = chapter.totalWords > 0 ? Math.round((chapter.completedCount / chapter.totalWords) * 100) : 0;
              const statusText = chapter.status === 'last-studied'
                ? chapter.isCompleted
                  ? '最近完成'
                  : '上次学到这里'
                : chapter.status === 'completed'
                  ? '已完成，可重新练习'
                  : chapter.status === 'in-progress'
                    ? `从第 ${chapter.currentIndex + 1} 个单词继续`
                    : '尚未开始';

              const cardClassName = [
                'chapter-card',
                `chapter-card-${chapter.status}`,
                chapter.isCompleted ? 'chapter-card-completed' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <Link
                  key={chapter.chapter}
                  href={`/study/${book.id}/run?chapter=${chapter.chapter}`}
                  className={cardClassName}
                >
                  <div className="chapter-card-title-row">
                    <h3 className="chapter-card-title">{chapter.label}</h3>
                    <div className="chapter-card-badges">
                      {chapter.isLastStudied && <span className="badge chapter-card-last">最近学习</span>}
                      {chapter.isCompleted && <span className="badge chapter-card-completed-badge">已完成</span>}
                    </div>
                  </div>
                  <p className="chapter-card-meta">
                    {chapter.startWordNumber} - {chapter.endWordNumber} 词
                  </p>
                  <p className="chapter-card-progress">
                    已完成 {chapter.completedCount} / {chapter.totalWords} · {percent}%
                  </p>
                  <p className="chapter-card-status">{statusText}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </HydrationGate>
  );
}
