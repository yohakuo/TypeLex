'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { HydrationGate, useAppData } from '@/providers/app-data-provider';
import { parseWordsCsv, parseWordsTxt } from '@/lib/csv/words-csv';

export default function NewBookPage() {
  const { createBook, importWords } = useAppData();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [chapterSize, setChapterSize] = useState<number | 'custom'>(20);
  const [customChapterSize, setCustomChapterSize] = useState<number>(20);
  const [file, setFile] = useState<File | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const CHAPTER_SIZES = [20, 50, 100, 200];

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
      return;
    }
    
    let wordsToImport: any[] = [];
    if (file) {
      try {
        const text = await file.text();
        const isTxt = file.name.endsWith('.txt');
        const parsed = isTxt ? parseWordsTxt(text) : parseWordsCsv(text);
        if (parsed.rows.length === 0) {
          setError('文件中没有解析到有效单词。');
          return;
        }
        wordsToImport = parsed.rows;
      } catch (e) {
        setError('读取文件时出错。');
        return;
      }
    }

    const finalChapterSize = chapterSize === 'custom' ? customChapterSize : chapterSize;
    if (finalChapterSize <= 0) {
      setError('每章单词数必须大于 0。');
      return;
    }

    const result = createBook(name, finalChapterSize);

    if (!result.ok || !result.book) {
      setError(result.error ?? '无法创建单词本。');
      return;
    }

    if (wordsToImport.length > 0) {
      importWords(result.book.id, wordsToImport);
    }

    // Redirect to books list
    router.push('/books');
  }

  return (
    <HydrationGate>
      <div className="page-stack">
        <section className="page-header">
          <div>
            <Link href="/books" className="button-secondary" style={{ marginBottom: '16px', display: 'inline-block' }}>
              ← 返回我的单词本
            </Link>
            <h1>新建自定义词书</h1>
            <p>创建一个新的词书并可以选择导入您的单词。</p>
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
              上传文件 (可选)
              <div style={{
                border: '2px dashed #ebedef',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                marginTop: '4px'
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
              >
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
                完成创建
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
