import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, X, CalendarDays, CalendarClock } from 'lucide-react-native';
import { holidayAPI } from '../api/client';
import {
  Card,
  Row,
  EmptyState,
  LoadingView,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const TYPE_OPTIONS = ['national', 'optional', 'restricted'] as const;

const EMPTY_FORM = {
  name: '',
  date: '',
  type: 'national' as (typeof TYPE_OPTIONS)[number],
  description: '',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function HolidaysScreen() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      holidayAPI
        .getAll()
        .then((res: any) => res.success && setHolidays(res.data || [])),
    [],
  );

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const openAdd = () => {
    setEditingHoliday(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEdit = (h: any) => {
    setEditingHoliday(h);
    setForm({
      name: h.name || '',
      date: h.date ? String(h.date).slice(0, 10) : '',
      type: h.type || 'national',
      description: h.description || '',
    });
    setFormVisible(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.date.trim()) {
      Alert.alert('Missing fields', 'Holiday name and date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        date: form.date.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
      };
      if (editingHoliday) {
        await holidayAPI.update(editingHoliday._id, payload);
      } else {
        await holidayAPI.create(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save holiday');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (h: any) => {
    Alert.alert('Delete Holiday', `Remove ${h.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await holidayAPI.delete(h._id);
            setHolidays(prev => prev.filter(x => x._id !== h._id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete holiday');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Holidays</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
          <Plus size={14} color={colors.white} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Holidays"
            value={holidays.length}
            sub="Total"
            color={colors.blue}
            icon={CalendarDays}
          />
          <KpiTile
            label="Upcoming"
            value={
              holidays.filter(h => new Date(h.date) >= new Date(new Date().toDateString()))
                .length
            }
            sub="From today onward"
            color={colors.orange}
            icon={CalendarClock}
          />
        </View>

        <Card>
          {holidays.length === 0 ? (
            <EmptyState title="No holidays found" />
          ) : (
            holidays.map((h: any) => (
              <Row
                key={h._id}
                title={h.name}
                subtitle={`${formatDate(h.date)} · ${h.type}`}
                onPress={() => openEdit(h)}
                right={
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(h)}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                  </TouchableOpacity>
                }
              />
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <SectionTitle title="Holiday Details" />
            <TextField
              label="Name"
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
              placeholder="e.g. Republic Day"
              required
            />
            <TextField
              label="Date"
              value={form.date}
              onChangeText={v => setForm(p => ({ ...p, date: v }))}
              placeholder="YYYY-MM-DD"
              required
            />
            <ChipSelect
              label="Type"
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={v => setForm(p => ({ ...p, type: v }))}
            />
            <TextField
              label="Description"
              value={form.description}
              onChangeText={v => setForm(p => ({ ...p, description: v }))}
              placeholder="Optional description"
              multiline
            />
            <Button
              title={saving ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Save Holiday'}
              onPress={save}
              disabled={saving}
            />
            {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    backgroundColor: colors.white,
  },
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
});
