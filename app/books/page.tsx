'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { getBookWords } from '@/features/books/selectors';
import { countBookDueWords } from '@/features/review/scheduling';
import { formatDateTime } from '@/lib/format';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function BooksPage() {
  const { data, deleteBook } = useAppData();

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p className="kicker">单词本管理</p>
            <h1>我的单词本</h1>
            <p>管理自定义单词列表，或者创建新的词书。</p>
          </div>
          <div style={{ marginTop: '8px' }}>
            <Link href="/books/new" className="button">
              自定义词书
            </Link>
          </div>
        </section>

        {data.books.length === 0 ? (
          <EmptyState
            title="还没有单词本"
            description="创建您的第一个单词本，开始收集拼写单词进行听写练习。"
          />
        ) : (
          <section className="panel">
            <h2>所有单词本</h2>
            <div className="list">
              {data.books.map((book) => {
                const wordCount = getBookWords(data, book.id).length;
                const dueCount = countBookDueWords(data, book.id, new Date());

                return (
                  <article className="list-item" key={book.id}>
                    <div>
                      <h3 className="word-title">{book.name}</h3>
                      <p className="list-meta">
                        {wordCount} 个单词 · {dueCount} 个待复习 · 更新于 {formatDateTime(book.updatedAt)}
                      </p>
                    </div>
                    <div className="list-item-actions">
                      <Link href={`/books/${book.id}`} className="button-secondary">
                        编辑单词本
                      </Link>
                      <Link href={`/study/${book.id}`} className="button">
                        开始听写
                      </Link>
                      <button type="button" className="button-danger" onClick={() => deleteBook(book.id)}>
                        删除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </HydrationGate>
  );
}
