export default function Loading() {
  return (
    <div className="lux-member-shell">
      <header className="lux-topbar">
        <div className="lux-topbar-inner">
          <span className="wordmark">GRAVN</span>
          <span className="lux-tag subtle">Loading…</span>
        </div>
      </header>
      <main className="lux-main" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          className="lux-hero-card"
          style={{ minHeight: 140, opacity: 0.6, animation: 'pulse 1.4s infinite ease-in-out' }}
        />
        <div className="lux-stats-row">
          <div className="lux-stat" style={{ minHeight: 76, opacity: 0.5 }} />
          <div className="lux-stat" style={{ minHeight: 76, opacity: 0.5 }} />
          <div className="lux-stat" style={{ minHeight: 76, opacity: 0.5 }} />
        </div>
        <div className="lux-surface" style={{ minHeight: 180, opacity: 0.5 }} />
      </main>
    </div>
  );
}
