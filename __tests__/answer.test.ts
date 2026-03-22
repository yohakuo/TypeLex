import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, normalizeAnswer } from '@/features/study/answer';

describe('normalizeAnswer', () => {
  it('trims and lowercases answers', () => {
    expect(normalizeAnswer('  AcCommodate  ')).toBe('accommodate');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeAnswer('ice   cream')).toBe('ice cream');
  });
});

describe('isCorrectAnswer', () => {
  it('compares answers case-insensitively', () => {
    expect(isCorrectAnswer('Rhythm', 'rhythm')).toBe(true);
  });

  it('detects incorrect answers', () => {
    expect(isCorrectAnswer('definately', 'definitely')).toBe(false);
  });
});
