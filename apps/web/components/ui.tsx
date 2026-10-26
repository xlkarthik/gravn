import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Wordmark({ height = 20 }: { height?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Image
        src="/icon.png"
        alt="Gravn"
        width={Math.round(height * 1.4)}
        height={Math.round(height * 1.4)}
        style={{ borderRadius: 6, objectFit: 'cover' }}
        priority
      />
      <span className="wordmark">GRAVN</span>
    </div>
  );
}

// Centered card for sign-in, invitations and other single-purpose pages.
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="center">
      <div className="card">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <Image
            src="/icon.png"
            alt="GRAVN — Gravity Builds Intensity"
            width={116}
            height={116}
            style={{ borderRadius: 16, objectFit: 'cover', marginBottom: 8 }}
            priority
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            GRAVITY &nbsp;/&nbsp; BUILDS &nbsp;/&nbsp;{' '}
            <span style={{ color: 'var(--accent)' }}>INTENSITY</span>
          </div>
        </div>
        <h1 style={{ textAlign: 'center', marginBottom: 18 }}>{title}</h1>
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
