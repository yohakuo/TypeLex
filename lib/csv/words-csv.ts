import type { WordInput } from '@/lib/types/domain';

const CSV_HEADERS = ['word', 'meaning', 'example', 'notes'] as const;

export interface ParsedCsvRow extends WordInput {
  rowNumber: number;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  skippedRows: number[];
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function normalizeCell(value: string | undefined): string {
  return (value ?? '').trim();
}

export function parseWordsCsv(input: string): CsvParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const [firstLine, ...restLines] = lines;
  const firstCells = splitCsvLine(firstLine).map((cell) => normalizeCell(cell).toLowerCase());
  const hasHeader = CSV_HEADERS.every((header, index) => firstCells[index] === header);
  const dataLines = hasHeader ? restLines : lines;

  const rows: ParsedCsvRow[] = [];
  const skippedRows: number[] = [];
  const seenWords = new Set<string>();

  dataLines.forEach((line, index) => {
    const rawCells = splitCsvLine(line);
    const word = normalizeCell(rawCells[0]);
    const normalizedWord = word.toLowerCase();
    const rowNumber = hasHeader ? index + 2 : index + 1;

    if (!word || seenWords.has(normalizedWord)) {
      skippedRows.push(rowNumber);
      return;
    }

    seenWords.add(normalizedWord);
    rows.push({
      rowNumber,
      word,
      meaning: normalizeCell(rawCells[1]) || undefined,
      example: normalizeCell(rawCells[2]) || undefined,
      notes: normalizeCell(rawCells[3]) || undefined,
    });
  });

  return { rows, skippedRows };
}

export function parseWordsTxt(input: string): CsvParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const rows: ParsedCsvRow[] = [];
  const skippedRows: number[] = [];
  const seenWords = new Set<string>();

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    let parts = line.split(/\t+|\s{2,}/);
    
    if (parts.length === 1) {
      // fallback for single space
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        parts = [line.substring(0, spaceIdx), line.substring(spaceIdx + 1)];
      } else {
        parts = [line];
      }
    }

    let word = parts[0].trim();
    // Extract trailing asterisks, as seen in some vocab lists
    word = word.replace(/\*+$/, '');
    const normalizedWord = word.toLowerCase();

    if (!word || seenWords.has(normalizedWord)) {
      skippedRows.push(rowNumber);
      return;
    }

    seenWords.add(normalizedWord);
    
    const meaning = parts.slice(1).join(' ').trim();

    rows.push({
      rowNumber,
      word,
      meaning: meaning || undefined,
      example: undefined,
      notes: undefined,
    });
  });

  return { rows, skippedRows };
}

function escapeCsvCell(value: string | undefined): string {
  const text = value ?? '';

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function exportWordsCsv(words: WordInput[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = words.map((word) =>
    [word.word, word.meaning, word.example, word.notes].map(escapeCsvCell).join(','),
  );

  return [header, ...rows].join('\n');
}
