import Link from 'next/link';

export const dynamic = 'force-static';

export default function TermsPage() {
  return (
    <main className="lux-shell" style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/home" className="lux-pill" style={{ textDecoration: 'none' }}>
          ← Return to Gravn
        </Link>
      </div>

      <div className="lux-page-header">
        <div>
          <span className="eyebrow">Legal & Compliance · v1.0</span>
          <h1 className="serif-xl">Terms of Use</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Effective Date: October 25, 2026
          </p>
        </div>
      </div>

      <div className="lux-surface" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            1. Physical Activity & Medical Disclaimer
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Gravn is a workout logging, training split management, and body measurement tracking
            tool. Gravn does not provide medical advice, diagnosis, or treatment. Always consult a
            qualified healthcare professional before beginning any strength training program or
            making changes to your physical regimen.
          </p>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            2. Personal & Workspace Accounts
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            You are responsible for maintaining the confidentiality of your account credentials.
            When joining a Gym or Trainer workspace, you grant the workspace owner and your assigned
            coach permission to assign training splits, view your workout adherence, and record body
            measurements within that workspace.
          </p>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            3. Acceptable Use
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            You agree not to misuse the platform, attempt unauthorized access to another member’s or
            workspace’s records, or upload unlawful content. We reserve the right to suspend
            accounts that violate workspace safety or platform integrity.
          </p>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            4. Account Termination
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            You may terminate your account at any time from your Profile settings or at{' '}
            <Link href="/delete-account" style={{ color: 'var(--accent)' }}>
              /delete-account
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
