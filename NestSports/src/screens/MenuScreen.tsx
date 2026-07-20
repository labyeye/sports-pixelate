import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Grid,
  ChevronRight,
  LogOut as LogOutIcon,
  User,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getNavGroupsForRole } from '../navigation/navConfig';
import { colors } from '../theme/colors';

export default function MenuScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const groups = getNavGroupsForRole(user.role);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Grid size={20} color={colors.blue} />
          <Text style={styles.headerTitle}>More</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.userStrip}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
      >
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatarPhoto} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.role}>
            {user.role?.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <View style={styles.editBtn}>
          <User size={14} color={colors.blue} />
          <Text style={styles.editBtnText}>Edit</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOutIcon size={16} color={colors.red} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map(group => (
          <View key={group.label} style={{ marginBottom: 18 }}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.screen + item.title}
                  style={[
                    styles.item,
                    i < group.items.length - 1 && styles.itemBorder,
                  ]}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconWrap}>
                    <item.icon size={18} color={colors.blue} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{item.title}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                  <ChevronRight
                    size={16}
                    color={colors.muted}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.versionText}>NestSports v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.black },
  userStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800', fontSize: 18 },
  avatarPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.black,
  },
  name: { fontWeight: '800', fontSize: 15, color: colors.black },
  role: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.blue,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blue,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 2,
    borderColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.red,
    textTransform: 'uppercase',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  groupCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#0000001A' },
  itemIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.black,
  },
  itemText: { fontWeight: '700', color: colors.black, fontSize: 14 },
  itemDesc: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 30,
  },
});
