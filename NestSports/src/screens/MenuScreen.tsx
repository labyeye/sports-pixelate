import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getNavGroupsForRole } from '../navigation/navConfig';
import { colors } from '../theme/colors';

export default function MenuScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const groups = getNavGroupsForRole(user.role);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.role}>{user.role?.replace(/_/g, ' ')}</Text>
          </View>
        </View>

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
                >
                  <View style={styles.itemLeft}>
                    <item.icon size={18} color={colors.black} strokeWidth={2} />
                    <Text style={styles.itemText}>{item.title}</Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.muted}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.signOut} onPress={logout}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
    marginBottom: 20,
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
  name: { fontWeight: '800', fontSize: 15, color: colors.black },
  role: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
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
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#0000001A' },
  itemText: { fontWeight: '700', color: colors.black, fontSize: 14 },
  signOut: {
    borderWidth: 2,
    borderColor: colors.red,
    padding: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  signOutText: { color: colors.red, fontWeight: '800' },
});
