import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, Trash2 } from 'lucide-react-native';
import { trashAPI } from '../api/client';
import { EmptyState, LoadingView } from '../components/ui';
import ScreenHeader from '../components/ScreenHeader';
import SlideInCard from '../components/motion/SlideInCard';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

const LABEL: Record<string, string> = {
  Leave: 'Leave request',
  Announcement: 'Announcement',
  EmployeeDocument: 'Document',
  Expense: 'Expense',
};

const summary = (t: any) => {
  const d = t.data || {};
  return (
    d.title || d.name || d.reason || d.leaveType || d.category || 'Deleted item'
  );
};

export default function TrashScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await trashAPI.getAll();
      setItems(r.data || []);
    } catch (e) {
      notifyError(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (t: any) => {
    try {
      await trashAPI.restore(t._id);
      setItems(p => p.filter(x => x._id !== t._id));
    } catch (e) {
      notifyError(e);
    }
  };
  const purge = (t: any) =>
    Alert.alert('Delete forever', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: async () => {
          try {
            await trashAPI.purge(t._id);
            setItems(p => p.filter(x => x._id !== t._id));
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  if (loading) return <LoadingView />;
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title="Trash" />
      <FlatList
        data={items}
        keyExtractor={t => t._id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListHeaderComponent={
          <Text style={styles.note}>
            Deleted items are kept for 30 days, then removed for good.
          </Text>
        }
        ListEmptyComponent={<EmptyState title="Trash is empty" />}
        renderItem={({ item: t, index }) => (
          <SlideInCard index={index}>
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.type}>
                  {LABEL[t.modelName] || t.modelName}
                </Text>
                <Text style={styles.name} numberOfLines={2}>
                  {summary(t)}
                </Text>
                <Text style={styles.meta}>
                  Deleted{t.deletedByName ? ` by ${t.deletedByName}` : ''} ·{' '}
                  {new Date(t.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => restore(t)} hitSlop={8}>
                <RotateCcw size={20} color={colors.blue} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => purge(t)} hitSlop={8}>
                <Trash2 size={20} color={colors.red} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </SlideInCard>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  note: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 14,
  },
  type: {
    fontFamily: FONT.bold,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  name: { fontFamily: FONT.bold, fontSize: 15, color: colors.black },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
