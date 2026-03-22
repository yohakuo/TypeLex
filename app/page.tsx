'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { countBookDueWords } from '@/features/review/scheduling';
import { useAppData, HydrationGate, PrimaryActionLink } from '@/providers/app-data-provider';

export default function HomePage() {
  const { data, createBook, importWords } = useAppData();
  const [collectMessage, setCollectMessage] = useState<string | null>(null);

  const handleCollectWrongWords = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const wrongWordIds = new Set(
      data.attempts
        .filter(a => !a.isCorrect && new Date(a.answeredAt) >= today)
        .map(a => a.wordId)
    );

    if (wrongWordIds.size === 0) {
      setCollectMessage('今日没有错题记录，太棒了！');
      return;
    }

    const wrongWords = data.words.filter(w => wrongWordIds.has(w.id));

    let wrongBook = data.books.find(b => b.name === '错词本');
    if (!wrongBook) {
      const result = createBook('错词本');
      if (result.ok && result.book) {
        wrongBook = result.book;
      } else {
        setCollectMessage('无法创建错题本。');
        return;
      }
    }

    const inputs = wrongWords.map(w => ({
      word: w.word,
      meaning: w.meaning,
      example: w.example,
      notes: w.notes
    }));

    const imported = importWords(wrongBook.id, inputs);
    setCollectMessage(`成功将 ${imported} 个新错词加入"错词本"！`);
  };
  const now = new Date();
  const totalDue = data.books.reduce((sum, book) => sum + countBookDueWords(data, book.id, now), 0);
  const recentMistakes = data.attempts.filter((attempt) => !attempt.isCorrect).slice(-10).length;

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <p className="kicker">数据安全存储在本地浏览器</p>
            <h1>首页</h1>
            <p>
              手动添加单词，或通过 CSV 批量导入。
            </p>
          </div>
          <div className="button-row">
            <PrimaryActionLink href="/books">管理单词本</PrimaryActionLink>
            <Link href="/review" className="button-secondary">
              开始复习
            </Link>
          </div>
        </section>

        <section className="grid grid-3">
          <article className="panel">
            <div className="stat-value">{data.books.length}</div>
            <h2>单词本</h2>
            <p>为学校、考试或个人学习创建不同的拼写集。</p>
          </article>
          <article className="panel">
            <div className="stat-value">{data.words.length}</div>
            <h2>总单词数</h2>
            <p>所有保存的单词都存储在浏览器中，直到您清除本地数据。</p>
          </article>
          <article className="panel">
            <div className="stat-value">{totalDue}</div>
            <h2>待复习</h2>
            <p> {recentMistakes} 个单词等待复习。</p>
            <button onClick={handleCollectWrongWords} className="button-secondary" style={{ marginTop: '12px' }}>
              收集今日错题
            </button>
            {collectMessage && <p style={{ marginTop: '8px', fontSize: '0.85em', color: '#10b981' }}>{collectMessage}</p>}
          </article>
        </section>

        {data.books.length === 0 ? (
          <EmptyState
            title="创建您的第一个单词本"
            description="首先添加一个单词本，然后手动输入单词或导入包含 word、meaning、example 和 notes 列的 CSV 文件。"
            action={<PrimaryActionLink href="/books">创建单词本</PrimaryActionLink>}
          />
        ) : (
          <section className="panel">
            <h2>选择词书</h2>
            <div className="list">
              {data.books.map((book) => {
                const bookDueCount = countBookDueWords(data, book.id, now);

                return (
                  <article className="list-item" key={book.id}>
                    <div>
                      <h3 className="word-title">{book.name}</h3>
                      <p className="list-meta">
                        {data.words.filter((word) => word.bookId === book.id).length} 个单词 · {bookDueCount} 个待复习
                      </p>
                    </div>
                    <div className="list-item-actions">
                      <Link href={`/books/${book.id}`} className="button-secondary">
                        管理单词
                      </Link>
                      <Link href={`/study/${book.id}`} className="button">
                        开始听写
                      </Link>
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
