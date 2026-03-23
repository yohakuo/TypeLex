import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportCanonicalWordsCsv, parseWordsCsv } from '@/lib/csv/words-csv';

const DATA_FILES = ['雅思听力C4.csv', '（wl）语料库-机考笔试综合版（3，4，5，11，12）.csv'] as const;

async function loadFixture(filename: string): Promise<string> {
  return readFile(path.resolve(process.cwd(), filename), 'utf8');
}

describe('CSV cleaning integration', () => {
  it.each(DATA_FILES)('parses and canonicalizes %s', async (filename) => {
    const source = await loadFixture(filename);
    const parsed = parseWordsCsv(source);

    expect(parsed.rows.length).toBeGreaterThan(0);
    expect(parsed.rows.every((row) => row.word.trim().length > 0)).toBe(true);
    expect(parsed.rows.some((row) => row.chapter)).toBe(true);
    expect(parsed.rows.some((row) => row.phonetic)).toBe(true);

    if (filename === '雅思听力C4.csv') {
      expect(parsed.rows.some((row) => row.exampleTranslate)).toBe(true);
      expect(parsed.rows.some((row) => row.meaning?.includes('\n'))).toBe(true);
    }

    const canonical = exportCanonicalWordsCsv(parsed.rows);
    const [header] = canonical.split(/\r?\n/, 1);
    expect(header).toBe('chapter,word,meaning,phonetic,example,exampleTranslate,notes');

    const reparsed = parseWordsCsv(canonical);
    expect(reparsed.rows.length).toBe(parsed.rows.length);
    expect(reparsed.rows.every((row) => row.word.trim().length > 0)).toBe(true);
    expect(reparsed.rows.some((row) => row.chapter)).toBe(true);
    expect(reparsed.rows.some((row) => row.phonetic)).toBe(true);

    if (filename === '雅思听力C4.csv') {
      expect(reparsed.rows.some((row) => row.exampleTranslate)).toBe(true);
      expect(reparsed.rows.some((row) => row.meaning?.includes('\n'))).toBe(true);
    }
  });
});
