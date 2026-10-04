import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TextInput,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Power, Users, UserCheck } from 'lucide-react-native';
import { sportAPI } from '../api/client';
import { Card, EmptyState, LoadingView } from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import { notifyError } from '../utils/notifyError';

interface Group {
  _id: string;
  name: string;
  active: boolean;
  studentCount: number;
  coachCount: number;
  collectedThisMonth?: number;
  remainingThisMonth?: number;
}

// Groups = the classes an academy runs (Dance, Art, Cricket…). Each is a Sport
// record; this screen shows headcount plus this month's collected/remaining fees.
export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await sportAPI.getAll();
      setGroups(res.data || []);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await sportAPI.create({ name: trimmed });
      setName('');
      await load();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (g: Group) => {
    const run = async () => {
      try {
        await sportAPI.update(g._id, { active: !g.active });
        await load();
      } catch (e) {
        notifyError(e);
      }
    };
    if (!g.active) return run();
    Alert.alert('Deactivate group?', `${g.name} will be hidden from pickers.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: run },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.addRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New group (e.g. Dance)"
          maxLength={60}
          style={styles.input}
        />
        <TouchableOpacity
          onPress={add}
          disabled={saving || !name.trim()}
          style={[styles.addBtn, (saving || !name.trim()) && { opacity: 0.5 }]}
        >
          <Plus size={18} color={colors.black} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={groups}
        keyExtractor={(g) => g._id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState title="No groups yet" sub="Add Dance, Art, Cricket…" />
        }
        renderItem={({ item: g }) => {
          const collected = g.collectedThisMonth || 0;
          const remaining = g.remainingThisMonth || 0;
          return (
            <Card style={{ marginBottom: 12, opacity: g.active ? 1 : 0.5 }}>
              <View style={styles.head}>
                <Text style={styles.name}>
                  {g.name}
                  {g.active ? '' : ' (inactive)'}
                </Text>
                <TouchableOpacity onPress={() => toggle(g)}>
                  <Power size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <View style={styles.counts}>
                <Users size={14} color={colors.black} />
                <Text style={styles.count}>{g.studentCount} students</Text>
                <UserCheck size={14} color={colors.black} />
                <Text style={styles.count}>{g.coachCount} coaches</Text>
              </View>
              <View style={styles.head}>
                <Text style={{ color: colors.green, fontFamily: FONT.bold }}>
                  {formatCurrency(collected)} collected
                </Text>
                <Text style={{ color: colors.orange, fontFamily: FONT.bold }}>
                  {formatCurrency(remaining)} remaining
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  addRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONT.medium,
  },
  addBtn: {
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: colors.black },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 },
  count: { fontFamily: FONT.medium, fontSize: 13, marginRight: 10 },
});
