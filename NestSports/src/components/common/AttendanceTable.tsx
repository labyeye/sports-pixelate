import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  Users,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import Reveal from '../motion/Reveal';

// Ported from NestHR's attendance table (hrms-pixelate/NestHR AttendanceScreen):
// icon-only header, ringed avatar (ring = status), name + sub line, plain times,
// ⋮ for actions and ⌄ for the animated details panel. Same styles, same sizes.
export type TableCol = {
  key: string;
  label: string;
  width?: number;
  flex?: number;
  icon?: 'users' | 'in' | 'out';
};

const HEAD_ICON = {
  users: { Icon: Users, color: '#6B7280' },
  in: { Icon: LogIn, color: colors.green },
  out: { Icon: LogOut, color: colors.red },
};

const sizeOf = (c: TableCol) =>
  c.key === 'name' ? { flex: 2.4, minWidth: 0 } : { width: c.width };

export function AttendanceTableHeader({ cols }: { cols: TableCol[] }) {
  return (
    <View style={styles.tHead}>
      {cols.map(c => {
        const h = c.icon ? HEAD_ICON[c.icon] : null;
        return (
          <View
            key={c.key}
            style={[sizeOf(c), c.key !== 'name' && { alignItems: 'center' }]}
          >
            {h ? (
              <h.Icon size={15} color={h.color} />
            ) : (
              <Text style={styles.tHeadText} numberOfLines={1}>
                {c.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export type RowMenuItem = {
  label: string;
  icon: any;
  color?: string;
  onPress: () => void;
};

export function AttendanceTableFooter() {
  return <View style={styles.tFoot} />;
}

export function AttendanceTableRow({
  cols,
  avatar,
  initials,
  name,
  sub,
  cells,
  status,
  menu,
  details,
  extra,
  warn,
}: {
  index?: number;
  cols: TableCol[];
  avatar?: string;
  initials: string;
  name: string;
  sub?: string;
  cells: Record<string, React.ReactNode>;
  status: { label: string; color: string; bg: string; icon?: any };
  menu?: RowMenuItem[];
  extra?: React.ReactNode;
  details: { label: string; value?: string | number | null }[];
  warn?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const StatusIcon = status.icon;
  const sentence = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const shown = details.filter(
    r => r.value !== undefined && r.value !== null && r.value !== '',
  );
  return (
    <View>
      <View style={[styles.tRow, warn && { backgroundColor: '#FFFBEB' }]}>
        {cols.map(c => {
          if (c.key === 'name')
            return (
              <View key={c.key} style={styles.tEmpCell}>
                {avatar ? (
                  <Image
                    source={{ uri: avatar }}
                    style={[styles.tAvatar, { borderColor: status.color }]}
                  />
                ) : (
                  <View
                    style={[
                      styles.tAvatar,
                      {
                        backgroundColor: colors.blue + '1A',
                        borderColor: status.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.blue,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tName} numberOfLines={2}>
                    {name}
                  </Text>
                  {!!sub && (
                    <View style={styles.tSubRow}>
                      <Text style={styles.tSub} numberOfLines={1}>
                        {sub}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          if (c.key === 'kebab' || c.key === 'chev') return null;
          if (c.key === 'status')
            return (
              <View key={c.key} style={{ width: c.width }}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: status.color + '1A',
                      borderColor: status.color,
                    },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: status.color }]}
                    numberOfLines={1}
                  >
                    {sentence(status.label)}
                  </Text>
                </View>
              </View>
            );
          const v = cells[c.key];
          const empty = v === undefined || v === null || v === '' || v === '—';
          return (
            <View key={c.key} style={{ width: c.width, alignItems: 'center' }}>
              {typeof v === 'string' || typeof v === 'number' ? (
                <Text
                  style={empty ? styles.tTimeEmpty : styles.tTime}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {empty ? '–' : v}
                </Text>
              ) : (
                v
              )}
            </View>
          );
        })}
        <View style={styles.tAct}>
          {!!menu?.length && (
            <TouchableOpacity
              onPress={() => setMenuOpen(true)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityLabel="More actions"
            >
              <EllipsisVertical size={18} color="#475569" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setIsOpen(o => !o)}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityLabel={isOpen ? 'Hide details' : 'Show details'}
          >
            {isOpen ? (
              <ChevronUp size={18} color={colors.blue} />
            ) : (
              <ChevronDown size={18} color={colors.blue} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Reveal open={isOpen}>
        <View style={styles.tDetail}>
          <View style={[styles.tDetailItem, { width: '100%' }]}>
            <View
              style={[
                styles.tStatusIcon,
                { backgroundColor: status.bg, borderColor: status.color },
              ]}
            >
              {StatusIcon ? (
                <StatusIcon size={14} color={status.color} />
              ) : null}
            </View>
            <Text style={[styles.tTime, { color: status.color }]}>
              {sentence(status.label)}
            </Text>
          </View>
          {shown.map(r => (
            <View key={r.label} style={styles.tDetailItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tSub}>{r.label}</Text>
                <Text style={styles.tTime}>{String(r.value)}</Text>
              </View>
            </View>
          ))}
          {extra ? <View style={{ width: '100%' }}>{extra}</View> : null}
        </View>
      </Reveal>
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle} numberOfLines={1}>
              {name}
            </Text>
            {(menu || []).map(m => (
              <TouchableOpacity
                key={m.label}
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  m.onPress();
                }}
              >
                <m.icon size={18} color={m.color || colors.blue} />
                <Text
                  style={[styles.menuText, m.color ? { color: m.color } : null]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  menuSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 6,
  },
  menuTitle: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuText: { fontSize: 14, color: colors.black },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: colors.black,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tHeadText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tFoot: {
    height: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: colors.black,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tDetail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tDetailItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tEmpCell: {
    flex: 2.4,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  tName: { fontSize: 13, color: colors.black, fontWeight: '400' },
  tSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tSub: { fontSize: 10, color: '#6B7280', flexShrink: 1 },
  tStatusIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tTime: { fontSize: 12, color: colors.black, fontWeight: '400' },
  tTimeEmpty: { fontSize: 12, color: '#D1D5DB' },
  tAct: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
