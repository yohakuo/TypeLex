'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { countBookDueWords, getDueWrongWords, getTodayWrongWords } from '@/features/review/scheduling';
import { useAppData, HydrationGate, PrimaryActionLink } from '@/providers/app-data-provider';

export default function HomePage() {
  const router = useRouter();
  const { data, createBook, importWords, sync } = useAppData();
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const now = new Date();
  const wrongBook = data.books.find((book) => book.kind === 'wrong-words' || book.name === '错词本');
  const todayWrongWords = getTodayWrongWords(data, now);
  const todayWrongCount = getDueWrongWords(data, now).length;

  const collectTodayWrongWords = () => {
    if (todayWrongWords.length === 0) {
      setCollectMessage('今日没有错题记录，太棒了！');
      return null;
    }

    let targetBook = wrongBook;
    if (!targetBook) {
      const result = createBook('错词本', 20, { kind: 'wrong-words' });
      if (!result.ok || !result.book) {
        setCollectMessage('无法创建错题本。');
        return null;
      }

      targetBook = result.book;
    }

    const imported = importWords(
      targetBook.id,
      todayWrongWords.map((word) => ({
        word: word.word,
        meaning: word.meaning,
        phonetic: word.phonetic,
        example: word.example,
        exampleTranslate: word.exampleTranslate,
        chapter: word.chapter,
        notes: word.notes,
        sourceWordId: word.sourceWordId ?? word.id,
      })),
    );

    setCollectMessage(
      imported > 0 ? `成功将 ${imported} 个新错词加入"错词本"！` : '"错词本"已包含今天的错词。',
    );

    return targetBook;
  };

  const handleCollectWrongWords = () => {
    collectTodayWrongWords();
  };

  const handleStartReview = () => {
    router.push('/study/review/run');
  };

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header home-hero">
          <div className="home-hero-copy">
            <p className="kicker">默认保存在本地浏览器，可选开启个人云同步</p>
            <h1>首页</h1>
            <p>
              手动添加单词，或通过 CSV 批量导入。离线时照常使用，登录后可把整份学习数据同步到个人云端。
            </p>
          </div>
          <div className="button-row">
            <PrimaryActionLink href="/books">管理单词本</PrimaryActionLink>
            <button type="button" onClick={handleStartReview} className="button-secondary">
              开始复习
            </button>
            <Link href="/settings" className="button-secondary">
              {sync.session ? '查看同步设置' : '开启同步'}
            </Link>
          </div>
        </section>

        <section className="grid grid-3">
          <article className="panel stat-panel">
            <div className="stat-value">{data.books.length}</div>
            <h2>单词本</h2>
            <p>为学校、考试或个人学习创建不同的拼写集。</p>
          </article>
          <article className="panel stat-panel">
            <div className="stat-value">{data.words.length}</div>
            <h2>总单词数</h2>
            <p>默认保存在浏览器本地；如需跨设备，可在同步设置里开启个人云同步。</p>
          </article>
          <article className="panel stat-panel stat-panel-accent">
            <div className="stat-value">{todayWrongCount}</div>
            <h2>待复习</h2>
            <p>今日错词本候选共 {todayWrongCount} 个单词。</p>
            <div className="home-collect-action">
              <button type="button" onClick={handleCollectWrongWords} className="button-secondary">
                收集今日错题
              </button>
            </div>
            {collectMessage && <p className="inline-feedback inline-feedback-success">{collectMessage}</p>}
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
            <div className="section-heading">
              <div>
                <h2>选择词书</h2>
                <p className="section-subtitle">直接进入练习或管理词书。</p>
              </div>
            </div>
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
