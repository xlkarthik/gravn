'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { requestPublicDeletionAction } from '../workout-actions';

export default function DeleteAccountPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await requestPublicDeletionAction(email.trim(), reason.trim());
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to submit deletion request.');
      }
    });
  }

  return (
    <main className="lux-shell" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/home" className="lux-pill" style={{ textDecoration: 'none' }}>
          ← Return to Gravn
        </Link>
      </div>

      <div className="lux-page-header">
        <div>
          <span className="eyebrow">Privacy & Data Rights (§3.5)</span>
          <h1 className="serif-xl">Account & Data Deletion</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Request permanent deletion of your Gravn account, workout logs, and body measurements
            without signing in to the mobile app.
          </p>
        </div>
      </div>

      {submitted ? (
        <div
          className="lux-surface"
          style={{ borderColor: 'rgba(212, 175, 122, 0.45)', padding: 28 }}
        >
          <span className="eyebrow">Request Recorded</span>
          <h2 className="serif-lg" style={{ marginBottom: 8 }}>
            Deletion request received for {email}
          </h2>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Your account deletion request has been logged in our compliance queue. If you are
            currently signed in, you can also execute immediate self-service account deletion from{' '}
            <strong>Profile → Delete Account</strong>.
          </p>
        </div>
      ) : (
        <div className="lux-surface">
          <h2 className="serif-md" style={{ marginBottom: 8 }}>
            Submit Web Deletion Request
          </h2>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 20, lineHeight: 1.6 }}>
            Deleting your account permanently removes your user profile, personal workout sessions,
            logged sets, body measurements, streaks, and notifications.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <label className="field">
              <span>Account Email Address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="field">
              <span>Reason for Deletion (Optional)</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let us know if we can improve anything..."
              />
            </label>

            {error && (
              <div className="alert error" style={{ fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="submit" className="btn danger" disabled={isPending || !email.trim()}>
                {isPending ? 'Submitting...' : 'Request Permanent Account Deletion'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
