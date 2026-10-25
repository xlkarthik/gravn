import { formatDate, t } from '@gravn/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Section, Wordmark } from '@/components/ui';
import { api, requireAccess } from '@/lib/supabase';

// Platform admin: workspace list with counts only. Checked here and by the RPC.
export default async function AdminPage() {
  const access = await requireAccess();
  if (!access.is_platform_admin) notFound();
  const workspaces = await (await api()).adminWorkspaces();

  return (
    <main className="content">
      <Wordmark />
      <h1>{t('web.admin_title')}</h1>
      <Section
        title={t('web.admin_workspaces')}
        aside={<Link href="/account">{t('account.title')}</Link>}
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>{t('account.workspace_name')}</th>
                <th>{t('web.admin_type')}</th>
                <th>{t('web.admin_created')}</th>
                <th>{t('web.admin_members')}</th>
                <th>{t('web.admin_trainers')}</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.type}</td>
                  <td>{formatDate(w.created_at)}</td>
                  <td>{w.members}</td>
                  <td>{w.trainers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
