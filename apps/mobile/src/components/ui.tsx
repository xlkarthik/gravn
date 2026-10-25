import { colors, fontSize, radius, space, t, tError, toAppError, touchTarget } from '@gravn/shared';
import { useNetInfo } from '@react-native-community/netinfo';
import { Image } from 'expo-image';
import { type Href, Link } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Base components (plan 1.6): 48 dp touch targets, scalable text, screen-reader labels.

export function Screen(props: {
  title?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          props.onRefresh && (
            <RefreshControl
              refreshing={!!props.refreshing}
              onRefresh={props.onRefresh}
              tintColor={colors.text}
            />
          )
        }
      >
        {props.title && <Title>{props.title}</Title>}
        {props.children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
  selectable,
}: {
  children: ReactNode;
  muted?: boolean;
  selectable?: boolean;
}) {
  return (
    <Text style={[styles.body, muted && styles.muted]} selectable={selectable}>
      {children}
    </Text>
  );
}

export function Wordmark() {
  return (
    <Image
      source={require('../../assets/wordmark.png')}
      style={styles.wordmark}
      contentFit="contain"
      accessibilityLabel={t('app.name')}
    />
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'danger';

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const variant = props.variant ?? 'primary';
  const disabled = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled, busy: props.loading }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' && styles.onAccent,
            variant === 'danger' && styles.dangerText,
          ]}
        >
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, !!error && styles.inputError]}
        {...input}
      />
      {error && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

export function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.choice} accessibilityRole="radiogroup" accessibilityLabel={props.label}>
        {props.options.map((o) => {
          const selected = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => props.onChange(o.value)}
              style={[styles.choiceItem, selected && styles.choiceSelected]}
            >
              <Text style={[styles.body, selected && styles.bold]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function NumberStepper(props: {
  label: string;
  value: number | null;
  step?: number;
  allowDecimal?: boolean;
  onChange: (next: number | null) => void;
}) {
  const step = props.step ?? 1;
  const textValue = props.value === null ? '' : String(props.value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.choice}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${props.label} -${step}`}
          onPress={() =>
            props.onChange(Math.max(0, Math.round(((props.value ?? 0) - step) * 100) / 100))
          }
          style={styles.stepperBtn}
        >
          <Text style={[styles.body, styles.bold]}>−{step}</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={props.label}
          keyboardType={props.allowDecimal ? 'decimal-pad' : 'number-pad'}
          value={textValue}
          placeholder="—"
          placeholderTextColor={colors.textMuted}
          onChangeText={(raw) => {
            const cleaned = raw.trim();
            if (!cleaned) {
              props.onChange(null);
              return;
            }
            const parsed = Number(cleaned);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              props.onChange(parsed);
            }
          }}
          style={[styles.input, styles.grow, styles.stepperInput]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${props.label} +${step}`}
          onPress={() =>
            props.onChange(Math.max(0, Math.round(((props.value ?? 0) + step) * 100) / 100))
          }
          style={styles.stepperBtn}
        >
          <Text style={[styles.body, styles.bold]}>+{step}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ListItem(props: {
  title: string;
  subtitle?: string;
  badge?: string;
  selected?: boolean;
  onPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={props.onPress ? 'button' : undefined}
      accessibilityState={props.selected ? { selected: true } : undefined}
      disabled={!props.onPress}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.listItem,
        props.selected && styles.listItemSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.grow}>
        <Text style={styles.body}>{props.title}</Text>
        {props.subtitle && <Text style={[styles.small, styles.muted]}>{props.subtitle}</Text>}
      </View>
      {props.badge && <Badge label={props.badge} />}
      {props.right}
    </Pressable>
  );
}

export function TextLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} style={styles.link} accessibilityRole="link">
      {label}
    </Link>
  );
}

export function Badge({ label }: { label: string }) {
  return <Text style={styles.badge}>{label}</Text>;
}

export function Message({ tone, text }: { tone: 'error' | 'notice'; text?: string | null }) {
  if (!text) return null;
  return (
    <Text
      style={[styles.small, tone === 'error' ? styles.dangerText : styles.success]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.body, styles.bold]}>{title}</Text>
      {body && <Body muted>{body}</Body>}
      {children}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.text} accessibilityLabel={t('common.loading')} />
    </View>
  );
}

// Error with retry. Permission errors and lost connections get their own wording.
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const online = useNetInfo().isConnected !== false;
  const key = toAppError(error).key;
  if (key === 'not_allowed')
    return <EmptyState title={t('states.denied_title')} body={t('states.denied_body')} />;
  return (
    <EmptyState title={t('states.error_title')} body={online ? tError(key) : t('errors.offline')}>
      {onRetry && <Button label={t('common.retry')} variant="secondary" onPress={onRetry} />}
    </EmptyState>
  );
}

// Loading, error and success states for one query.
export function QueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}

export function OfflineBanner() {
  if (useNetInfo().isConnected !== false) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.small}>{t('states.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '600' },
  wordmark: { width: 135, height: 20 },
  link: {
    color: colors.text,
    fontSize: fontSize.md,
    textDecorationLine: 'underline',
    minHeight: touchTarget,
    textAlignVertical: 'center',
    paddingVertical: space.md,
  },
  body: { color: colors.text, fontSize: fontSize.md },
  small: { color: colors.text, fontSize: fontSize.sm },
  muted: { color: colors.textMuted },
  bold: { fontWeight: '600' },
  grow: { flex: 1 },
  center: { padding: space.xxl, alignItems: 'center' },
  section: { gap: space.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  button: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger },
  dangerText: { color: colors.danger },
  pressed: { opacity: 0.7 },
  buttonText: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  onAccent: { color: colors.onAccent },
  success: { color: colors.success },
  field: { gap: space.xs },
  label: { color: colors.textMuted, fontSize: fontSize.sm },
  input: {
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.md,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  choice: { flexDirection: 'row', gap: space.sm },
  choiceItem: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.sm,
  },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
  stepperBtn: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: { textAlign: 'center', fontWeight: '600' },
  listItem: {
    minHeight: touchTarget + space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItemSelected: { borderColor: colors.accent },
  badge: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  empty: {
    gap: space.sm,
    padding: space.xl,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  banner: {
    backgroundColor: colors.surfaceRaised,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
});
