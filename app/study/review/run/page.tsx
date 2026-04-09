'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { StudyTypingSession } from '@/components/study/study-typing-session';
import { getDueWrongWords } from '@/features/review/scheduling';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

export default function ReviewRunPage() {
  const { data, recordAttempt } = useAppData();
  const dueWrongWords = getDueWrongWords(data, new Date());

  if (dueWrongWords.length === 0) {
    return (
      <HydrationGate>
        <EmptyState
          title="当前没有待复习错词"
          description="你已经完成了本轮所有到期的错词复习。"
          action={
            <Link href="/" className="button">
              返回首页
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  return (
    <HydrationGate>
      <StudyTypingSession
        words={dueWrongWords}
        attempts={data.attempts}
        chapterLabel="到期错词复习"
        chapterBackLabel="首页"
        backHref="/"
        routeEntryKey="due-wrong-review"
        onRecordAttempt={recordAttempt}
      />
    </HydrationGate>
  );
}
