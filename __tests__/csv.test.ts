import { describe, expect, it } from 'vitest';
import { exportCanonicalWordsCsv, exportWordsCsv, parseWordsCsv } from '@/lib/csv/words-csv';

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
      'word,translate,phonetic,example,example_translate,chapter,notes',
      'emperor,皇帝,/ˈempərə(r)/,He became emperor.,他成为了皇帝。,C4,核心词',
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
      },
    ]);
    expect(result.skippedRows).toEqual([]);
  });

  it('parses BOM and multiline quoted fields safely', () => {
    const input = [
      '\uFEFFchapter,word,translate,phonetic,example,example_translate',
      'C4,decrease,"n. 减少；',
      'v. 减少；降低；",dɪˈkriːs,There was a decrease in rainfall last month.,上个月降雨量减少了。',
    ].join('\n');

    const result = parseWordsCsv(input);

    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        chapter: 'C4',
        word: 'decrease',
        meaning: 'n. 减少；\nv. 减少；降低；',
        phonetic: 'dɪˈkriːs',
        example: 'There was a decrease in rainfall last month.',
        exampleTranslate: '上个月降雨量减少了。',
      },
    ]);
  });

  it('exports and re-parses words with commas and quotes', () => {
    const csv = exportWordsCsv([
      {
        word: 'queue',
        meaning: 'a line, often called a "queue"',
        example: 'Please queue, then wait.',
        notes: 'Contains ueue',
      },
    ]);

    const result = parseWordsCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      word: 'queue',
      meaning: 'a line, often called a "queue"',
      example: 'Please queue, then wait.',
      notes: 'Contains ueue',
    });
  });
});

describe('exportCanonicalWordsCsv', () => {
  it('exports canonical headers and preserves multiline fields', () => {
    const csv = exportCanonicalWordsCsv([
      {
        chapter: 'C4',
        word: 'decrease',
        meaning: 'n. 减少；\nv. 减少；降低；',
        phonetic: 'dɪˈkriːs',
        example: 'There was a decrease in rainfall last month.',
        exampleTranslate: '上个月降雨量减少了。',
        notes: '  keep me  ',
      },
    ]);

    expect(csv).toContain('chapter,word,meaning,phonetic,example,exampleTranslate,notes');
    expect(csv).toContain('"n. 减少；\nv. 减少；降低；"');

    const reparsed = parseWordsCsv(csv);
    expect(reparsed.rows).toEqual([
      {
        rowNumber: 2,
        chapter: 'C4',
        word: 'decrease',
        meaning: 'n. 减少；\nv. 减少；降低；',
        phonetic: 'dɪˈkriːs',
        example: 'There was a decrease in rainfall last month.',
        exampleTranslate: '上个月降雨量减少了。',
        notes: 'keep me',
      },
    ]);
  });
});
