import { describe, expect, it } from 'vitest';
import {
  exportCanonicalWordsCsv,
  exportWordsCsv,
  normalizeWordInput,
  parseWordsCsv,
} from '@/lib/csv/words-csv';

describe('parseWordsCsv', () => {
  it('parses rows and skips blanks and duplicates case-insensitively', () => {
    const input = [
      'word,meaning,example,notes',
      'accommodate,to provide room,The hotel can accommodate us,Double c and m',
      ',missing word,example,notes',
      'ACCOMMODATE,duplicate,example,notes',
      'rhythm,pattern,Keep the rhythm,No vowels except y',
    ].join('\n');

    const result = parseWordsCsv(input);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.word)).toEqual(['accommodate', 'rhythm']);
    expect(result.skippedRows).toEqual([3, 4]);
    expect(result.emptyWordRows).toEqual([3]);
    expect(result.duplicateRows).toEqual([4]);
  });

  it('maps compatible iDictation-style headers into word fields', () => {
    const input = [
      'word,translate,phonetic,example,example_translate,chapter,notes,source_word_id',
      'emperor,皇帝,/ˈempərə(r)/,He became emperor.,他成为了皇帝。,C4,核心词,origin-1',
    ].join('\n');

    const result = parseWordsCsv(input);

    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        word: 'emperor',
        meaning: '皇帝',
        phonetic: '/ˈempərə(r)/',
        example: 'He became emperor.',
        exampleTranslate: '他成为了皇帝。',
        chapter: 'C4',
        notes: '核心词',
        sourceWordId: 'origin-1',
      },
    ]);
  });

  it('supports sourceWordId header aliases with different separators and casing', () => {
    const cases = [
      ['word,meaning,sourceWordId\nqueue,队列,origin-2', 'origin-2'],
      ['word,meaning,source-word-id\nstack,栈,origin-3', 'origin-3'],
      ['word,meaning,Source_Word_Id\narray,数组,origin-4', 'origin-4'],
    ] as const;

    cases.forEach(([input, expected]) => {
      const result = parseWordsCsv(input);
      expect(result.rows[0]?.sourceWordId).toBe(expected);
    });
  });

  it('keeps positional parsing unchanged when there is no header', () => {
    const result = parseWordsCsv('alpha,阿尔法,例句,备注');

    expect(result.rows).toEqual([
      {
        rowNumber: 1,
        word: 'alpha',
        meaning: '阿尔法',
        example: '例句',
        notes: '备注',
      },
    ]);
  });
});

describe('normalizeWordInput', () => {
  it('trims sourceWordId alongside other optional fields', () => {
    expect(
      normalizeWordInput({
        word: ' queue ',
        meaning: ' 队列 ',
        notes: ' note ',
        sourceWordId: '  origin-5  ',
      }),
    ).toEqual({
      word: 'queue',
      meaning: '队列',
      phonetic: undefined,
      example: undefined,
      exampleTranslate: undefined,
      chapter: undefined,
      notes: 'note',
      sourceWordId: 'origin-5',
    });
  });
});

describe('exportWordsCsv', () => {
  it('exports the simplified csv columns', () => {
    const csv = exportWordsCsv([
      {
        word: 'accommodate',
        meaning: '提供住宿',
        example: 'The hotel can accommodate us.',
        notes: 'Double c and m',
        sourceWordId: 'origin-6',
      },
    ]);

    expect(csv).toBe(
      'word,meaning,example,notes\naccommodate,提供住宿,The hotel can accommodate us.,Double c and m',
    );
  });
});

describe('exportCanonicalWordsCsv', () => {
  it('exports canonical columns and omits sourceWordId', () => {
    const csv = exportCanonicalWordsCsv([
      {
        chapter: 'C4',
        word: 'decrease',
        meaning: '减少',
        phonetic: 'dɪˈkriːs',
        example: 'There was a decrease.',
        exampleTranslate: '有减少。',
        notes: 'keep me',
        sourceWordId: 'origin-7',
      },
    ]);

    expect(csv).toBe(
      'chapter,word,meaning,phonetic,example,exampleTranslate,notes\nC4,decrease,减少,dɪˈkriːs,There was a decrease.,有减少。,keep me',
    );
    expect(csv).not.toContain('sourceWordId');
    expect(csv).not.toContain('origin-7');
  });

  it('round-trips canonical fields while leaving sourceWordId absent when not exported', () => {
    const csv = exportCanonicalWordsCsv([
      {
        chapter: 'C8',
        word: 'rhythm',
        meaning: '节奏',
        phonetic: '/ˈrɪðəm/',
        example: 'Keep the rhythm.',
        exampleTranslate: '保持节奏。',
        notes: 'No vowels except y',
        sourceWordId: 'origin-8',
      },
    ]);

    const reparsed = parseWordsCsv(csv);

    expect(reparsed.rows).toEqual([
      {
        rowNumber: 2,
        chapter: 'C8',
        word: 'rhythm',
        meaning: '节奏',
        phonetic: '/ˈrɪðəm/',
        example: 'Keep the rhythm.',
        exampleTranslate: '保持节奏。',
        notes: 'No vowels except y',
      },
    ]);
  });
});
