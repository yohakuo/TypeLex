'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { getWrongWordsByMistakeTime } from '@/features/review/scheduling';
import { formatDateTime } from '@/lib/format';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

const DEFAULT_LIMIT = 20;

type LimitMode = 'default' | 'custom';

function parseCustomLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, 9999);
}

export default function ReviewPage() {
  const { data } = useAppData();
  const [limitMode, setLimitMode] = useState<LimitMode>('default');
  const [customLimitInput, setCustomLimitInput] = useState<string>(String(DEFAULT_LIMIT));

  const displayLimit = limitMode === 'default' ? DEFAULT_LIMIT : parseCustomLimit(customLimitInput);

  const totalWrongWords = useMemo(
    () => getWrongWordsByMistakeTime(data, data.words.length).length,
    [data],
  );

  const wrongWords = useMemo(
    () => getWrongWordsByMistakeTime(data, displayLimit),
    [data, displayLimit],
  );

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header home-hero">
          <div className="home-hero-copy">
            <p className="kicker">错词复习</p>
            <h1>按错误时间排序</h1>
            <p>按最近拼错时间从新到旧展示错词，每次可看 20 个，或自定义数量。</p>
          </div>
        </section>

        <section className="panel review-limit-panel">
          <div className="review-limit-toolbar">
            <div className="review-limit-summary">
              <h2>显示数量</h2>
              <p className="section-subtitle">
                当前显示 {wrongWords.length} / {displayLimit}（共 {totalWrongWords} 个错词）
              </p>
            </div>

            <fieldset className="review-limit-fieldset">
              <legend className="review-limit-legend">每次显示</legend>
              <div className="review-limit-row">
                <label className="review-limit-option">
                  <input
                    type="radio"
                    name="reviewLimit"
                    checked={limitMode === 'default'}
                    onChange={() => setLimitMode('default')}
                  />
                  20 个
                </label>

                <label className="review-limit-option">
                  <input
                    type="radio"
                    name="reviewLimit"
                    checked={limitMode === 'custom'}
                    onChange={() => setLimitMode('custom')}
                  />
                  自定义
                </label>

                {limitMode === 'custom' && (
                  <input
                    className="review-limit-input"
                    type="number"
                    min="1"
                    value={customLimitInput}
                    onChange={(event) => setCustomLimitInput(event.target.value)}
                  />
                )}
              </div>
            </fieldset>
          </div>
        </section>

        {wrongWords.length === 0 ? (
          <EmptyState
            title="还没有可复习的错词"
            description="先去听写练习，产生拼写错误后，这里会按错误时间自动排序。"
            action={
              <Link href="/books" className="button">
                去学习单词本
              </Link>
            }
          />
        ) : (
          <section className="panel">
            <h2>错词列表</h2>
            <div className="list">
              {wrongWords.map(({ word, lastMistakeAt }) => (
                <article className="list-item" key={word.id}>
                  <div>
                    <h3 className="word-title">{word.word}</h3>
                    <p className="list-meta">最近错误：{formatDateTime(lastMistakeAt)}</p>
                    <p className="list-meta">意思：{word.meaning?.trim() ? word.meaning : '（暂无）'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </HydrationGate>
  );
}
