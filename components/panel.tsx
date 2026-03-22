import type { ReactNode } from 'react';

export function Panel({ children }: { children: ReactNode }) {
  return <section className="panel">{children}</section>;
}
