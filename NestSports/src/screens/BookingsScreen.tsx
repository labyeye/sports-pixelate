import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUpDown,
  Plus,
  X,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Calendar,
  Clock,
} from 'lucide-react-native';
import { bookingAPI, facilityAPI, studentAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  Button,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
  TextField,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const EMPTY_BOOKING_FORM = {
  facilityId: '',
  studentId: '',
  date: toDateStr(new Date()),
  startTime: '09:00',
  endTime: '10:00',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: colors.green,
  completed: colors.blue,
  cancelled: colors.red,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS: SortOption[] = [
  { key: 'date', label: 'Date' },
  { key: 'fee', label: 'Fee' },
  { key: 'createdAt', label: 'Date Added' },
];

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortVisible, setSortVisible] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      bookingAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(status ? { status } : {}),
        sortBy,
        sortDir,
      }),
    [status, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setBookings(res.data || []);
      setPage(1);
      setHasMore((res.page || 1) < (res.pages || 1));
    });
  }, [fetchPage]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res: any = await fetchPage(next);
      setBookings(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const openAdd = () => {
    setBookingForm(EMPTY_BOOKING_FORM);
    setFormVisible(true);
    facilityAPI
      .getAll()
      .then((r: any) => setFacilities(r.data || []))
      .catch(() => {});
    studentAPI
      .getAll({ limit: '500' })
      .then((r: any) => setStudents(r.data || []))
      .catch(() => {});
  };

  const submitBooking = async () => {
    if (!bookingForm.facilityId) {
      Alert.alert('Missing field', 'Choose a facility');
      return;
    }
    setCreating(true);
    try {
      const res: any = await bookingAPI.create(bookingForm);
      if (res.payment) {
        Alert.alert(
          'Payment required',
          'This booking needs online payment. Complete it from the web dashboard to confirm.',
        );
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create booking');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              await bookingAPI.cancel(id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel booking');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Bookings</Text>
            <Text style={styles.subtitle}>Facility bookings and schedules</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.sortBtn}
              hitSlop={8}
            >
              <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openAdd}
              style={styles.addBtn}
              hitSlop={8}
            >
              <Plus size={14} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Bookings"
            value={bookings.length}
            color={colors.blue}
            icon={CalendarClock}
          />
          <KpiTile
            label="Confirmed"
            value={bookings.filter(b => b.status === 'confirmed').length}
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Total Revenue"
            value={`₹${bookings
              .reduce(
                (s, b) =>
                  s + (b.paymentStatus === 'completed' ? b.fee || 0 : 0),
                0,
              )
              .toLocaleString('en-IN')}`}
            color={colors.blue}
            icon={IndianRupee}
          />
        </View>

        <FilterPills
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />

        <FlatList
          data={bookings}
          keyExtractor={b => b._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={<EmptyState title="No bookings found" />}
          renderItem={({ item: b }) => (
            <Card>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name}>
                  {b.facility?.name || 'Facility'}
                </Text>
                <Badge
                  label={b.status}
                  color={STATUS_COLORS[b.status] || colors.muted}
                />
              </View>
              <Text style={styles.dateText}>
                {b.date
                  ? new Date(b.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}{' '}
                · {b.startTime}–{b.endTime}
              </Text>
              <Text style={styles.feeText}>
                {b.fee > 0 ? `₹${b.fee.toLocaleString('en-IN')}` : 'Free'}
              </Text>
              {b.status === 'confirmed' && (
                <Button
                  title="Cancel Booking"
                  onPress={() => handleCancel(b._id)}
                  color={colors.red}
                  variant="outline"
                  loading={cancellingId === b._id}
                />
              )}
            </Card>
          )}
        />
      </View>

      <SortSheet
        visible={sortVisible}
        onClose={() => setSortVisible(false)}
        options={SORT_OPTIONS}
        sortBy={sortBy}
        sortDir={sortDir}
        onApply={(key, dir) => {
          setSortBy(key);
          setSortDir(dir);
          setSortVisible(false);
        }}
      />

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>New Booking</Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            <SectionTitle title="Facility" />
            <ScrollView style={styles.pickList} nestedScrollEnabled>
              {facilities.length === 0 ? (
                <Text style={styles.emptyPickText}>Loading facilities…</Text>
              ) : (
                facilities.map((f: any) => {
                  const selected = bookingForm.facilityId === f._id;
                  return (
                    <TouchableOpacity
                      key={f._id}
                      onPress={() =>
                        setBookingForm(p => ({ ...p, facilityId: f._id }))
                      }
                      style={[
                        styles.pickRow,
                        selected && styles.pickRowSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickRowText,
                          selected && { color: colors.white },
                        ]}
                      >
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <SectionTitle title="Student (optional)" />
            <ScrollView style={styles.pickList} nestedScrollEnabled>
              {students.map((s: any) => {
                const selected = bookingForm.studentId === s._id;
                return (
                  <TouchableOpacity
                    key={s._id}
                    onPress={() =>
                      setBookingForm(p => ({
                        ...p,
                        studentId: selected ? '' : s._id,
                      }))
                    }
                    style={[styles.pickRow, selected && styles.pickRowSelected]}
                  >
                    <Text
                      style={[
                        styles.pickRowText,
                        selected && { color: colors.white },
                      ]}
                    >
                      {s.firstName} {s.lastName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextField
              label="Date"
              value={bookingForm.date}
              onChangeText={v => setBookingForm(p => ({ ...p, date: v }))}
              placeholder="YYYY-MM-DD"
              required
              icon={Calendar}
            />
            <TextField
              label="Start Time"
              value={bookingForm.startTime}
              onChangeText={v => setBookingForm(p => ({ ...p, startTime: v }))}
              placeholder="09:00"
              icon={Clock}
            />
            <TextField
              label="End Time"
              value={bookingForm.endTime}
              onChangeText={v => setBookingForm(p => ({ ...p, endTime: v }))}
              placeholder="10:00"
              icon={Clock}
            />
            <Button
              title={creating ? 'Booking...' : 'Confirm Booking'}
              onPress={submitBooking}
              disabled={creating}
            />
            {creating && (
              <ActivityIndicator
                style={{ marginTop: 12 }}
                color={colors.blue}
              />
            )}
          </ScrollView>
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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  subtitle: { color: colors.muted, marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sortBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
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
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  pickList: {
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: 14,
    maxHeight: 180,
  },
  pickRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickRowSelected: { backgroundColor: colors.blue },
  pickRowText: { fontFamily: FONT.medium, fontSize: 14, color: colors.black },
  emptyPickText: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 13,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  dateText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  feeText: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 12,
  },
});
