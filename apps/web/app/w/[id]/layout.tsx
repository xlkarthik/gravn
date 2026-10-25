import { isOwner, isStaff, roleKey, t } from '@gravn/shared';
import type { ReactNode } from 'react';

import { Form } from '@/components/form';
import { NavLink } from '@/components/nav-link';
import { Wordmark } from '@/components/ui';
import { requireStaffWorkspace } from '@/lib/supabase';

import { signOut } from '../../(auth)/actions';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { access, ws } = await requireStaffWorkspace(id);
  const owner = isOwner(ws);
  const base = `/w/${id}`;

  const otherWorkspaces = access.workspaces.filter((w) => w.id !== ws.id);

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Wordmark />
          <div className="sidebar-ws-name">{ws.name}</div>
          <div className="sidebar-ws-role">{t(roleKey(ws))}</div>
        </div>

        <nav aria-label="Studio">
          <NavLink href={base}>Overview</NavLink>
          <NavLink href={`${base}/members`}>
            {ws.type === 'coach' || !owner ? 'Clients' : 'Members & Clients'}
          </NavLink>
          <NavLink href={`${base}/programs`}>Split Builder</NavLink>
          <NavLink href={`${base}/activity`}>Activity Feed</NavLink>
          {ws.type === 'gym' && owner && <NavLink href={`${base}/trainers`}>Trainers</NavLink>}
          {owner && <NavLink href={`${base}/settings`}>Settings</NavLink>}
        </nav>

        {otherWorkspaces.length > 0 && (
          <nav aria-label="Switch Space">
            {otherWorkspaces.map((w) => (
              <NavLink key={w.id} href={isStaff(w) ? `/w/${w.id}` : `/home?ws=${w.id}`}>
                {w.type === 'personal' ? 'Personal Studio' : w.name}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="footer">
          <NavLink href="/account">{t('account.title')}</NavLink>
          {access.is_platform_admin && <NavLink href="/admin">{t('web.admin_title')}</NavLink>}
          <Form action={signOut} submit={t('common.sign_out')} variant="ghost" />
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
