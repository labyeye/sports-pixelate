import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  Crown,
  LayoutGrid,
  LogOut as LogOutIcon,
  Search,
  User,
} from 'lucide-react-native';
import { notificationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { getNavGroupsForRole } from '../navigation/navConfig';
import { useDisabledFeatures } from '../utils/disabledFeatures';
import { colors, FONT } from '../theme/colors';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import SlideInCard from '../components/motion/SlideInCard';

const GROUP_COLORS = [
  colors.blue,
  '#22c55e',
  colors.orange,
  colors.blue,
  colors.orange,
  colors.black,
];

// Same layout as NestHR's More screen: header with search + bell, a compact
// profile card, then three-column icon tiles grouped by colour.
export default function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const disabledFeatures = useDisabledFeatures(!!user);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      notificationAPI
        .getAll({ limit: '1' })
        .then((r: any) => setUnread(r?.unreadCount || 0))
        .catch(() => {});
    }, []),
  );

  const q = query.trim().toLowerCase();
  const allSections = useMemo(() => {
    if (!user) return [];
    return getNavGroupsForRole(user.role, disabledFeatures).map((g, i) => ({
      ...g,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }));
  }, [user, disabledFeatures]);
  const sections = useMemo(
    () =>
      allSections
        .map(g => ({
          ...g,
          items: g.items.filter(
            it => !q || it.title.toLowerCase().includes(q),
          ),
        }))
        .filter(g => g.items.length > 0),
    [allSections, q],
  );

  if (!user) return null;

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  let cardIdx = 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LayoutGrid size={20} color={colors.blue} />
          <Text style={styles.headerTitle}>More</Text>
        </View>
        <View style={styles.headerRight}>
          <HeaderIconBtn
            label="Search"
            icon={<Search size={22} color={colors.black} />}
            dot={!!query}
            onPress={() => setSearchOpen(true)}
          />
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
            hitSlop={8}
          >
            <Bell size={22} color={colors.black} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={query}
        onChange={setQuery}
        placeholder="Search features…"
        items={allSections.flatMap(g =>
          g.items.map(it => ({
            key: `${g.label}-${it.screen}-${it.title}`,
            title: it.title,
            subtitle: g.label,
          })),
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <SlideInCard index={0}>
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.avatarWrap}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                ) : (
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(user.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.badge}>
                  <Crown size={12} color="#000" fill="#ffffff" />
                </View>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user.name || 'User'}
                </Text>
                {!!user.email && (
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                )}
                <View style={styles.rolePill}>
                  <Text style={styles.roleText}>
                    {(user.role || 'employee').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#eff6ff' }]}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.8}
                >
                  <User size={18} color={colors.blue} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <LogOutIcon size={18} color={colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SlideInCard>

        {sections.map(g => (
          <View key={g.label}>
            <View style={styles.grid}>
              {g.items.map(item => {
                const Icon = item.icon;
                const idx = cardIdx++;
                return (
                  <SlideInCard
                    key={`${g.label}-${item.screen}-${item.title}`}
                    index={idx}
                    style={styles.tileWrap}
                  >
                    <TouchableOpacity
                      style={styles.tile}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate(item.screen, item.params)}
                    >
                      <View
                        style={[
                          styles.tileIcon,
                          {
                            backgroundColor: g.color + '1A',
                            borderColor: g.color,
                          },
                        ]}
                      >
                        <Icon size={22} color={g.color} />
                      </View>
                      <Text style={styles.tileLabel} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  </SlideInCard>
                );
              })}
            </View>
          </View>
        ))}

        {sections.length === 0 && (
          <View style={styles.empty}>
            <Search size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No features match "{query}"</Text>
          </View>
        )}

        <Text style={styles.versionText}>NestAcademy v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: colors.black,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  headerTitle: {
    fontFamily: FONT.bold,
    fontSize: 20,
    fontWeight: '400',
    color: colors.black,
  },
  scroll: { padding: 16, gap: 16 },

  hero: { ...box, backgroundColor: colors.white, padding: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  userAvatar: {
    width: 56,
    height: 56,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 50,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: FONT.bold,
    color: colors.white,
    fontSize: 22,
    fontWeight: '400',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontFamily: FONT.bold,
    fontSize: 16,
    fontWeight: '400',
    color: colors.black,
  },
  profileEmail: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    fontWeight: '400',
    color: colors.black,
    textTransform: 'capitalize',
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '31.3%' },
  tile: {
    ...box,
    backgroundColor: colors.white,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 6,
    alignItems: 'center',
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  tileLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '400',
    color: colors.black,
    textAlign: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  versionText: {
    fontFamily: FONT.medium,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '400',
  },
  bellBtn: { padding: 4, position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontFamily: FONT.bold,
    color: colors.white,
    fontSize: 11,
    fontWeight: '400',
  },
});
