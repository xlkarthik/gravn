import Link from 'next/link';

export const dynamic = 'force-static';

export default function PrivacyPage() {
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
          <h1 className="serif-xl">Privacy Policy</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Effective Date: October 25, 2026
          </p>
        </div>
      </div>

      <div className="lux-surface" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            1. Data We Collect
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Gravn collects only the minimum information required to provide personal and coached
            strength training, body measurement tracking, and gym membership coordination:
          </p>
          <ul className="muted" style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <strong>Account & Identity:</strong> Email address, display name, optional phone
              number, and preferred unit system (`metric` or `imperial`).
            </li>
            <li>
              <strong>Training & Fitness Activity:</strong> Workout sessions, exercises, logged sets
              (reps, weight, RPE, completion status), personal records, weekly streaks, and coach
              session feedback.
            </li>
            <li>
              <strong>Body Measurements (Health Data):</strong> Optional body weight, body fat
              percentage, and circumference measurements (waist, chest, shoulders, arms, thighs,
              hips, calves, neck, height) logged by you or an authorized coach in your workspace.
            </li>
            <li>
              <strong>Gym Membership Metadata:</strong> Workspace roles, assigned training splits,
              and physical gym membership start/end dates.
            </li>
            <li>
              <strong>Diagnostics & Support:</strong> Optional problem reports and crash diagnostics
              with PII scrubbed prior to transmission.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            2. How Your Data Is Used & Shared
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Your workout logs and body measurements are used strictly to display your training
            history, progress charts, and adherence within Gravn. When you accept an invitation to a
            Gym or Trainer workspace, your assigned trainer and workspace owner can view your
            training sessions and measurements scoped to that workspace. Gravn never sells your
            personal or health data to third parties or advertisers.
          </p>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            3. Storage, Security & Offline Encryption
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            All cloud data is stored in PostgreSQL protected by Row-Level Security (RLS) policies
            and encrypted in transit (TLS 1.3) and at rest. On mobile devices, offline workout and
            measurement queues are encrypted locally using AES-GCM with keys stored in hardware
            keychain/keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
          </p>
        </section>

        <section>
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            4. Account & Data Deletion
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            You can permanently delete your account and all associated personal workouts,
            measurements, streaks, and profile information at any time directly inside the app
            (Profile → Delete Account) or via our public web deletion portal at{' '}
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
