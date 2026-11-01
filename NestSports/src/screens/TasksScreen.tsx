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
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { employeeAPI, taskAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Badge,
  Button,
  ChipSelect,
  DateTimeField,
  EmptyState,
  FilterPills,
  LoadingView,
  TextField,
} from '../components/ui';
import ScreenHeader, { headerBtn } from '../components/ScreenHeader';
import StatTile from '../components/common/StatTile';
import SlideInCard from '../components/motion/SlideInCard';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

type Status = 'pending' | 'in_progress' | 'completed';
const STATUSES: Status[] = ['pending', 'in_progress', 'completed'];
const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};
const STATUS_COLOR: Record<Status, string> = {
  pending: colors.muted,
  in_progress: colors.blue,
  completed: colors.green,
};
const PRIORITIES = ['low', 'medium', 'high'] as const;
const PRIORITY_COLOR: Record<string, string> = {
  low: colors.muted,
  medium: colors.orange,
  high: colors.red,
};

const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'No due date';

const EMPTY = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'medium' as (typeof PRIORITIES)[number],
  dueDate: '',
};

export default function TasksScreen() {
  const { user } = useAuth();
  const canAssign =
    user?.role === 'super_admin' ||
    user?.role === 'hr_manager' ||
    (user?.role as string) === 'department_head';
  const [tasks, setTasks] = useState<any[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'' | Status>('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      const r: any = await taskAPI.getAll();
      setTasks(r.data || []);
    } catch (e) {
      notifyError(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    employeeAPI
      .getAll({ limit: '200' })
      .then((r: any) =>
        setStaff(
          (r.data || [])
            .filter((e: any) => e.user)
            .map((e: any) => ({
              id: String(e.user?._id || e.user),
              name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            })),
        ),
      )
      .catch(() => {});
  }, [canAssign]);

  const shown = useMemo(
    () => (filter ? tasks.filter(t => t.status === filter) : tasks),
    [tasks, filter],
  );
  const count = (s: Status) => tasks.filter(t => t.status === s).length;

  const merge = (t: any) => {
    setTasks(p => p.map(x => (x._id === t._id ? { ...x, ...t } : x)));
    setOpen((o: any) => (o && o._id === t._id ? { ...o, ...t } : o));
  };

  const changeStatus = async (t: any, status: Status) => {
    try {
      const r: any = await taskAPI.updateStatus(t._id, status);
      merge(r.data);
    } catch (e) {
      notifyError(e);
    }
  };

  const openTask = async (t: any) => {
    setOpen(t);
    setComment('');
    try {
      const r: any = await taskAPI.getOne(t._id);
      setOpen(r.data);
    } catch {
      // keep the list copy
    }
  };

  const sendComment = async () => {
    if (!open || !comment.trim()) return;
    try {
      const r: any = await taskAPI.addComment(open._id, comment.trim());
      setOpen({ ...open, comments: r.data.comments });
      setComment('');
    } catch (e) {
      notifyError(e);
    }
  };

  const save = async () => {
    if (saving) return;
    if (!form.title.trim() || !form.assignedTo) {
      Alert.alert('Required', 'Title and assignee are required');
      return;
    }
    setSaving(true);
    try {
      await taskAPI.create({ ...form, dueDate: form.dueDate || undefined });
      setFormOpen(false);
      setForm({ ...EMPTY });
      await load();
    } catch (e) {
      notifyError(e);
    }
    setSaving(false);
  };

  const remove = (t: any) =>
    Alert.alert('Delete task', `Delete "${t.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await taskAPI.delete(t._id);
            setTasks(p => p.filter(x => x._id !== t._id));
            setOpen(null);
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  if (loading) return <LoadingView />;

  const staffNames = staff.map(s => s.name);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader
        title="Tasks"
        right={
          canAssign ? (
            <TouchableOpacity
              onPress={() => setFormOpen(true)}
              style={headerBtn}
              hitSlop={8}
            >
              <Plus size={20} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <FlatList
        data={shown}
        keyExtractor={t => t._id}
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
          <View>
            <View style={styles.kpiGrid}>
              <StatTile
                label="Total"
                value={tasks.length}
                color={colors.blue}
                icon={ListChecks}
              />
              <StatTile
                label="Pending"
                value={count('pending')}
                color={colors.orange}
                icon={Clock}
              />
              <StatTile
                label="In Progress"
                value={count('in_progress')}
                color={colors.purple}
                icon={Loader}
              />
              <StatTile
                label="Completed"
                value={count('completed')}
                color={colors.green}
                icon={CheckCircle2}
              />
            </View>
            <FilterPills
              options={[
                { value: '', label: 'All' },
                ...STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] })),
              ]}
              value={filter}
              onChange={v => setFilter(v as '' | Status)}
            />
          </View>
        }
        ListEmptyComponent={<EmptyState title="No tasks" icon={ListChecks} />}
        renderItem={({ item: t, index }) => (
          <SlideInCard index={index}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openTask(t)}
              style={styles.card}
            >
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={2}>
                  {t.title}
                </Text>
                <Badge
                  label={STATUS_LABEL[t.status as Status]}
                  color={STATUS_COLOR[t.status as Status]}
                />
              </View>
              <Text style={styles.meta}>
                {canAssign ? `To ${t.assignedTo?.name} · ` : ''}Due{' '}
                {fmt(t.dueDate)}
              </Text>
              <View style={[styles.row, { marginTop: 8, justifyContent: 'flex-start' }]}>
                <Badge label={t.priority} color={PRIORITY_COLOR[t.priority]} />
                {t.late && t.status !== 'completed' && (
                  <View style={styles.late}>
                    <AlertTriangle size={11} color={colors.red} strokeWidth={2.5} />
                    <Text style={styles.lateText}>Late</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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
            <Text style={styles.formTitle}>New task</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TextField
                label="Title"
                value={form.title}
                onChangeText={v => setForm({ ...form, title: v })}
                required
              />
              <TextField
                label="Description"
                value={form.description}
                onChangeText={v => setForm({ ...form, description: v })}
                multiline
              />
              <ChipSelect
                label="Assign to"
                options={staffNames as readonly string[]}
                value={staff.find(s => s.id === form.assignedTo)?.name || ''}
                onChange={n =>
                  setForm({
                    ...form,
                    assignedTo: staff.find(s => s.name === n)?.id || '',
                  })
                }
              />
              <ChipSelect
                label="Priority"
                options={PRIORITIES}
                value={form.priority}
                onChange={v => setForm({ ...form, priority: v })}
              />
              <DateTimeField
                label="Due date"
                value={form.dueDate}
                onChangeText={v => setForm({ ...form, dueDate: v })}
              />
              <Button title="Assign task" onPress={save} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!open}
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHead}>
            <Text style={[styles.formTitle, { flex: 1 }]} numberOfLines={2}>
              {open?.title}
            </Text>
            <TouchableOpacity onPress={() => setOpen(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              {!!open?.description && (
                <Text style={styles.desc}>{open.description}</Text>
              )}
              <Text style={styles.meta}>
                Assigned to {open?.assignedTo?.name} by {open?.assignedBy?.name}{' '}
                · Due {fmt(open?.dueDate)}
              </Text>
              <View style={styles.statusRow}>
                {STATUSES.map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => changeStatus(open, s)}
                    style={[
                      styles.statusBtn,
                      open?.status === s && {
                        backgroundColor: colors.black,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBtnText,
                        open?.status === s && { color: colors.white },
                      ]}
                    >
                      {STATUS_LABEL[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.section}>Comments</Text>
              {(open?.comments || []).map((c: any) => (
                <View key={c._id} style={styles.comment}>
                  <Text style={styles.commentText}>
                    <Text style={{ fontFamily: FONT.bold }}>
                      {c.user?.name}:{' '}
                    </Text>
                    {c.message}
                  </Text>
                </View>
              ))}
              {!open?.comments?.length && (
                <Text style={styles.meta}>No comments yet</Text>
              )}
              <View style={styles.commentRow}>
                <TextInput
                  style={styles.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment…"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity onPress={sendComment} style={styles.send}>
                  <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
              </View>
              {canAssign && (
                <TouchableOpacity
                  onPress={() => remove(open)}
                  style={styles.del}
                >
                  <Trash2 size={15} color={colors.red} strokeWidth={2.5} />
                  <Text style={styles.delText}>Delete task</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
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
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  late: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lateText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.red,
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
    fontWeight: '700',
    fontSize: 18,
    color: colors.black,
  },
  desc: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.black,
  },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
  },
  statusBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  section: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
    marginTop: 8,
  },
  comment: {
    backgroundColor: '#F4F4F4',
    borderRadius: 8,
    padding: 10,
  },
  commentText: { fontFamily: FONT.medium, fontSize: 13, color: colors.black },
  commentRow: { flexDirection: 'row', gap: 8 },
  commentInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONT.medium,
    color: colors.black,
  },
  send: {
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: colors.white,
    fontSize: 12,
  },
  del: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  delText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.red,
  },
});
