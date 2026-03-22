import type { WordEntry } from '@/lib/types/domain';

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isCorrectAnswer(answer: string, target: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(target);
}

export function buildStudyPrompt(entry: WordEntry): string {
  return entry.word;
}
