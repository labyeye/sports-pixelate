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
  ScrollView,
  Modal,
} from 'react-native';
import { LucideIcon, Camera, Search, X, ArrowUpDown, Check } from 'lucide-react-native';
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

// Search input with a leading icon and a clear button, for list-screen
// search bars (Students, Employees, Departments, etc.).
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchBar}>
      <Search size={16} color={colors.muted} strokeWidth={2} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
          <X size={16} color={colors.muted} strokeWidth={2} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Horizontal scrollable pill bar for single-select filtering (status, sport,
// department, ...), matching NestHR's status-chip filter bar.
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, alignItems: 'center' }}
      style={styles.pillScroll}
    >
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.pill, selected && styles.pillActive]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextActive]}>
              {opt.label}
              {opt.count !== undefined ? ` (${opt.count})` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export interface StatPillOption<T extends string> {
  value: T;
  label: string;
  count: number;
  color?: string;
}

// Count + label pill bar that doubles as both the stats summary and the
// status filter — matches NestHR's EmployeesScreen summary-pill bar, where
// tapping a stat card filters the list by that status.
export function StatPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: StatPillOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statPillScroll}
      contentContainerStyle={styles.statPillContent}
    >
      {options.map(opt => {
        const active = value === opt.value;
        const color = opt.color || colors.blue;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={[
              styles.statPill,
              { borderColor: color, backgroundColor: active ? color : colors.white },
            ]}
          >
            <Text style={[styles.statPillCount, { color: active ? colors.white : color }]}>
              {opt.count}
            </Text>
            <Text style={[styles.statPillLabel, { color: active ? colors.white : color }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export interface SortOption {
  key: string;
  label: string;
}

// Bottom-sheet for choosing a sort field + direction. Kept as a single
// reusable sheet so every list screen sorts the same way.
export function SortSheet({
  visible,
  onClose,
  options,
  sortBy,
  sortDir,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  options: SortOption[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onApply: (sortBy: string, sortDir: 'asc' | 'desc') => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.sheetBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <ArrowUpDown size={16} color={colors.black} strokeWidth={2.5} />
            <Text style={styles.sheetTitle}>Sort by</Text>
          </View>
          {options.map(opt => {
            const selected = opt.key === sortBy;
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.sheetRow}
                onPress={() => onApply(opt.key, sortDir)}
              >
                <Text
                  style={[styles.sheetRowText, selected && { color: colors.blue }]}
                >
                  {opt.label}
                </Text>
                {selected ? (
                  <Check size={16} color={colors.blue} strokeWidth={2.5} />
                ) : null}
              </TouchableOpacity>
            );
          })}
          <View style={styles.sheetDirRow}>
            <TouchableOpacity
              style={[styles.sheetDirBtn, sortDir === 'asc' && styles.pillActive]}
              onPress={() => onApply(sortBy, 'asc')}
            >
              <Text
                style={[styles.pillText, sortDir === 'asc' && styles.pillTextActive]}
              >
                Ascending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetDirBtn, sortDir === 'desc' && styles.pillActive]}
              onPress={() => onApply(sortBy, 'desc')}
            >
              <Text
                style={[styles.pillText, sortDir === 'desc' && styles.pillTextActive]}
              >
                Descending
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Footer for a FlatList doing page-based load-more.
export function LoadMoreFooter({
  loading,
  hasMore,
}: {
  loading: boolean;
  hasMore: boolean;
}) {
  if (!hasMore) return null;
  return (
    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
      {loading ? <ActivityIndicator color={colors.blue} /> : null}
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
    borderRadius: 20,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.black,
    padding: 0,
  },
  pillScroll: { flexGrow: 0, height: 40, marginBottom: 12 },
  statPillScroll: { flexGrow: 0, marginBottom: 12 },
  statPillContent: { gap: 8, paddingVertical: 2 },
  statPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  statPillCount: { fontFamily: FONT.bold, fontSize: 20, fontWeight: '800' },
  statPillLabel: {
    fontFamily: FONT.bold,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  pill: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'center',
  },
  pillActive: { backgroundColor: colors.blue },
  pillText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  pillTextActive: { color: colors.white },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderColor: colors.black,
    padding: 16,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sheetTitle: { ...textStyle, fontSize: 16 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  sheetRowText: { fontFamily: FONT.medium, fontSize: 14, color: colors.black },
  sheetDirRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sheetDirBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
