'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { getBookById } from '@/features/books/selectors';
import { getDueReviewWords, getRecentMistakeWords } from '@/features/review/scheduling';
import { formatDateTime, formatRelativeDue } from '@/lib/format';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function ReviewPage() {
  const { data } = useAppData();
  const dueWords = getDueReviewWords(data, new Date());
  const recentMistakes = getRecentMistakeWords(data);
  const wrongBook = data.books.find(b => b.name === '错词本');

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <p className="kicker">复习队列</p>
            <h1>我的错词列表</h1>
            <p>优先复习到期单词，再处理近期错词。</p>
          </div>
        </section>

        <section className="grid grid-2">
          <article className="panel">
            <div className="stat-value">{dueWords.length}</div>
            <h2>待复习</h2>
            <p>已到复习时间的单词。</p>
            {wrongBook && (
              <Link href={`/study/${wrongBook.id}`} className="button-secondary" style={{ marginTop: '12px', display: 'inline-block' }}>
                去复习
              </Link>
            )}
          </article>
          <article className="panel">
            <div className="stat-value">{recentMistakes.length}</div>
            <h2>最近拼错</h2>
            <p>最近一次听写中拼错的单词。</p>
          </article>
        </section>

        {dueWords.length === 0 && recentMistakes.length === 0 ? (
          <EmptyState
            title="还没有需要复习的单词"
            description="完成一次听写练习后，应用会自动安排待复习的单词和最近拼错的单词。"
            action={
              <Link href="/books" className="button">
                打开单词本
              </Link>
            }
          />
        ) : null}

        {dueWords.length > 0 ? (
          <section className="panel">
            <h2>待复习单词</h2>
            <div className="list">
              {dueWords.map((word) => {
                const state = data.reviewStates[word.id];
                const book = getBookById(data, word.bookId);

                return (
                  <article className="list-item" key={word.id}>
                    <div>
                      <h3 className="word-title">{word.word}</h3>
                      <p className="list-meta">单词本：{book?.name ?? '未知单词本'}</p>
                      <p className="list-meta">释义：{word.meaning ?? '—'}</p>
                      <p className="list-meta">下次复习：{formatDateTime(state?.nextReviewAt ?? null)}</p>
                      <div className="badge-row">
                        <span className="badge">{formatRelativeDue(state?.nextReviewAt)}</span>
                        <span className="badge">错误次数：{state?.wrongCount ?? 0}</span>
                      </div>
                    </div>
                    <div className="list-item-actions">
                      <Link href={`/study/${word.bookId}`} className="button">
                        在听写中复习
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {recentMistakes.length > 0 ? (
          <section className="panel">
            <h2>最近拼错的单词</h2>
            <div className="list">
              {recentMistakes.map((word) => {
                const book = getBookById(data, word.bookId);
                const state = data.reviewStates[word.id];

                return (
                  <article className="list-item" key={`mistake-${word.id}`}>
                    <div>
                      <h3 className="word-title">{word.word}</h3>
                      <p className="list-meta">单词本：{book?.name ?? '未知单词本'}</p>
                      <p className="list-meta">释义：{word.meaning ?? '—'}</p>
                      <p className="list-meta">上次结果：{state?.lastResult ?? '未复习'}</p>
                    </div>
                    <div className="list-item-actions">
                      <Link href={`/study/${word.bookId}`} className="button-secondary">
                        重新练习单词本
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </HydrationGate>
  );
}
