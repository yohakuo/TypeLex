'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppData } from '@/providers/app-data-provider';

const links = [
  { href: '/', label: '首页' },
  { href: '/books', label: '单词本' },
  { href: '/review', label: '复习' },
];

export function SiteNav() {
  const pathname = usePathname();
  const { sync } = useAppData();

  return (
    <header className="site-header">
      <div className="brand-block">
        <Link href="/" className="brand-link">
          TypeLex
        </Link>
        <p className="site-tagline">雅思听写打字练习工具</p>
      </div>
      <div className="site-nav-group">
        <nav className="site-nav" aria-label="Primary navigation">
          {links.map((link) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(`${link.href}/`) || pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? 'nav-link nav-link-active' : 'nav-link'}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          className={pathname === '/settings' ? 'sync-entry sync-entry-active' : 'sync-entry'}
        >
          <span className="sync-entry-label">{sync.session ? '同步状态' : '开启同步'}</span>
          <span className="sync-entry-status">{sync.statusLabel}</span>
        </Link>
      </div>
    </header>
  );
}
