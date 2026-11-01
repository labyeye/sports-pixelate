import React, { useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, FONT } from '../../theme/colors';
const C = {
  primary: colors.blue,
  danger: colors.red,
  textMuted: colors.muted,
  textLight: '#94a3b8',
};

export interface Suggestion {
  key: string;
  title: string;
  subtitle?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  /** Everything searchable on the current page; suggestions are the best matches for what is typed. */
  items: Suggestion[];
  placeholder?: string;
}

/**
 * Header-search popup. Typing filters the page live (the parent applies `value`), and the list below suggests
 * matching entries from that page only; tapping one fills the box with it.
 */
export default function SearchModal({
  visible,
  onClose,
  value,
  onChange,
  items,
  placeholder = 'Search…',
}: Props) {
  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q
      ? items.filter(
          i =>
            i.title.toLowerCase().includes(q) ||
            (i.subtitle || '').toLowerCase().includes(q),
        )
      : items;
    return list.slice(0, 20);
  }, [items, q]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.card}>
          <View style={s.inputRow}>
            <Search size={18} color={C.textMuted} />
            <TextInput
              style={s.input}
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={C.textLight}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={onClose}
            />
            {value.length > 0 && (
              <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
                <X size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={s.done}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={matches}
            keyExtractor={i => i.key}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 320 }}
            ListEmptyComponent={
              <Text style={s.empty}>No matches on this page</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => {
                  onChange(item.title);
                  onClose();
                }}
              >
                <Text style={s.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {!!item.subtitle && (
                  <Text style={s.rowSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    marginTop: 60,
    marginHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: '#000',
    paddingVertical: 4,
  },
  done: {
    color: C.primary,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: '#000',
  },
  rowSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  empty: { padding: 16, textAlign: 'center', color: '#64748b' },
});
