import { parseWordsCsv, parseWordsTxt } from '@/lib/csv/words-csv';

export type ImportedWordRows = ReturnType<typeof parseWordsCsv>['rows'];

export async function parseImportedWordFile(file: File): Promise<ImportedWordRows> {
  const text = await file.text();
  const parsed = file.name.endsWith('.txt') ? parseWordsTxt(text) : parseWordsCsv(text);

  return parsed.rows;
}
