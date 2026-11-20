import { sentence } from '../utils/text';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Linking,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Receipt,
  Plus,
  X,
  ChevronLeft,
  Paperclip,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { expenseClaimAPI } from '../api/client';
import { DatePickerField } from '../components/common/DatePickerField';
import { useAuth } from '../contexts/AuthContext';
import SlideInCard from '../components/motion/SlideInCard';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import { C, useResponsive } from '../theme';
import { CENTER } from '../components/common/centerModal';
import ExportAction from '../components/common/ExportAction';

const CATEGORIES: [string, string][] = [
  ['travel', 'Travel'],
  ['food', 'Food'],
  ['fuel', 'Fuel'],
  ['lodging', 'Lodging'],
  ['internet_phone', 'Internet / Phone'],
  ['office', 'Office supplies'],
  ['other', 'Other'],
];
const PAY_MODES: [string, string][] = [
  ['bank_transfer', 'Bank transfer'],
  ['upi', 'UPI'],
  ['cash', 'Cash'],
  ['cheque', 'Cheque'],
];
const STATUS_COLOR: Record<string, string> = {
  draft: '#6B7280',
  pending: C.warning,
  approved: C.primary,
  paid: C.success,
  rejected: C.danger,
};
const ROLE_LABEL: Record<string, string> = {
  department_head: 'Dept Head',
  hr_manager: 'HR',
  super_admin: 'Admin',
};

const fmt = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
const today = () => toYmd(new Date());
const day = (v?: string) => (v ? v.slice(0, 10) : '');

const EMPTY = {
  title: '',
  category: 'other',
  amount: '',
  date: today(),
  notes: '',
  vendor: '',
  from: '',
  to: '',
  distanceKm: '',
  fuelLitres: '',
  checkIn: '',
  checkOut: '',
};

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: Date;
  min?: string;
}) {
  return <DatePickerField label={label} value={value} onChange={onChange} />;
}

type Picked = { uri: string; type: string; name: string };

function detailLine(c: any) {
  const d = c.details || {};
  return [
    d.from || d.to ? `${d.from || '?'} → ${d.to || '?'}` : '',
    d.distanceKm != null ? `${d.distanceKm} km` : '',
    d.fuelLitres != null ? `${d.fuelLitres} L` : '',
    d.checkIn
      ? `${day(d.checkIn)}${d.checkOut ? ` – ${day(d.checkOut)}` : ''}`
      : '',
    d.vendor || '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function ExpenseClaimsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isTablet, maxContentWidth } = useResponsive();
  // Phone: short rows; the arrow opens category, approval steps and receipts
  const [expandedClaims, setExpandedClaims] = useState<string[]>([]);
  const toggleExpandClaim = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedClaims(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };
  const isHR = user?.role === 'super_admin' || user?.role === 'hr_manager';
  const canApprove = isHR || user?.role === 'department_head';
  const [claims, setClaims] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>({
    limits: {},
    billRequiredAbove: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [bills, setBills] = useState<Picked[]>([]);
  const [saving, setSaving] = useState(false);
  const [act, setAct] = useState<{
    claim: any;
    action: 'approve' | 'reject';
  } | null>(null);
  const [actAmount, setActAmount] = useState('');
  const [actNote, setActNote] = useState('');
  const [payFor, setPayFor] = useState<any>(null);
  const [pay, setPay] = useState({
    mode: 'bank_transfer',
    reference: '',
    paidOn: today(),
  });
  const [polForm, setPolForm] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        expenseClaimAPI.getAll(),
        expenseClaimAPI.getPolicy().catch(() => null),
      ]);
      setClaims(r.data || []);
      if (p?.data) setPolicy(p.data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof typeof EMPTY, v: string) =>
    setForm(f => (f ? { ...f, [k]: v } : f));

  const openNew = () => {
    setEditId(null);
    setBills([]);
    setForm({ ...EMPTY });
  };

  const openEdit = (c: any) => {
    const d = c.details || {};
    setEditId(c._id);
    setBills([]);
    setForm({
      ...EMPTY,
      title: c.title,
      category: c.category,
      amount: String(c.amount),
      date: day(c.date),
      notes: c.notes || '',
      vendor: d.vendor || '',
      from: d.from || '',
      to: d.to || '',
      distanceKm: d.distanceKm != null ? String(d.distanceKm) : '',
      fuelLitres: d.fuelLitres != null ? String(d.fuelLitres) : '',
      checkIn: day(d.checkIn),
      checkOut: day(d.checkOut),
    });
  };

  const addAsset = (a?: any) => {
    if (!a?.uri) return;
    setBills(b =>
      b.length >= 5
        ? b
        : [
            ...b,
            {
              uri: a.uri,
              type: a.type || 'image/jpeg',
              name: a.fileName || `bill_${Date.now()}.jpg`,
            },
          ],
    );
  };

  const pickPdf = async () => {
    try {
      const [f] = await pick({
        type: [types.pdf, types.images],
        mode: 'import',
      });
      if (!f) return;
      if ((f.size || 0) > 5 * 1024 * 1024)
        return Alert.alert('Too large', 'Each bill must be under 5 MB');
      setBills(b =>
        b.length >= 5
          ? b
          : [
              ...b,
              {
                uri: f.uri,
                type: f.type || 'application/pdf',
                name: f.name || `bill_${Date.now()}.pdf`,
              },
            ],
      );
    } catch (e: any) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED))
        Alert.alert('Error', e.message);
    }
  };

  const openBill = async (id: string, i: number) => {
    try {
      await Linking.openURL(await expenseClaimAPI.billUrl(id, i));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const pickBill = () => {
    if (bills.length >= 5)
      return Alert.alert('Limit', 'Up to 5 bills per claim');
    Alert.alert('Add bill', 'Choose a source', [
      {
        text: 'Camera',
        onPress: () =>
          launchCamera({ mediaType: 'photo', quality: 0.8 }, r =>
            addAsset(r.assets?.[0]),
          ),
      },
      {
        text: 'Gallery',
        onPress: () =>
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, r =>
            addAsset(r.assets?.[0]),
          ),
      },
      { text: 'PDF / file', onPress: pickPdf },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async (draft: boolean) => {
    if (!form) return;
    if (!form.title.trim() || !(Number(form.amount) > 0))
      return Alert.alert(
        'Missing details',
        'Enter what it was for and an amount',
      );
    setSaving(true);
    try {
      await expenseClaimAPI.save(
        { ...form, draft: draft ? 'true' : undefined },
        bills,
        editId || undefined,
      );
      setForm(null);
      setEditId(null);
      setBills([]);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmAct = async () => {
    if (!act) return;
    const { claim, action } = act;
    const approved = Number(actAmount);
    try {
      if (action === 'reject' && !actNote.trim())
        return Alert.alert('Reason needed', 'Enter a reason for rejection');
      if (action === 'approve' && approved < claim.amount && !actNote.trim())
        return Alert.alert('Reason needed', 'Explain the reduced amount');
      await expenseClaimAPI.act(
        claim._id,
        action,
        actNote.trim(),
        action === 'approve' ? approved : undefined,
      );
      setAct(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const doPay = async () => {
    try {
      await expenseClaimAPI.markPaid(payFor._id, pay);
      setPayFor(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const savePolicy = async () => {
    try {
      const limits: Record<string, number> = {};
      Object.entries(polForm.limits || {}).forEach(([k, v]) => {
        if (Number(v) > 0) limits[k] = Number(v);
      });
      await expenseClaimAPI.savePolicy({
        limits,
        billRequiredAbove: Number(polForm.billRequiredAbove) || 0,
      });
      setPolicy({
        limits,
        billRequiredAbove: Number(polForm.billRequiredAbove) || 0,
      });
      setPolForm(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const withdraw = (c: any) =>
    Alert.alert('Withdraw claim', 'Delete this claim?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await expenseClaimAPI.remove(c._id);
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);

  const resubmit = async (c: any) => {
    try {
      await expenseClaimAPI.resubmit(c._id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = claims.filter(c => {
    if (!q) return true;
    const empName = c.employee
      ? `${c.employee.firstName || ''} ${
          c.employee.lastName || ''
        }`.toLowerCase()
      : '';
    return (
      (c.title || '').toLowerCase().includes(q) ||
      empName.includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    );
  });

  const renderItem = ({ item: c, index }: { item: any; index: number }) => {
    const color = STATUS_COLOR[c.status] || C.black;
    const untouched =
      (c.status === 'draft' || c.status === 'pending') &&
      (c.steps || []).every((s: any) => s.status === 'pending');
    const full = isTablet || expandedClaims.includes(c._id);
    return (
      <SlideInCard
        index={index}
        style={isTablet ? styles.cardTablet : undefined}
      >
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.sub}>
                {c.employee
                  ? `${c.employee.firstName} ${c.employee.lastName}${
                      full ? ' · ' : ''
                    }`
                  : ''}
                {full && (
                  <>
                    {CATEGORIES.find(x => x[0] === c.category)?.[1]} ·{' '}
                    {new Date(c.date).toLocaleDateString('en-IN')}
                  </>
                )}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amount}>
                {fmt(c.approvedAmount ?? c.amount)}
              </Text>
              {full &&
                c.approvedAmount != null &&
                c.approvedAmount < c.amount && (
                  <Text
                    style={[styles.sub, { textDecorationLine: 'line-through' }]}
                  >
                    {fmt(c.amount)}
                  </Text>
                )}
              {full && (
                <View style={[styles.badge, { borderColor: color }]}>
                  <Text style={[styles.badgeText, { color }]}>
                    {sentence(c.status)}
                  </Text>
                </View>
              )}
            </View>
            {!isTablet && (
              <TouchableOpacity
                onPress={() => toggleExpandClaim(c._id)}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                accessibilityLabel={full ? 'Hide details' : 'Show details'}
                style={{ width: 28, alignItems: 'center', marginLeft: 4 }}
              >
                {full ? (
                  <ChevronUp size={18} color={C.primary} />
                ) : (
                  <ChevronDown size={18} color={C.primary} />
                )}
              </TouchableOpacity>
            )}
          </View>
          {full && (
            <>
              {!!detailLine(c) && (
                <Text style={styles.sub}>{detailLine(c)}</Text>
              )}
              {!!c.notes && <Text style={styles.sub}>{c.notes}</Text>}
              {c.policyExceeded && (
                <View style={styles.flagRow}>
                  <AlertTriangle size={14} color={C.warning} />
                  <Text style={styles.flag}>Above policy limit</Text>
                </View>
              )}
              {c.status === 'paid' && c.payment?.paidOn && (
                <Text style={[styles.sub, { color: C.success }]}>
                  Paid {new Date(c.payment.paidOn).toLocaleDateString('en-IN')}{' '}
                  via{' '}
                  {c.payment.mode === 'payroll'
                    ? 'payroll'
                    : PAY_MODES.find(m => m[0] === c.payment.mode)?.[1]}
                  {c.payment.reference ? ` · ${c.payment.reference}` : ''}
                </Text>
              )}
              <View style={styles.chips}>
                {(c.steps || []).map((s: any, i: number) => (
                  <View
                    key={i}
                    style={[
                      styles.chip,
                      s.status === 'approved' && { borderColor: C.success },
                      s.status === 'rejected' && { borderColor: C.danger },
                    ]}
                  >
                    <Text style={styles.chipText}>
                      {ROLE_LABEL[s.role] || s.role}
                    </Text>
                  </View>
                ))}
                {Array.from({ length: c.billCount || 0 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.flagRow}
                    onPress={() => openBill(c._id, i)}
                  >
                    <Paperclip size={14} color={C.primary} />
                    <Text
                      style={[
                        styles.sub,
                        { color: C.primary, fontWeight: '400' },
                      ]}
                    >
                      Bill {i + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actions}>
                {c.canAct && (
                  <>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: C.success }]}
                      onPress={() => {
                        setAct({ claim: c, action: 'approve' });
                        setActAmount(String(c.approvedAmount ?? c.amount));
                        setActNote('');
                      }}
                    >
                      <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: C.white }]}
                      onPress={() => {
                        setAct({ claim: c, action: 'reject' });
                        setActNote('');
                      }}
                    >
                      <Text style={[styles.btnText, { color: C.danger }]}>
                        Reject
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {c.status === 'draft' && (
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: C.white }]}
                    onPress={() => openEdit(c)}
                  >
                    <Text style={[styles.btnText, { color: C.black }]}>
                      Edit / Submit
                    </Text>
                  </TouchableOpacity>
                )}
                {c.status === 'rejected' &&
                  !canApprove &&
                  !c.resubmissionOf && (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: C.white }]}
                      onPress={() => resubmit(c)}
                    >
                      <Text style={[styles.btnText, { color: C.black }]}>
                        Resubmit
                      </Text>
                    </TouchableOpacity>
                  )}
                {c.status === 'approved' && isHR && (
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: C.white }]}
                    onPress={() => {
                      setPayFor(c);
                      setPay({
                        mode: 'bank_transfer',
                        reference: '',
                        paidOn: today(),
                      });
                    }}
                  >
                    <Text style={[styles.btnText, { color: C.black }]}>
                      Mark paid
                    </Text>
                  </TouchableOpacity>
                )}
                {!canApprove && untouched && (
                  <TouchableOpacity onPress={() => withdraw(c)}>
                    <Text style={[styles.btnText, { color: C.danger }]}>
                      Withdraw
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </SlideInCard>
    );
  };

  const limit = form ? policy.limits?.[form.category] : 0;
  const Chips = ({
    options,
    value,
    onPick,
  }: {
    options: [string, string][];
    value: string;
    onPick: (v: string) => void;
  }) => (
    <View style={styles.chips}>
      {options.map(([v, l]) => (
        <TouchableOpacity
          key={v}
          onPress={() => onPick(v)}
          style={[styles.pick, value === v && styles.pickOn]}
        >
          <Text style={[styles.pickText, value === v && { color: C.white }]}>
            {l}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={styles.rowCenter}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 4, marginRight: 2 }}
            hitSlop={8}
          >
            <ChevronLeft size={22} color={C.black} />
          </TouchableOpacity>
          <Receipt size={20} color={C.primary} />
          <Text style={styles.headerTitle}>
            {canApprove ? 'Expenses' : 'My Expenses'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ExportAction
            name="expense_claims"
            rows={claims}
            cols={[
              { header: 'Employee', value: (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() },
              { header: 'Title', value: (r: any) => r.title },
              { header: 'Category', value: (r: any) => r.category },
              { header: 'Amount', value: (r: any) => r.amount },
              { header: 'Date', value: (r: any) => String(r.date || '').slice(0, 10) },
              { header: 'Status', value: (r: any) => r.status },
            ]}
          />
          <HeaderIconBtn
            label="Search"
            icon={<Search size={22} color={C.black} />}
            dot={!!search}
            onPress={() => setSearchOpen(true)}
          />
          {isHR && (
            <HeaderIconBtn
              label="Policy"
              icon={<SlidersHorizontal size={22} color={C.black} />}
              onPress={() =>
                setPolForm({ ...policy, limits: { ...policy.limits } })
              }
            />
          )}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openNew}
            accessibilityLabel="New Claim"
            hitSlop={8}
          >
            <Plus size={24} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        value={search}
        onChange={setSearch}
        placeholder="Search claims…"
        items={claims.map((c: any) => ({
          key: c._id,
          title: c.title,
          subtitle: c.employee
            ? `${c.employee.firstName} ${c.employee.lastName}`
            : c.category,
        }))}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={shown}
          keyExtractor={c => c._id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.colWrapper : undefined}
          renderItem={renderItem}
          contentContainerStyle={[
            { padding: 16, gap: 10, paddingBottom: 32 },
            isTablet && {
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 40 }]}>
              No expense claims yet
            </Text>
          }
        />
      )}

      {/* New / edit claim */}
      <Modal
        visible={!!form}
        transparent
        animationType="fade"
        onRequestClose={() => setForm(null)}
      >
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <View
              style={[
                styles.rowBetween,
                {
                  padding: 16,
                  borderBottomWidth: 2,
                  borderBottomColor: C.black,
                },
              ]}
            >
              <Text style={styles.headerTitle}>
                {editId ? 'Edit draft' : 'New expense claim'}
              </Text>
              <TouchableOpacity onPress={() => setForm(null)}>
                <X size={24} color={C.black} />
              </TouchableOpacity>
            </View>
            {form && (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                <TextInput
                  style={styles.input}
                  placeholder="What was it for?"
                  placeholderTextColor="#9CA3AF"
                  maxLength={120}
                  value={form.title}
                  onChangeText={v => set('title', v)}
                />
                <Text style={styles.label}>Type</Text>
                <Chips
                  options={CATEGORIES}
                  value={form.category}
                  onPick={v => set('category', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Amount (₹)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={form.amount}
                  onChangeText={v => set('amount', v)}
                />
                {limit > 0 && (
                  <Text style={styles.sub}>
                    Policy limit: {fmt(limit)}
                    {Number(form.amount) > limit
                      ? ' — your claim is above it and will be flagged'
                      : ''}
                  </Text>
                )}
                <DateField
                  label="Expense date"
                  value={form.date}
                  max={new Date()}
                  onChange={v => set('date', v)}
                />
                {form.category === 'travel' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="From"
                      placeholderTextColor="#9CA3AF"
                      value={form.from}
                      onChangeText={v => set('from', v)}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="To"
                      placeholderTextColor="#9CA3AF"
                      value={form.to}
                      onChangeText={v => set('to', v)}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Distance (km)"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={form.distanceKm}
                      onChangeText={v => set('distanceKm', v)}
                    />
                  </>
                )}
                {form.category === 'fuel' && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Distance (km)"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={form.distanceKm}
                      onChangeText={v => set('distanceKm', v)}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Litres"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={form.fuelLitres}
                      onChangeText={v => set('fuelLitres', v)}
                    />
                  </>
                )}
                {form.category === 'lodging' && (
                  <>
                    <DateField
                      label="Check-in date"
                      value={form.checkIn}
                      onChange={v => set('checkIn', v)}
                    />
                    <DateField
                      label="Check-out date"
                      value={form.checkOut}
                      min={form.checkIn || undefined}
                      onChange={v => set('checkOut', v)}
                    />
                  </>
                )}
                {form.category !== 'travel' && (
                  <TextInput
                    style={styles.input}
                    placeholder={
                      form.category === 'lodging'
                        ? 'Hotel name'
                        : form.category === 'fuel'
                        ? 'Petrol pump'
                        : 'Vendor / shop (optional)'
                    }
                    placeholderTextColor="#9CA3AF"
                    maxLength={100}
                    value={form.vendor}
                    onChangeText={v => set('vendor', v)}
                  />
                )}
                <TextInput
                  style={[styles.input, { height: 70 }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  value={form.notes}
                  onChangeText={v => set('notes', v)}
                />
                <TouchableOpacity style={styles.attach} onPress={pickBill}>
                  <Paperclip size={16} color={C.black} />
                  <Text style={styles.btnTextDark}>
                    {' '}
                    Add bill ({bills.length}/5)
                  </Text>
                </TouchableOpacity>
                {policy.billRequiredAbove > 0 && (
                  <Text style={styles.sub}>
                    Bill required above {fmt(policy.billRequiredAbove)}
                  </Text>
                )}
                {bills.map((b, i) => (
                  <View key={i} style={styles.rowBetween}>
                    <Text style={styles.sub} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setBills(bills.filter((_, j) => j !== i))}
                    >
                      <X size={16} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    disabled={saving}
                    style={[styles.btnBig, { backgroundColor: C.white }]}
                    onPress={() => submit(true)}
                  >
                    <Text style={styles.btnTextDark}>Save draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    style={[styles.btnBig, { backgroundColor: C.primary }]}
                    onPress={() => submit(false)}
                  >
                    <Text style={styles.btnText}>
                      {saving ? 'Saving…' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Approve / reject */}
      <Modal
        visible={!!act}
        transparent
        animationType="fade"
        onRequestClose={() => setAct(null)}
      >
        <View style={CENTER.overlay}>
          <View
            style={[CENTER.card, { height: undefined, padding: 16, gap: 12 }]}
          >
            <Text style={styles.headerTitle}>
              {act?.action === 'approve' ? 'Approve claim' : 'Reject claim'}
            </Text>
            {act?.action === 'approve' && (
              <>
                <Text style={styles.sub}>
                  Claimed {fmt(act.claim.amount)}. Lower the amount to approve
                  partially.
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={actAmount}
                  onChangeText={setActAmount}
                />
              </>
            )}
            <TextInput
              style={styles.input}
              placeholder={
                act?.action === 'approve'
                  ? 'Note (required if reduced)'
                  : 'Reason'
              }
              placeholderTextColor="#9CA3AF"
              value={actNote}
              onChangeText={setActNote}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.btnBig, { backgroundColor: C.white }]}
                onPress={() => setAct(null)}
              >
                <Text style={styles.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnBig,
                  {
                    backgroundColor:
                      act?.action === 'approve' ? C.success : C.danger,
                  },
                ]}
                onPress={confirmAct}
              >
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark paid */}
      <Modal
        visible={!!payFor}
        transparent
        animationType="fade"
        onRequestClose={() => setPayFor(null)}
      >
        <View style={CENTER.overlay}>
          <View
            style={[CENTER.card, { height: undefined, padding: 16, gap: 12 }]}
          >
            <Text style={styles.headerTitle}>
              Pay {payFor ? fmt(payFor.approvedAmount ?? payFor.amount) : ''}
            </Text>
            <Text style={styles.sub}>
              Settles the claim now instead of adding it to payroll.
            </Text>
            <Chips
              options={PAY_MODES}
              value={pay.mode}
              onPick={v => setPay({ ...pay, mode: v })}
            />
            <TextInput
              style={styles.input}
              placeholder="Reference / UTR / cheque no."
              placeholderTextColor="#9CA3AF"
              value={pay.reference}
              onChangeText={v => setPay({ ...pay, reference: v })}
            />
            <DateField
              label="Paid on"
              value={pay.paidOn}
              max={new Date()}
              onChange={v => setPay({ ...pay, paidOn: v })}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.btnBig, { backgroundColor: C.white }]}
                onPress={() => setPayFor(null)}
              >
                <Text style={styles.btnTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnBig, { backgroundColor: C.primary }]}
                onPress={doPay}
              >
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Policy limits */}
      <Modal
        visible={!!polForm}
        transparent
        animationType="fade"
        onRequestClose={() => setPolForm(null)}
      >
        <View style={CENTER.overlay}>
          <View style={CENTER.card}>
            <View
              style={[
                styles.rowBetween,
                {
                  padding: 16,
                  borderBottomWidth: 2,
                  borderBottomColor: C.black,
                },
              ]}
            >
              <Text style={styles.headerTitle}>Policy limits</Text>
              <TouchableOpacity onPress={() => setPolForm(null)}>
                <X size={24} color={C.black} />
              </TouchableOpacity>
            </View>
            {polForm && (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                <Text style={styles.sub}>
                  Max amount per claim by type (blank = no limit). Claims above
                  a limit are flagged for approvers.
                </Text>
                {CATEGORIES.map(([v, l]) => (
                  <View key={v} style={styles.rowBetween}>
                    <Text style={styles.label}>{l}</Text>
                    <TextInput
                      style={[styles.input, { width: 130 }]}
                      keyboardType="numeric"
                      placeholder="₹ limit"
                      placeholderTextColor="#9CA3AF"
                      value={
                        polForm.limits?.[v] ? String(polForm.limits[v]) : ''
                      }
                      onChangeText={t =>
                        setPolForm({
                          ...polForm,
                          limits: { ...polForm.limits, [v]: t },
                        })
                      }
                    />
                  </View>
                ))}
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Bill required above</Text>
                  <TextInput
                    style={[styles.input, { width: 130 }]}
                    keyboardType="numeric"
                    placeholder="₹ (0 = never)"
                    placeholderTextColor="#9CA3AF"
                    value={
                      polForm.billRequiredAbove
                        ? String(polForm.billRequiredAbove)
                        : ''
                    }
                    onChangeText={t =>
                      setPolForm({ ...polForm, billRequiredAbove: t })
                    }
                  />
                </View>
                <TouchableOpacity
                  style={[styles.btnBig, { backgroundColor: C.primary }]}
                  onPress={savePolicy}
                >
                  <Text style={styles.btnText}>Save policy</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const box = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 4,
  borderBottomWidth: 4,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: C.black,
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: C.black,
    marginLeft: 8,
  },
  addBtn: { padding: 4 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colWrapper: { gap: 10 },
  cardTablet: { flex: 1 },
  card: {
    ...box,
    backgroundColor: C.white,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '400', color: C.black },
  sub: { fontSize: 12, color: C.textMuted, fontWeight: '400' },
  amount: { fontSize: 16, fontWeight: '400', color: C.black },
  label: { fontSize: 12, fontWeight: '400', color: C.black },
  badge: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '400' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flag: { fontSize: 12, fontWeight: '400', color: C.warning },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 4,
    borderColor: '#D1D5DB',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipText: { fontSize: 10, fontWeight: '400', color: C.textMuted },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  btnText: { fontSize: 12, fontWeight: '400', color: C.white },
  btnTextDark: { fontSize: 13, fontWeight: '400', color: C.black },
  btnBig: {
    ...box,
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  attach: {
    ...box,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: C.white,
  },
  input: {
    ...box,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.black,
    backgroundColor: C.white,
  },
  pick: {
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickOn: { backgroundColor: C.primary, borderColor: C.primary },
  pickText: { fontSize: 12, fontWeight: '400', color: C.black },
});
