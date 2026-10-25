import { ShellTabs } from '@/components/shell-tabs';

export default function MemberTabs() {
  return (
    <ShellTabs
      tabs={[
        { name: 'today', label: 'tabs.today', md: 'today', sf: 'sun.max' },
        { name: 'workouts', label: 'tabs.workouts', md: 'fitness_center', sf: 'dumbbell' },
        {
          name: 'progress',
          label: 'tabs.progress',
          md: 'trending_up',
          sf: 'chart.line.uptrend.xyaxis',
        },
        { name: 'profile', label: 'tabs.profile', md: 'person', sf: 'person' },
      ]}
    />
  );
}
