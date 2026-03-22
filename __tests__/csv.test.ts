import { describe, expect, it } from 'vitest';
import { exportWordsCsv, parseWordsCsv } from '@/lib/csv/words-csv';

describe('parseWordsCsv', () => {
  it('parses rows and skips blanks and duplicates', () => {
    const input = [
      'word,meaning,example,notes',
      'accommodate,to provide room,The hotel can accommodate us,Double c and m',
      ',missing word,example,notes',
      'accommodate,duplicate,example,notes',
      'rhythm,pattern,Keep the rhythm,No vowels except y',
    ].join('\n');

    const result = parseWordsCsv(input);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.word)).toEqual(['accommodate', 'rhythm']);
    expect(result.skippedRows).toEqual([3, 4]);
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
