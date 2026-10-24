import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Bell, CheckCheck, ChevronLeft } from 'lucide-react-native';
import { notificationAPI } from '../api/client';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

function relativeTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await notificationAPI.getAll({ limit: '50' });
      setItems(res.data || []);
      setUnread(res.unreadCount || 0);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = async (n: any) => {
    if (n.read) return;
    setItems(list =>
      list.map(x => (x._id === n._id ? { ...x, read: true } : x)),
    );
    setUnread(u => Math.max(0, u - 1));
    try {
      await notificationAPI.markRead(n._id);
    } catch (e) {
      notifyError(e);
      load();
    }
  };

  const readAll = async () => {
    try {
      await notificationAPI.markAllRead();
      setItems(list => list.map(x => ({ ...x, read: true })));
      setUnread(0);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={readAll}
          disabled={unread === 0}
          hitSlop={10}
          style={[styles.readAll, unread === 0 && { opacity: 0.35 }]}
        >
          <CheckCheck size={20} color={colors.blue} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.blue} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bell size={36} color={colors.muted} />
              <Text style={styles.emptyText}>You're all caught up</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => open(item)}
              style={[styles.card, !item.read && styles.cardUnread]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.cardMsg}>{item.message}</Text>
              <Text style={styles.cardTime}>
                {relativeTime(item.createdAt)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
  },
  readAll: { padding: 4 },
  loader: { marginTop: 40 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText: { fontFamily: FONT.medium, color: colors.muted, fontSize: 14 },
  card: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: colors.black,
    backgroundColor: colors.white,
    padding: 12,
  },
  cardUnread: { backgroundColor: '#EAF2FF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: {
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '800',
    color: colors.black,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue },
  cardMsg: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: colors.black,
    marginTop: 4,
  },
  cardTime: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
});
