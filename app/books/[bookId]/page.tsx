'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { parseImportedWordFile, type ImportedWordRows } from '@/features/books/import-file';
import { getBookById } from '@/features/books/selectors';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';

const CHAPTER_SIZES = [20, 50, 100, 200];

export default function BookDetailPage() {
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId;
  const router = useRouter();
  const { data, updateBook, importWords } = useAppData();
  const book = getBookById(data, bookId);

  const [name, setName] = useState('');
  const [chapterSize, setChapterSize] = useState<number | 'custom'>(20);
  const [customChapterSize, setCustomChapterSize] = useState<number>(20);
  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (book) {
      setName(book.name);
      if (book.chapterSize && CHAPTER_SIZES.includes(book.chapterSize)) {
        setChapterSize(book.chapterSize);
      } else if (book.chapterSize) {
        setChapterSize('custom');
        setCustomChapterSize(book.chapterSize);
      } else {
        setChapterSize(20);
      }
    }
  }, [book]);

  if (!book) {
    return (
      <HydrationGate>
        <EmptyState
          title="未找到单词本"
          description="返回单词本列表并选择一个有效的单词本。"
          action={
            <Link href="/books" className="button">
              返回单词本列表
            </Link>
          }
        />
      </HydrationGate>
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('请输入单词书名字。');
      setMessage(null);
      return;
    }

    let wordsToImport: ImportedWordRows = [];
    if (file) {
      try {
        wordsToImport = await parseImportedWordFile(file);
        if (wordsToImport.length === 0) {
          setError('文件中没有解析到有效单词。');
          setMessage(null);
          return;
        }
      } catch {
        setError('读取文件时出错。');
        setMessage(null);
        return;
      }
    }

    const finalChapterSize = chapterSize === 'custom' ? customChapterSize : chapterSize;
    if (finalChapterSize <= 0) {
      setError('每章单词数必须大于 0。');
      setMessage(null);
      return;
    }

    const result = updateBook(bookId, name, finalChapterSize);

    if (!result.ok) {
      setError(result.error ?? '无法更新单词本。');
      setMessage(null);
      return;
    }

    if (wordsToImport.length > 0) {
      const importedCount = importWords(bookId, wordsToImport);
      setError(null);
      setMessage(`成功更新词书并导入了 ${importedCount} 个新单词。`);
      setFile(null);
      router.push(`/study/${bookId}`);
      return;
    }

    setError(null);
    setMessage('词书设置已更新。');
  }

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <Link href="/books" className="button-secondary" style={{ marginBottom: '16px', display: 'inline-block' }}>
              ← 返回我的单词本
            </Link>
            <h1>修改单词本: {book.name}</h1>
            <p>修改词书名字和每章单词数，或选择追加导入新单词。导入成功后会直接进入章节选择页。</p>
          </div>
        </section>

        <section className="grid grid-2">
          <form className="panel form-grid" onSubmit={handleSubmit}>
            <label>
              单词书名字
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：考研真题词汇"
                required
              />
            </label>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: '8px', fontWeight: 500, fontSize: '0.9rem' }}>每章单词数</legend>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {CHAPTER_SIZES.map((size) => (
                  <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="chapterSize"
                      checked={chapterSize === size}
                      onChange={() => setChapterSize(size)}
                    />
                    {size}
                  </label>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="chapterSize"
                    checked={chapterSize === 'custom'}
                    onChange={() => setChapterSize('custom')}
                  />
                  自定义
                </label>
              </div>
              {chapterSize === 'custom' && (
                <label style={{ marginTop: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={customChapterSize}
                    onChange={(event) => setCustomChapterSize(parseInt(event.target.value) || 20)}
                    placeholder="输入自定义数量"
                  />
                </label>
              )}
            </fieldset>

            <label>
              上传文件追加单词 (可选)
              <div style={{
                border: '2px dashed #ebedef',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                marginTop: '4px'
              }}>
                {file ? (
                  <span style={{ color: '#10b981', fontWeight: 500 }}>✓ 已选择: {file.name}</span>
                ) : (
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>点击选择 CSV 或 TXT 文件</span>
                )}
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,text/csv,.txt,text/plain"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </label>

            {error ? <p className="notice notice-error">{error}</p> : null}
            {message ? <p className="notice notice-success">{message}</p> : null}

            <div className="button-row" style={{ marginTop: '8px' }}>
              <button type="submit" className="button">
                保存更改
              </button>
            </div>
          </form>

          <section className="panel">
            <h2>导入要求</h2>
            <p className="help-text">支持导入 CSV 或 TXT 格式数据。自动去重，忽略空行。</p>
            <p className="help-text" style={{ marginTop: '12px', marginBottom: '4px' }}><strong>• CSV 格式</strong></p>
            <p className="help-text">首行需为表头，word 为必填，其余选填。</p>
            <pre className="code-block" style={{ marginBottom: '8px' }}>word,meaning,example,notes</pre>
            <p className="help-text" style={{ marginTop: '12px', marginBottom: '4px' }}><strong>• TXT 格式</strong></p>
            <p className="help-text">每行一个单词，单词和释义（可含音标）用 Tab 键或多个空格分隔：</p>
            <pre className="code-block">emperor   /ˈempərə(r)/ n. 皇帝；君主</pre>
          </section>
        </section>
      </div>
    </HydrationGate>
  );
}
