'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { EmptyState } from '@/components/empty-state';
import { getBookById, getBookStudyProgress } from '@/features/books/selectors';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

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
  const chapterSummary = progress.usesExplicitChapters
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
          <div>
            <Link href="/" className="button-secondary" style={{ marginBottom: '16px', display: 'inline-block' }}>
              ← 返回首页
            </Link>
            <h1>{book.name} - 选择章节</h1>
            <p>{chapterSummary}</p>
          </div>
        </section>

        <section className="panel">
          <h2>整本进度</h2>
          <p style={{ marginTop: '12px', color: 'var(--muted-foreground)' }}>
            已完成 {progress.completedCount} / {progress.totalWords} 个单词
            {' · '}
            {progress.totalWords > 0 ? Math.round((progress.completedCount / progress.totalWords) * 100) : 0}%
          </p>
        </section>

        <section className="panel">
          <h2>分章列表</h2>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
            {progress.chapters.map((chapter) => {
              const percent = chapter.totalWords > 0 ? Math.round((chapter.completedCount / chapter.totalWords) * 100) : 0;
              const statusText = chapter.isCompleted
                ? '已完成，可重新练习'
                : `从第 ${chapter.currentIndex + 1} 个单词继续`;

              return (
                <Link
                  key={chapter.chapter}
                  href={`/study/${book.id}/run?chapter=${chapter.chapter}`}
                  className="button-secondary"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px 16px',
                    minWidth: '190px',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{chapter.label}</span>
                  <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
                    {chapter.startWordNumber} - {chapter.endWordNumber} 词
                  </span>
                  <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
                    已完成 {chapter.completedCount} / {chapter.totalWords} · {percent}%
                  </span>
                  <span style={{ fontSize: '0.85em', opacity: 0.8 }}>{statusText}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </HydrationGate>
  );
}
