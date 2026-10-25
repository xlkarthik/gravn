import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Wordmark({ height = 20 }: { height?: number }) {
  return (
    <Image
      src="/wordmark.png"
      alt="Gravn"
      width={Math.round(height * 6.75)}
      height={height}
      priority
    />
  );
}

// Centered card for sign-in, invitations and other single-purpose pages.
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="center">
      <div className="card">
        <Wordmark />
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p className="muted">{body}</p>}
      {children}
    </div>
  );
}

// Internal paths use client navigation; app links (gravn://…) are plain anchors.
export function ButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: string;
}) {
  const className = `button ${variant}`;
  return href.startsWith('/') ? (
    <Link className={className} href={href}>
      {children}
    </Link>
  ) : (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="section">
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
