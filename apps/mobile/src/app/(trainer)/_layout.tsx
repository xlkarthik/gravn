import { ShellTabs } from '@/components/shell-tabs';

export default function TrainerTabs() {
  return (
    <ShellTabs
      tabs={[
        { name: 'clients', label: 'tabs.clients', md: 'group', sf: 'person.2' },
        { name: 'programs', label: 'tabs.programs', md: 'list_alt', sf: 'list.bullet.rectangle' },
        { name: 'library', label: 'tabs.library', md: 'menu_book', sf: 'books.vertical' },
        { name: 'account', label: 'tabs.profile', md: 'person', sf: 'person' },
      ]}
    />
  );
}
