import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Image,
  KeyboardTypeOptions,
} from 'react-native';
import { LucideIcon, Camera } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, FONT } from '../theme/colors';

export function ScreenContainer({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({
  children,
  style,
  accentColor,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  // Color-coded left-accent border, e.g. to flag a record's status —
  // same pattern as NestHR's attendance list cards.
  accentColor?: string;
}) {
  return (
    <View
      style={[
        styles.card,
        accentColor
          ? { borderLeftWidth: 4, borderLeftColor: accentColor }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  color = colors.blue,
  loading,
  disabled,
  variant = 'solid',
}: {
  title: string;
  onPress: () => void;
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
}) {
  const isOutline = variant === 'outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isOutline
          ? { backgroundColor: colors.white, borderColor: colors.black }
          : { backgroundColor: color, borderColor: colors.black },
        (disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.black : colors.white} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: isOutline ? colors.black : colors.white },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function Badge({
  label,
  color = colors.blue,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  sub,
  icon: Icon,
}: {
  title: string;
  sub?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={styles.empty}>
      {Icon ? (
        <Icon
          size={40}
          color="#D1D5DB"
          strokeWidth={1.5}
          style={{ marginBottom: 10 }}
        />
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

export function LoadingView() {
  return (
    <SafeAreaView edges={['top']} style={styles.loading}>
      <ActivityIndicator size="large" color={colors.blue} />
    </SafeAreaView>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  color = colors.blue,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  // Bordered icon chip, matching NestHR's stat-card formula. Falls back to a
  // plain color dot when no icon is given.
  icon?: LucideIcon;
}) {
  return (
    <View style={styles.kpi}>
      {Icon ? (
        <View style={[styles.kpiIconWrap, { backgroundColor: color }]}>
          <Icon size={16} color={colors.white} strokeWidth={2.5} />
        </View>
      ) : (
        <View style={[styles.kpiDot, { backgroundColor: color }]} />
      )}
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  noBorder,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  noBorder?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.row, noBorder && { borderBottomWidth: 0 }]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Wrapper>
  );
}

// Circular photo with an initials fallback — used anywhere a student,
// guardian, or employee photo may or may not be set yet, so a screen never
// has to branch on whether `uri` is present.
export function Avatar({
  uri,
  name,
  size = 44,
  onPress,
}: {
  uri?: string;
  name?: string;
  size?: number;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  const dim = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Wrapper onPress={onPress} style={[styles.avatar, dim]}>
      {uri ? (
        <Image source={{ uri }} style={dim} />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {(name?.[0] || '?').toUpperCase()}
        </Text>
      )}
      {onPress ? (
        <View style={styles.avatarEditBadge}>
          <Camera size={size * 0.28} color={colors.white} strokeWidth={2.5} />
        </View>
      ) : null}
    </Wrapper>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
  required,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && { height: 80, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
      />
    </View>
  );
}

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const selected = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: colors.blue, borderColor: colors.black }
                  : null,
              ]}
            >
              <Text
                style={[styles.chipText, selected && { color: colors.white }]}
              >
                {labels?.[opt] || opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const textStyle: TextStyle = {
  fontFamily: FONT.bold,
  fontWeight: '700',
  color: colors.black,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { ...textStyle, fontSize: 16 },
  sectionSub: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  button: {
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 14 },
  badge: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: FONT.bold,
    color: colors.white,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { ...textStyle, fontSize: 14 },
  emptySub: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kpi: {
    flexBasis: '48%',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
    marginBottom: 12,
  },
  kpiDot: { width: 10, height: 10, marginBottom: 8 },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: { ...textStyle, fontSize: 24 },
  kpiLabel: {
    fontFamily: FONT.bold,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  kpiSub: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
    gap: 8,
  },
  rowTitle: { ...textStyle, fontSize: 14 },
  rowSubtitle: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  fieldInput: {
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.black,
  },
  chip: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
    textTransform: 'capitalize',
  },
});
