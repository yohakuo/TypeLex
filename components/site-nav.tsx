'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '首页' },
  { href: '/books', label: '单词本' },
  { href: '/review', label: '复习集' },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div>
        <Link href="/" className="brand-link">
          TypeLex
        </Link>
        <p className="site-tagline">雅思听写打字练习工具</p>
      </div>
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
    </header>
  );
}
