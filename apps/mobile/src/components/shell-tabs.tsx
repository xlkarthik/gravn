import { colors, t } from '@gravn/shared';
import { type MaterialIcon, NativeTabs, type SFSymbolIcon } from 'expo-router/native-tabs';

// md: Android Material Symbol; sf: iOS SF Symbol.
export type TabSpec = {
  name: string;
  label: string;
  md: MaterialIcon['md'];
  sf: SFSymbolIcon['sf'];
};

// The bottom tabs of one role's navigation (member, trainer or owner).
export function ShellTabs({ tabs }: { tabs: TabSpec[] }) {
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.surfaceRaised}
      iconColor={{ default: colors.textMuted, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textMuted }, selected: { color: colors.text } }}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md={tab.md} sf={tab.sf} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
