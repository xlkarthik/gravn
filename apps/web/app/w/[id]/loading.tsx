export default function WorkspaceLoading() {
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="wordmark">GRAVN</span>
        </div>
      </aside>
      <main className="content" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="lux-stats-row">
          <div className="lux-stat" style={{ minHeight: 80, opacity: 0.5 }} />
          <div className="lux-stat" style={{ minHeight: 80, opacity: 0.5 }} />
          <div className="lux-stat" style={{ minHeight: 80, opacity: 0.5 }} />
          <div className="lux-stat" style={{ minHeight: 80, opacity: 0.5 }} />
        </div>
        <div className="lux-surface" style={{ minHeight: 240, opacity: 0.5 }} />
      </main>
    </div>
  );
}
