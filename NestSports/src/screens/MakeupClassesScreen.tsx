// Make-up classes (mobile): reschedule a missed class, notify parents, then
// mark attended / missed. Mirrors web MakeupClassesPage. Backend: makeupAPI.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock, Plus, Trash2, X } from 'lucide-react-native';
import { makeupAPI, studentAPI } from '../api/client';
import {
  Badge,
  Button,
  DateTimeField,
  EmptyState,
  FilterPills,
  LoadingView,
  TextField,
} from '../components/ui';
import ScreenHeader, { headerBtn } from '../components/ScreenHeader';
import SlideInCard from '../components/motion/SlideInCard';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

type Status = 'scheduled' | 'completed' | 'missed' | 'cancelled';
const STATUSES: Status[] = ['scheduled', 'completed', 'missed', 'cancelled'];
const LABEL: Record<Status, string> = {
  scheduled: 'Scheduled',
  completed: 'Attended',
  missed: 'Missed',
  cancelled: 'Cancelled',
};
const COLOR: Record<Status, string> = {
  scheduled: colors.blue,
  completed: colors.green,
  missed: colors.red,
  cancelled: colors.muted,
};
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const EMPTY = {
  student: '',
  missedDate: '',
  scheduledDate: '',
  startTime: '',
  batch: '',
  note: '',
};

export default function MakeupClassesScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'' | Status>('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await makeupAPI.getAll();
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

  const openForm = async () => {
    setForm({ ...EMPTY });
    setQ('');
    setFormOpen(true);
    if (!students.length) {
      try {
        const r: any = await studentAPI.getAll({ limit: '500' });
        setStudents(r.data || []);
      } catch (e) {
        notifyError(e);
      }
    }
  };

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return students
      .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(t))
      .slice(0, 6);
  }, [q, students]);
  const picked = students.find(s => s._id === form.student);

  const save = async () => {
    if (saving) return;
    if (!form.student || !form.scheduledDate) {
      Alert.alert('Required', 'Pick a student and a make-up date');
      return;
    }
    setSaving(true);
    try {
      await makeupAPI.create({
        ...form,
        missedDate: form.missedDate || undefined,
        startTime: form.startTime || undefined,
      });
      setFormOpen(false);
      await load();
    } catch (e) {
      notifyError(e);
    }
    setSaving(false);
  };

  const setStatus = async (m: any, status: Status) => {
    try {
      const r: any = await makeupAPI.update(m._id, { status });
      setItems(p => p.map(x => (x._id === m._id ? { ...x, ...r.data } : x)));
    } catch (e) {
      notifyError(e);
    }
  };

  const remove = (m: any) =>
    Alert.alert('Delete', 'Delete this make-up class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await makeupAPI.delete(m._id);
            setItems(p => p.filter(x => x._id !== m._id));
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  if (loading) return <LoadingView />;
  const shown = filter ? items.filter(i => i.status === filter) : items;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader
        title="Make-up Classes"
        right={
          <TouchableOpacity onPress={openForm} style={headerBtn} hitSlop={8}>
            <Plus size={24} color={colors.blue} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={shown}
        keyExtractor={m => m._id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
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
          <FilterPills
            options={[
              { value: '', label: 'All' },
              ...STATUSES.map(s => ({ value: s, label: LABEL[s] })),
            ]}
            value={filter}
            onChange={v => setFilter(v as '' | Status)}
          />
        }
        ListEmptyComponent={
          <EmptyState title="No make-up classes" icon={CalendarClock} />
        }
        renderItem={({ item: m, index }) => (
          <SlideInCard index={index}>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {m.student?.firstName} {m.student?.lastName}
                </Text>
                <Badge
                  label={LABEL[m.status as Status]}
                  color={COLOR[m.status as Status]}
                />
              </View>
              <Text style={styles.meta}>
                {fmt(m.scheduledDate)}
                {m.startTime ? ` at ${m.startTime}` : ''}
                {m.batch ? ` · ${m.batch}` : ''}
                {m.sport ? ` · ${m.sport}` : ''}
              </Text>
              {!!m.missedDate && (
                <Text style={styles.meta}>Missed on {fmt(m.missedDate)}</Text>
              )}
              {!!m.note && <Text style={styles.meta}>{m.note}</Text>}
              <View style={[styles.row, { marginTop: 10, justifyContent: 'flex-start' }]}>
                {m.status === 'scheduled' &&
                  (['completed', 'missed', 'cancelled'] as Status[]).map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setStatus(m, s)}
                      style={styles.pill}
                    >
                      <Text style={styles.pillText}>{LABEL[s]}</Text>
                    </TouchableOpacity>
                  ))}
                <TouchableOpacity
                  onPress={() => remove(m)}
                  style={{ marginLeft: 'auto' }}
                  hitSlop={8}
                >
                  <Trash2 size={16} color={colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          </SlideInCard>
        )}
      />

      <Modal
        visible={formOpen}
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHead}>
            <Text style={styles.formTitle}>Schedule make-up class</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {picked ? (
                <View style={styles.picked}>
                  <Text style={styles.title}>
                    {picked.firstName} {picked.lastName}
                    {picked.batch ? ` · ${picked.batch}` : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, student: '' })}
                  >
                    <Text style={styles.link}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={styles.search}
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search student…"
                    placeholderTextColor={colors.muted}
                  />
                  {matches.map(s => (
                    <TouchableOpacity
                      key={s._id}
                      style={styles.match}
                      onPress={() =>
                        setForm({ ...form, student: s._id, batch: s.batch || '' })
                      }
                    >
                      <Text style={styles.meta}>
                        {s.firstName} {s.lastName} · {s.sport} {s.batch}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <DateTimeField
                label="Missed on"
                value={form.missedDate}
                onChangeText={v => setForm({ ...form, missedDate: v })}
              />
              <DateTimeField
                label="Make-up date"
                value={form.scheduledDate}
                onChangeText={v => setForm({ ...form, scheduledDate: v })}
              />
              <TextField
                label="Start time (HH:MM)"
                value={form.startTime}
                onChangeText={v => setForm({ ...form, startTime: v })}
                placeholder="16:00"
              />
              <TextField
                label="Batch to attend"
                value={form.batch}
                onChangeText={v => setForm({ ...form, batch: v })}
              />
              <TextField
                label="Note"
                value={form.note}
                onChangeText={v => setForm({ ...form, note: v })}
                multiline
              />
              <Button
                title="Schedule & notify parents"
                onPress={save}
                loading={saving}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 15,
    color: colors.black,
  },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
  },
  pillText: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 11,
    color: colors.black,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  formTitle: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 18,
    color: colors.black,
  },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  search: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONT.medium,
    color: colors.black,
  },
  match: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: colors.black,
    padding: 10,
  },
  link: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 12,
    color: colors.blue,
    textDecorationLine: 'underline',
  },
});
