import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  exportCanonicalWordsCsv,
  normalizeWordInput,
  normalizeWordKey,
  parseWordsCsv,
} from '../lib/csv/words-csv';
import type { WordInput } from '../lib/types/domain';

interface CleanSummary {
  inputPath: string;
  outputPath: string;
  keptCount: number;
  skippedCount: number;
  duplicateCount: number;
  emptyWordCount: number;
}

function buildOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.clean${parsed.ext || '.csv'}`);
}

function cleanWords(rows: WordInput[]): { words: WordInput[]; duplicateCount: number; emptyWordCount: number } {
  const seen = new Set<string>();
  const words: WordInput[] = [];
  let duplicateCount = 0;
  let emptyWordCount = 0;

  rows.forEach((row) => {
    const normalized = normalizeWordInput(row);

    if (!normalized.word) {
      emptyWordCount += 1;
      return;
    }

    const key = normalizeWordKey(normalized.word);
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    seen.add(key);
    words.push(normalized);
  });

  return { words, duplicateCount, emptyWordCount };
}

async function cleanCsvFile(inputPath: string): Promise<CleanSummary> {
  const absoluteInputPath = path.resolve(inputPath);
  const text = await readFile(absoluteInputPath, 'utf8');
  const parsed = parseWordsCsv(text);
  const cleaned = cleanWords(parsed.rows);
  const outputPath = buildOutputPath(absoluteInputPath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${exportCanonicalWordsCsv(cleaned.words)}\n`, 'utf8');

  return {
    inputPath: absoluteInputPath,
    outputPath,
    keptCount: cleaned.words.length,
    skippedCount: parsed.skippedRows.length + cleaned.duplicateCount + cleaned.emptyWordCount,
    duplicateCount: parsed.duplicateRows.length + cleaned.duplicateCount,
    emptyWordCount: parsed.emptyWordRows.length + cleaned.emptyWordCount,
  };
}

function printSummary(summary: CleanSummary): void {
  console.log(`Cleaned: ${summary.inputPath}`);
  console.log(`Output:  ${summary.outputPath}`);
  console.log(`Kept:    ${summary.keptCount}`);
  console.log(`Skipped: ${summary.skippedCount}`);
  console.log(`  - duplicates: ${summary.duplicateCount}`);
  console.log(`  - empty word: ${summary.emptyWordCount}`);
}

async function main() {
  const inputPaths = process.argv.slice(2);

  if (inputPaths.length === 0) {
    console.error('Usage: npm run clean:data -- <file1.csv> [file2.csv ...]');
    process.exitCode = 1;
    return;
  }

  for (const inputPath of inputPaths) {
    const summary = await cleanCsvFile(inputPath);
    printSummary(summary);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to clean CSV data: ${message}`);
  process.exitCode = 1;
});
