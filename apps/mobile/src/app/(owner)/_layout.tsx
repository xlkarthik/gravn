import { ShellTabs } from '@/components/shell-tabs';

export default function OwnerTabs() {
  return (
    <ShellTabs
      tabs={[
        { name: 'overview', label: 'tabs.overview', md: 'dashboard', sf: 'square.grid.2x2' },
        { name: 'members', label: 'tabs.members', md: 'groups', sf: 'person.3' },
        { name: 'trainers', label: 'tabs.trainers', md: 'badge', sf: 'person.badge.key' },
        { name: 'settings', label: 'tabs.settings', md: 'settings', sf: 'gearshape' },
      ]}
    />
  );
}
