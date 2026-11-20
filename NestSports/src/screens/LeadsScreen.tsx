// Enquiries (mobile): admission pipeline — log an enquiry, book a trial,
// follow up, waitlist, then enrol as a student or mark lost. Mirrors the web
// LeadsPage. Backend: leadAPI (/api/leads).
import React, { useCallback, useEffect, useState } from 'react';
import WhatsAppIcon from '../components/WhatsAppIcon';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
  Phone,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react-native';
import { leadAPI } from '../api/client';
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

type Status =
  | 'new'
  | 'contacted'
  | 'trial_scheduled'
  | 'trial_done'
  | 'waitlisted'
  | 'converted'
  | 'lost';
const STATUSES: Status[] = [
  'new',
  'contacted',
  'trial_scheduled',
  'trial_done',
  'waitlisted',
  'converted',
  'lost',
];
const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  contacted: 'Contacted',
  trial_scheduled: 'Trial Booked',
  trial_done: 'Trial Done',
  waitlisted: 'Waitlist',
  converted: 'Joined',
  lost: 'Lost',
};
const STATUS_COLOR: Record<Status, string> = {
  new: colors.blue,
  contacted: colors.muted,
  trial_scheduled: '#7C3AED',
  trial_done: colors.orange,
  waitlisted: '#B58900',
  converted: colors.green,
  lost: colors.red,
};
const SOURCES = [
  'walk_in',
  'phone',
  'referral',
  'instagram',
  'facebook',
  'website',
  'hoarding',
  'other',
] as const;

const label = (s: string) =>
  s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const dateInput = (d?: string) => (d ? d.slice(0, 10) : '');
const isOverdue = (l: any) =>
  !!l.followUpDate &&
  l.status !== 'converted' &&
  l.status !== 'lost' &&
  new Date(l.followUpDate) < new Date(new Date().toDateString());

const EMPTY = {
  childName: '',
  age: '',
  guardianName: '',
  phone: '',
  email: '',
  sport: '',
  batch: '',
  source: 'walk_in' as string,
  followUpDate: '',
};

export default function LeadsScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === 'super_admin' || user?.role === 'hr_manager';
  const [leads, setLeads] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'' | Status>('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [note, setNote] = useState('');
  const [trial, setTrial] = useState('');
  const [follow, setFollow] = useState('');

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      if (search.trim()) params.search = search.trim();
      const r: any = await leadAPI.getAll(params);
      setLeads(r.data || []);
      setSummary(r.summary || null);
    } catch (e) {
      notifyError(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [filter, search]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const merge = (l: any) => {
    setLeads(p => p.map(x => (x._id === l._id ? { ...x, ...l } : x)));
    setOpen((o: any) => (o && o._id === l._id ? { ...o, ...l } : o));
  };

  const openLead = (l: any) => {
    setOpen(l);
    setNote('');
    setTrial(dateInput(l.trialDate));
    setFollow(dateInput(l.followUpDate));
  };

  const startNew = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setFormOpen(true);
  };
  const startEdit = (l: any) => {
    setEditId(l._id);
    setForm({
      childName: l.childName,
      age: l.age != null ? String(l.age) : '',
      guardianName: l.guardianName || '',
      phone: l.phone,
      email: l.email || '',
      sport: l.sport || '',
      batch: l.batch || '',
      source: l.source,
      followUpDate: dateInput(l.followUpDate),
    });
    setOpen(null);
    setFormOpen(true);
  };

  const save = async () => {
    if (saving) return;
    if (!form.childName.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Child name and phone are required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        age: form.age === '' ? undefined : Number(form.age),
        followUpDate: form.followUpDate || undefined,
      };
      if (editId) await leadAPI.update(editId, body);
      else await leadAPI.create(body);
      setFormOpen(false);
      setEditId(null);
      await load();
    } catch (e) {
      notifyError(e);
    }
    setSaving(false);
  };

  const send = async (l: any, status: Status, extra: object = {}) => {
    try {
      const r: any = await leadAPI.updateStatus(l._id, { status, ...extra });
      merge(r.data);
      load();
    } catch (e) {
      notifyError(e);
    }
  };

  const changeStatus = (l: any, status: Status) => {
    if (status === 'trial_scheduled') {
      if (!trial) {
        Alert.alert('Trial date', 'Pick a trial date first');
        return;
      }
      return send(l, status, { trialDate: trial });
    }
    if (status === 'lost') {
      return Alert.prompt
        ? Alert.prompt('Mark as lost', 'Reason (optional)', reason =>
            send(l, status, { lostReason: reason || '' }),
          )
        : send(l, status);
    }
    return send(l, status);
  };

  const saveFollowUp = async () => {
    if (!open) return;
    try {
      const r: any = await leadAPI.updateStatus(open._id, {
        status: open.status,
        followUpDate: follow || '',
      });
      merge(r.data);
      load();
    } catch (e) {
      notifyError(e);
    }
  };

  const doConvert = async (l: any, sport: string) => {
    try {
      await leadAPI.convert(l._id, { sport, guardianConsent: true });
      Alert.alert(
        'Student enrolled',
        'Add a plan from Subscriptions to start billing.',
      );
      setOpen(null);
      load();
    } catch (e) {
      notifyError(e);
    }
  };
  const convert = (l: any) => {
    const go = (sport: string) =>
      Alert.alert(
        'Enrol student',
        `Enrol ${l.childName}? By continuing you confirm the parent/guardian agreed to the Terms & Privacy Policy and to storing the child's data.`,
        [
        { text: 'Cancel', style: 'cancel' },
          { text: 'Enrol', onPress: () => doConvert(l, sport) },
        ],
      );
    if (l.sport) return go(l.sport);
    if (Alert.prompt) {
      return Alert.prompt('Sport', 'Which sport is the student joining?', s => {
        if (s?.trim()) go(s.trim());
      });
    }
    Alert.alert('Add a sport', 'Edit the enquiry and set a sport first.');
  };

  const addNote = async () => {
    if (!open || !note.trim()) return;
    try {
      const r: any = await leadAPI.addNote(open._id, note.trim());
      merge(r.data);
      setNote('');
    } catch (e) {
      notifyError(e);
    }
  };

  const remove = (l: any) =>
    Alert.alert('Delete enquiry', `Delete enquiry for ${l.childName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await leadAPI.delete(l._id);
            setOpen(null);
            load();
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  const whatsapp = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${d.length === 10 ? '91' + d : d}`);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader
        title="Enquiries"
        right={
          <TouchableOpacity onPress={startNew} style={headerBtn} hitSlop={8}>
            <Plus size={24} color={colors.blue} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={leads}
        keyExtractor={l => l._id}
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
          <View style={{ gap: 10 }}>
            <View style={styles.kpiGrid}>
              <StatTile label="Total" value={summary?.total ?? 0} />
              <StatTile label="New" value={summary?.byStatus?.new ?? 0} />
              <StatTile
                label="Trials"
                value={summary?.byStatus?.trial_scheduled ?? 0}
              />
              <StatTile
                label="Conversion"
                value={`${summary?.conversionRate ?? 0}%`}
              />
            </View>
            {!!summary?.overdueFollowUps && (
              <Text style={styles.overdue}>
                {summary.overdueFollowUps} follow-up
                {summary.overdueFollowUps > 1 ? 's' : ''} overdue
              </Text>
            )}
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search child, parent or phone"
              placeholderTextColor={colors.muted}
            />
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
        ListEmptyComponent={
          <EmptyState title="No enquiries yet" icon={UserPlus} />
        }
        renderItem={({ item: l, index }) => (
          <SlideInCard index={index}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openLead(l)}
              style={styles.card}
            >
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {l.childName}
                  {l.age ? ` · ${l.age}y` : ''}
                </Text>
                <Badge
                  label={STATUS_LABEL[l.status as Status]}
                  color={STATUS_COLOR[l.status as Status]}
                />
              </View>
              <Text style={styles.meta}>
                {[l.guardianName, l.phone, l.sport].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.meta}>
                {label(l.source)}
                {l.status === 'trial_scheduled' && l.trialDate
                  ? ` · Trial ${fmt(l.trialDate)}`
                  : ''}
                {l.followUpDate && l.status !== 'converted' && l.status !== 'lost'
                  ? ` · Follow-up ${fmt(l.followUpDate)}`
                  : ''}
              </Text>
              {isOverdue(l) && (
                <View style={styles.late}>
                  <AlertTriangle size={11} color={colors.red} strokeWidth={2.5} />
                  <Text style={styles.lateText}>Follow-up overdue</Text>
                </View>
              )}
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
            <Text style={styles.formTitle}>
              {editId ? 'Edit enquiry' : 'New enquiry'}
            </Text>
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
              <TextField
                label="Child's name"
                value={form.childName}
                onChangeText={v => setForm({ ...form, childName: v })}
                required
              />
              <TextField
                label="Age"
                value={form.age}
                onChangeText={v => setForm({ ...form, age: v.replace(/\D/g, '') })}
                keyboardType="number-pad"
              />
              <TextField
                label="Parent / guardian name"
                value={form.guardianName}
                onChangeText={v => setForm({ ...form, guardianName: v })}
              />
              <TextField
                label="Phone"
                value={form.phone}
                onChangeText={v => setForm({ ...form, phone: v })}
                keyboardType="phone-pad"
                required
              />
              <TextField
                label="Email"
                value={form.email}
                onChangeText={v => setForm({ ...form, email: v })}
                keyboardType="email-address"
              />
              <TextField
                label="Sport interested in"
                value={form.sport}
                onChangeText={v => setForm({ ...form, sport: v })}
              />
              <TextField
                label="Preferred batch"
                value={form.batch}
                onChangeText={v => setForm({ ...form, batch: v })}
              />
              <ChipSelect
                label="Source"
                options={SOURCES}
                value={form.source as (typeof SOURCES)[number]}
                onChange={v => setForm({ ...form, source: v })}
              />
              <DateTimeField
                label="Follow-up date"
                value={form.followUpDate}
                onChangeText={v => setForm({ ...form, followUpDate: v })}
              />
              <Button
                title={editId ? 'Save changes' : 'Add enquiry'}
                onPress={save}
                loading={saving}
              />
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
              {open?.childName}
            </Text>
            <TouchableOpacity onPress={() => setOpen(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.meta}>
                {[open?.age ? `${open.age}y` : '', open?.sport, open?.batch]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                · via {label(open?.source || '')} · {fmt(open?.createdAt)}
              </Text>
              <View style={styles.contactRow}>
                <Text style={[styles.title, { flex: 1 }]}>
                  {open?.guardianName || 'Parent'} · {open?.phone}
                </Text>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => Linking.openURL(`tel:${open?.phone}`)}
                >
                  <Phone size={16} color={colors.black} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => whatsapp(open?.phone || '')}
                >
                  <WhatsAppIcon size={18} />
                </TouchableOpacity>
              </View>
              {open?.status === 'lost' && !!open?.lostReason && (
                <Text style={[styles.meta, { color: colors.red }]}>
                  Lost: {open.lostReason}
                </Text>
              )}

              {open && open.status !== 'converted' && (
                <>
                  <View style={styles.statusRow}>
                    {STATUSES.filter(s => s !== 'converted').map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => changeStatus(open, s)}
                        style={[
                          styles.statusBtn,
                          open.status === s && { backgroundColor: colors.black },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            open.status === s && { color: colors.white },
                          ]}
                        >
                          {STATUS_LABEL[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <DateTimeField
                    label="Trial date"
                    value={trial}
                    onChangeText={setTrial}
                  />
                  <DateTimeField
                    label="Follow-up date"
                    value={follow}
                    onChangeText={setFollow}
                  />
                  <Button title="Save follow-up" onPress={saveFollowUp} />
                  {isOwner && (
                    <Button
                      title="Enrol as student"
                      onPress={() => convert(open)}
                    />
                  )}
                </>
              )}

              <Text style={styles.section}>Notes</Text>
              {(open?.notes || []).map((n: any) => (
                <View key={n._id} style={styles.comment}>
                  <Text style={styles.commentText}>{n.text}</Text>
                  <Text style={styles.meta}>{fmt(n.at)}</Text>
                </View>
              ))}
              {!open?.notes?.length && (
                <Text style={styles.meta}>No notes yet</Text>
              )}
              <View style={styles.commentRow}>
                <TextInput
                  style={styles.commentInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Call summary, objection…"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity onPress={addNote} style={styles.send}>
                  <Text style={styles.sendText}>Add</Text>
                </TouchableOpacity>
              </View>

              {open && open.status !== 'converted' && (
                <TouchableOpacity
                  onPress={() => startEdit(open)}
                  style={{ marginTop: 8 }}
                >
                  <Text style={styles.link}>Edit details</Text>
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity onPress={() => remove(open)} style={styles.del}>
                  <Trash2 size={15} color={colors.red} strokeWidth={2.5} />
                  <Text style={styles.delText}>Delete enquiry</Text>
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
  },
  overdue: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 12,
    color: colors.red,
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
  late: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  lateText: {
    fontFamily: FONT.bold,
    fontWeight: '400',
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
    fontWeight: '400',
    fontSize: 18,
    color: colors.black,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    padding: 8,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
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
    fontWeight: '400',
    fontSize: 12,
    color: colors.black,
  },
  section: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 13,
    color: colors.black,
    marginTop: 8,
  },
  comment: { backgroundColor: '#F4F4F4', borderRadius: 8, padding: 10 },
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
    fontWeight: '400',
    color: colors.white,
    fontSize: 12,
  },
  link: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 12,
    color: colors.blue,
    textDecorationLine: 'underline',
  },
  del: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  delText: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    fontSize: 12,
    color: colors.red,
  },
});
