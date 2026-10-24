import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  LogOut as LogOutIcon,
  Search,
  User,
  X,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getNavGroupsForRole } from '../navigation/navConfig';
import { useDisabledFeatures } from '../utils/disabledFeatures';
import { colors, FONT } from '../theme/colors';

const GROUP_COLORS = [
  colors.blue,
  colors.green,
  colors.orange,
  colors.blue,
  colors.orange,
  colors.black,
];
const TILE_W = (Dimensions.get('window').width - 32 - 12) / 2;

// NestHR's More screen: profile hero, search, then colour-coded groups of two-column tiles.
export default function MenuScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const disabledFeatures = useDisabledFeatures(!!user);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!user) return [];
    return getNavGroupsForRole(user.role, disabledFeatures)
      .map((g, i) => ({
        ...g,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
        items: g.items.filter(
          it =>
            !q ||
            it.title.toLowerCase().includes(q) ||
            (it.desc || '').toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [user, disabledFeatures, q]);

  if (!user) return null;

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={22} color={colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {(user.name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
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
                  {(user.role || 'employee').replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBtns}>
            <TouchableOpacity
              style={[styles.heroBtn, styles.heroBtnBlue]}
              onPress={() => navigation.navigate('Profile')}
            >
              <User size={15} color={colors.blue} />
              <Text style={[styles.heroBtnText, { color: colors.blue }]}>
                Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroBtn, styles.heroBtnRed]}
              onPress={handleLogout}
            >
              <LogOutIcon size={15} color={colors.red} />
              <Text style={[styles.heroBtnText, { color: colors.red }]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color="#000" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search features..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {sections.map(g => (
          <View key={g.label}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{g.label.toUpperCase()}</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.grid}>
              {g.items.map(item => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={`${g.label}-${item.screen}-${item.title}`}
                    style={styles.tile}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate(item.screen)}
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
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.tileSub} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
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

        <Text style={styles.versionText}>NestPlay v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex1: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontFamily: FONT.bold,
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  bellBtn: { padding: 4 },
  scroll: { padding: 16, gap: 18 },

  hero: { ...box, backgroundColor: '#fff', padding: 14, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  userAvatar: {
    width: 64,
    height: 64,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: FONT.bold,
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  profileName: {
    fontFamily: FONT.bold,
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  profileEmail: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFDE00',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  heroBtns: { flexDirection: 'row', gap: 10 },
  heroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
  },
  heroBtnBlue: { backgroundColor: '#eff6ff' },
  heroBtnRed: { backgroundColor: '#fef2f2' },
  heroBtnText: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '800' },

  searchBox: {
    ...box,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: FONT.medium,
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  sectionLine: { flex: 1, height: 2, backgroundColor: '#000', marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    ...box,
    width: TILE_W,
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
    minHeight: 124,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  tileSub: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 15,
  },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  versionText: {
    fontFamily: FONT.medium,
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
