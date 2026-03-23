import type { WordInput } from '../types/domain';

const CSV_HEADERS = ['word', 'meaning', 'example', 'notes'] as const;
const CANONICAL_CSV_HEADERS = ['chapter', 'word', 'meaning', 'phonetic', 'example', 'exampleTranslate', 'notes'] as const;
const CSV_HEADER_ALIASES: Record<keyof WordInput, string[]> = {
  word: ['word'],
  meaning: ['meaning', 'translate'],
  phonetic: ['phonetic'],
  example: ['example'],
  exampleTranslate: ['exampletranslate'],
  chapter: ['chapter'],
  notes: ['notes'],
};

const WORD_INPUT_FIELDS = Object.keys(CSV_HEADER_ALIASES) as (keyof WordInput)[];
type HeaderFieldIndexes = Partial<Record<keyof WordInput, number>>;

interface CsvRecord {
  rowNumber: number;
  cells: string[];
}

export interface ParsedCsvRow extends WordInput {
  rowNumber: number;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  skippedRows: number[];
  duplicateRows: number[];
  emptyWordRows: number[];
}

function stripUtf8Bom(input: string): string {
  return input.replace(/^\uFEFF/, '');
}

function normalizeCell(value: string | undefined): string {
  return stripUtf8Bom(value ?? '').trim();
}

export function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = normalizeCell(value);
  return trimmed ? trimmed : undefined;
}

export function normalizeWordInput(input: WordInput): WordInput {
  return {
    word: normalizeCell(input.word),
    meaning: normalizeOptionalText(input.meaning),
    phonetic: normalizeOptionalText(input.phonetic),
    example: normalizeOptionalText(input.example),
    exampleTranslate: normalizeOptionalText(input.exampleTranslate),
    chapter: normalizeOptionalText(input.chapter),
    notes: normalizeOptionalText(input.notes),
  };
}

export function normalizeWordKey(word: string): string {
  return normalizeCell(word).toLowerCase();
}

function normalizeHeader(value: string | undefined): string {
  return normalizeCell(value).toLowerCase().replace(/[_\s-]+/g, '');
}

function resolveHeaderField(value: string | undefined): keyof WordInput | undefined {
  const normalized = normalizeHeader(value);
  return WORD_INPUT_FIELDS.find((field) => CSV_HEADER_ALIASES[field].includes(normalized));
}

function buildHeaderFieldIndexes(cells: string[]): HeaderFieldIndexes {
  return cells.reduce<HeaderFieldIndexes>((indexes, cell, index) => {
    const field = resolveHeaderField(cell);

    if (field && indexes[field] === undefined) {
      indexes[field] = index;
    }

    return indexes;
  }, {});
}

function hasSupportedHeader(cells: string[]): boolean {
  const indexes = buildHeaderFieldIndexes(cells);
  return indexes.word !== undefined && Object.keys(indexes).length > 1;
}

function buildRowFromIndexedCells(rawCells: string[], fieldIndexes: HeaderFieldIndexes): WordInput {
  const row: WordInput = { word: '' };

  WORD_INPUT_FIELDS.forEach((field) => {
    const index = fieldIndexes[field];
    const value = index === undefined ? undefined : rawCells[index];

    if (value === undefined) {
      return;
    }

    row[field] = value;
  });

  return row;
}

function buildRowFromPositionalCells(rawCells: string[]): WordInput {
  return {
    word: rawCells[0] ?? '',
    meaning: rawCells[1],
    example: rawCells[2],
    notes: rawCells[3],
  };
}

function buildParsedRow(rawCells: string[], fieldIndexes?: HeaderFieldIndexes): WordInput {
  const row = fieldIndexes ? buildRowFromIndexedCells(rawCells, fieldIndexes) : buildRowFromPositionalCells(rawCells);
  return normalizeWordInput(row);
}

function isBlankRecord(cells: string[]): boolean {
  return cells.every((cell) => normalizeCell(cell) === '');
}

function pushCsvRecord(records: CsvRecord[], rowNumber: number, cells: string[]): void {
  if (isBlankRecord(cells)) {
    return;
  }

  records.push({ rowNumber, cells });
}

function parseCsvRecords(input: string): CsvRecord[] {
  const source = stripUtf8Bom(input);

  if (!source) {
    return [];
  }

  const records: CsvRecord[] = [];
  let currentCell = '';
  let currentCells: string[] = [];
  let inQuotes = false;
  let lineNumber = 1;
  let recordRowNumber = 1;

  const finishRecord = () => {
    pushCsvRecord(records, recordRowNumber, [...currentCells, currentCell]);
    currentCell = '';
    currentCells = [];
    recordRowNumber = lineNumber;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes) {
        if (next === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else if (currentCell === '') {
        inQuotes = true;
      } else {
        currentCell += char;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentCells.push(currentCell);
      currentCell = '';
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (inQuotes) {
        currentCell += '\n';
      } else {
        finishRecord();
      }

      if (char === '\r' && next === '\n') {
        index += 1;
      }

      lineNumber += 1;
      recordRowNumber = currentCells.length === 0 && currentCell === '' ? lineNumber : recordRowNumber;
      continue;
    }

    currentCell += char;
  }

  if (currentCells.length > 0 || currentCell !== '') {
    pushCsvRecord(records, recordRowNumber, [...currentCells, currentCell]);
  }

  return records;
}

function buildCsvParseResult(candidateRows: ParsedCsvRow[]): CsvParseResult {
  const rows: ParsedCsvRow[] = [];
  const skippedRows: number[] = [];
  const duplicateRows: number[] = [];
  const emptyWordRows: number[] = [];
  const seenWords = new Set<string>();

  candidateRows.forEach((row) => {
    const normalized = normalizeWordInput(row);
    const normalizedWord = normalizeWordKey(normalized.word);

    if (!normalized.word) {
      skippedRows.push(row.rowNumber);
      emptyWordRows.push(row.rowNumber);
      return;
    }

    if (seenWords.has(normalizedWord)) {
      skippedRows.push(row.rowNumber);
      duplicateRows.push(row.rowNumber);
      return;
    }

    seenWords.add(normalizedWord);
    rows.push({
      rowNumber: row.rowNumber,
      ...normalized,
    });
  });

  return {
    rows,
    skippedRows,
    duplicateRows,
    emptyWordRows,
  };
}

export function parseWordsCsv(input: string): CsvParseResult {
  const records = parseCsvRecords(input);

  if (records.length === 0) {
    return { rows: [], skippedRows: [], duplicateRows: [], emptyWordRows: [] };
  }

  const [firstRecord, ...restRecords] = records;
  const firstCells = firstRecord.cells;
  const hasHeader = hasSupportedHeader(firstCells)
    || CSV_HEADERS.every((header, index) => normalizeHeader(firstCells[index]) === header);
  const fieldIndexes = hasHeader ? buildHeaderFieldIndexes(firstCells) : undefined;
  const dataRecords = hasHeader ? restRecords : records;

  const candidateRows = dataRecords.map((record) => ({
    rowNumber: record.rowNumber,
    ...buildParsedRow(record.cells, fieldIndexes),
  }));

  return buildCsvParseResult(candidateRows);
}

export function parseWordsTxt(input: string): CsvParseResult {
  const source = stripUtf8Bom(input);

  if (!source.trim()) {
    return { rows: [], skippedRows: [], duplicateRows: [], emptyWordRows: [] };
  }

  const candidateRows: ParsedCsvRow[] = [];

  source.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    let parts = line.split(/\t+|\s{2,}/);

    if (parts.length === 1) {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx > 0) {
        parts = [line.substring(0, spaceIdx), line.substring(spaceIdx + 1)];
      } else {
        parts = [line];
      }
    }

    let word = parts[0].trim();
    word = word.replace(/\*+$/, '');
    const meaning = parts.slice(1).join(' ').trim();

    candidateRows.push({
      rowNumber: index + 1,
      word,
      meaning: meaning || undefined,
      example: undefined,
      notes: undefined,
    });
  });

  return buildCsvParseResult(candidateRows);
}

function escapeCsvCell(value: string | undefined): string {
  const text = value ?? '';

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function exportWordsCsv(words: WordInput[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = words.map((word) => {
    const normalized = normalizeWordInput(word);
    return [normalized.word, normalized.meaning, normalized.example, normalized.notes].map(escapeCsvCell).join(',');
  });

  return [header, ...rows].join('\n');
}

export function exportCanonicalWordsCsv(words: WordInput[]): string {
  const header = CANONICAL_CSV_HEADERS.join(',');
  const rows = words.map((word) => {
    const normalized = normalizeWordInput(word);
    return [
      normalized.chapter,
      normalized.word,
      normalized.meaning,
      normalized.phonetic,
      normalized.example,
      normalized.exampleTranslate,
      normalized.notes,
    ].map(escapeCsvCell).join(',');
  });

  return [header, ...rows].join('\n');
}
