import './globals.css';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/site-nav';
import { AppDataProvider } from '@/providers/app-data-provider';

export const metadata: Metadata = {
  title: 'Wordspell - 单词拼写练习',
  description: '本地优先的自定义英语单词拼写练习工具。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppDataProvider>
          <main className="app-shell">
            <SiteNav />
            {children}
          </main>
        </AppDataProvider>
      </body>
    </html>
  );
}
