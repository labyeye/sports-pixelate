import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, FONT } from '../../theme/colors';
const C = {
  primary: colors.blue,
  danger: colors.red,
  textMuted: colors.muted,
  textLight: '#94a3b8',
};

export interface Option {
  key: string;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Heading for the filter group, e.g. "Status". Omit `filterOptions` to hide the group. */
  filterTitle?: string;
  filterOptions?: Option[];
  filterValue?: string;
  onFilter?: (key: string) => void;
  /** Optional second filter group (e.g. leave type next to status). */
  filter2Title?: string;
  filter2Options?: Option[];
  filter2Value?: string;
  onFilter2?: (key: string) => void;
  sortOptions?: Option[];
  sortValue?: string;
  onSort?: (key: string) => void;
  onReset: () => void;
}

const Chips = ({
  options,
  value,
  onPick,
}: {
  options: Option[];
  value?: string;
  onPick?: (k: string) => void;
}) => (
  <View style={s.chips}>
    {options.map(o => {
      const on = (value ?? '') === o.key;
      return (
        <TouchableOpacity
          key={o.key || 'all'}
          style={[s.chip, on && s.chipOn]}
          onPress={() => onPick?.(o.key)}
          activeOpacity={0.8}
        >
          <Text style={[s.chipText, on && s.chipTextOn]}>
            {o.label.replace(/_/g, ' ')}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/** One popup for a page's filter and sort choices — replaces the row of status tabs. */
export default function FilterSortModal({
  visible,
  onClose,
  filterTitle = 'Filter',
  filterOptions,
  filterValue,
  onFilter,
  filter2Title = 'Type',
  filter2Options,
  filter2Value,
  onFilter2,
  sortOptions,
  sortValue,
  onSort,
  onReset,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.head}>
          <Text style={s.title}>Filter & Sort</Text>
          <TouchableOpacity onPress={onReset} hitSlop={8}>
            <Text style={s.reset}>Reset</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ padding: 16, gap: 18 }}
        >
          {!!filterOptions?.length && (
            <View>
              <Text style={s.group}>{filterTitle}</Text>
              <Chips
                options={filterOptions}
                value={filterValue}
                onPick={onFilter}
              />
            </View>
          )}
          {!!filter2Options?.length && (
            <View>
              <Text style={s.group}>{filter2Title}</Text>
              <Chips
                options={filter2Options}
                value={filter2Value}
                onPick={onFilter2}
              />
            </View>
          )}
          {!!sortOptions?.length && (
            <View>
              <Text style={s.group}>Sort by</Text>
              <Chips options={sortOptions} value={sortValue} onPick={onSort} />
            </View>
          )}
        </ScrollView>
        <TouchableOpacity
          style={s.apply}
          onPress={onClose}
          activeOpacity={0.85}
        >
          <Text style={s.applyText}>Show results</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopWidth: 2,
    borderColor: '#000',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 24,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 17,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: '#000',
  },
  reset: {
    color: C.danger,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
  },
  group: {
    fontSize: 12,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: {
    fontSize: 12,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: '#000',
    textTransform: 'capitalize',
  },
  chipTextOn: { color: '#fff' },
  apply: {
    marginHorizontal: 16,
    backgroundColor: C.primary,
    paddingVertical: 13,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
  },
});
