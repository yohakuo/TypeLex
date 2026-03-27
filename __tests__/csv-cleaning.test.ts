import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWordsCsv } from '@/lib/csv/words-csv';

describe('parseWordsCsv with public fixtures', () => {
  it('parses the default public word book', () => {
    const csvPath = path.join(process.cwd(), 'public', 'wl807.csv');
    const input = readFileSync(csvPath, 'utf8');

    const result = parseWordsCsv(input);

    expect(result.rows.length).toBeGreaterThan(100);
    expect(result.skippedRows.length).toBeGreaterThan(0);
    expect(result.duplicateRows).toEqual(result.skippedRows);
    expect(result.rows[0]).toMatchObject({
      word: 'major',
    });
    expect(result.rows.some((row) => row.word === 'discipline')).toBe(true);
  });
});
