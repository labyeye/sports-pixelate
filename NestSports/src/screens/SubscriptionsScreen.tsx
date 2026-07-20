import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUpDown,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Users,
  IndianRupee,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react-native';
import { subscriptionAPI } from '../api/client';
import { downloadReceipt } from '../utils/receipt';
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
  KpiTile,
} from '../components/ui';
import {
  ImportExportModal,
  ImportHeader,
} from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const SUBSCRIPTION_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'studentId', label: 'Student ID', required: true, example: 'STU0001' },
  {
    key: 'planName',
    label: 'Plan Name',
    required: true,
    example: 'Elite Tennis',
  },
  {
    key: 'billingCycle',
    label: 'Billing Cycle',
    required: true,
    example: 'monthly',
  },
  { key: 'amount', label: 'Amount', required: false, example: '2500' },
  {
    key: 'startDate',
    label: 'Start Date',
    required: false,
    example: '2024-01-15',
  },
  {
    key: 'renewalDate',
    label: 'Renewal Date',
    required: false,
    example: '2024-02-15',
  },
  { key: 'status', label: 'Status', required: false, example: 'active' },
];

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  completed: colors.green,
  partial: colors.purple,
  pending: colors.orange,
  rejected: colors.red,
  failed: colors.red,
};

const PAYMENT_ENTRY_COLORS: Record<string, string> = {
  verified: colors.green,
  pending: colors.orange,
  rejected: colors.red,
};

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending_renewal: colors.orange,
  inactive: colors.orange,
  cancelled: colors.red,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_renewal', label: 'Pending Renewal' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS: SortOption[] = [
  { key: 'renewalDate', label: 'Renewal Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'createdAt', label: 'Date Added' },
];

export default function SubscriptionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [reviewSub, setReviewSub] = useState<any | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // At most one payment entry is ever pending at a time — the backend
  // rejects a new submission while one is awaiting review.
  const reviewPayment = reviewSub?.payments?.find(
    (p: any) => p.status === 'pending',
  );

  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('renewalDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      subscriptionAPI.getAll({
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
      setSubscriptions(res.data || []);
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
      setSubscriptions(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel this subscription?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              await subscriptionAPI.cancel(id);
              await load();
            } catch (e: any) {
              Alert.alert(
                'Error',
                e.message || 'Failed to cancel subscription',
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  const handleVerify = async () => {
    if (!reviewSub || !reviewPayment) return;
    setReviewing(true);
    try {
      await subscriptionAPI.verifyQrPayment(reviewSub._id, reviewPayment._id);
      setReviewSub(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to verify payment');
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!reviewSub || !reviewPayment) return;
    setReviewing(true);
    try {
      await subscriptionAPI.rejectQrPayment(reviewSub._id, reviewPayment._id);
      setReviewSub(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reject payment');
    } finally {
      setReviewing(false);
    }
  };

  const handleDownloadReceipt = async (subId: string, paymentId: string) => {
    setDownloadingId(paymentId);
    try {
      await downloadReceipt(
        subscriptionAPI.receiptUrl(subId, paymentId),
        `receipt_${paymentId}.pdf`,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <LoadingView />;

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const pendingRenewalCount = subscriptions.filter(
    s => s.status === 'pending_renewal',
  ).length;
  const totalRevenue = subscriptions
    .filter(s => s.paymentStatus === 'completed')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Subscriptions</Text>
            <Text style={styles.subtitle}>
              Coaching plan subscriptions and renewals
            </Text>
          </View>
          {!isParent && (
            <>
              <TouchableOpacity
                onPress={() =>
                  exportRowsToExcel(
                    SUBSCRIPTION_IMPORT_HEADERS.map(h => ({
                      key: h.key,
                      label: h.label,
                    })),
                    subscriptions.map((s: any) => ({
                      studentId: s.student?.studentId || '',
                      planName: s.planName,
                      billingCycle: s.billingCycle,
                      amount: s.amount,
                      renewalDate: s.renewalDate?.slice(0, 10),
                      status: s.status,
                    })),
                    'subscriptions_export.xlsx',
                    'Subscriptions',
                  )
                }
                style={styles.sortBtn}
                hitSlop={8}
              >
                <Download size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setImportVisible(true)}
                style={styles.sortBtn}
                hitSlop={8}
              >
                <FileSpreadsheet
                  size={18}
                  color={colors.black}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.sortBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Subscriptions"
            value={subscriptions.length}
            sub="Loaded"
            color={colors.blue}
            icon={Users}
          />
          <KpiTile
            label="Active"
            value={activeCount}
            sub="Currently active"
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Pending Renewal"
            value={pendingRenewalCount}
            sub="Renewal due"
            color={colors.orange}
            icon={CalendarClock}
          />
          <KpiTile
            label="Revenue"
            value={formatCurrency(totalRevenue)}
            sub="Completed payments"
            color={colors.purple}
            icon={IndianRupee}
          />
        </View>

        <FilterPills
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />

        {isParent && (
          <TouchableOpacity
            style={styles.choosePlanBtn}
            onPress={() => navigation.navigate('ChoosePlan')}
          >
            <Text style={styles.choosePlanBtnText}>+ Subscribe a Child to a Plan</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={subscriptions}
          keyExtractor={s => s._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No subscriptions found"
              sub={
                isParent
                  ? "Tap 'Subscribe a Child to a Plan' above to get started."
                  : undefined
              }
            />
          }
          renderItem={({ item: s }) => (
            <Card>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name}>
                  {s.student?.firstName} {s.student?.lastName}
                </Text>
                <Badge
                  label={s.status?.replace('_', ' ')}
                  color={STATUS_COLORS[s.status] || colors.muted}
                />
              </View>
              <Text style={styles.planName}>{s.planName}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>AMOUNT PAID</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(s.amountPaid || 0)} /{' '}
                    {formatCurrency(s.amount)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>RENEWAL</Text>
                  <Text style={styles.statValue}>
                    {s.renewalDate
                      ? new Date(s.renewalDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                </View>
              </View>

              {Array.isArray(s.payments) && s.payments.length > 0 && (
                <View style={styles.paymentHistory}>
                  {[...s.payments].reverse().map((p: any) => (
                    <View key={p._id} style={styles.paymentEntryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentEntryAmount}>
                          {formatCurrency(p.amount)}
                        </Text>
                        <Text style={styles.paymentEntryDate}>
                          {new Date(p.submittedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </Text>
                      </View>
                      <Badge
                        label={p.status === 'verified' ? 'Verified' : p.status}
                        color={PAYMENT_ENTRY_COLORS[p.status] || colors.muted}
                      />
                      {p.status === 'verified' && (
                        <TouchableOpacity
                          style={styles.receiptBtn}
                          onPress={() => handleDownloadReceipt(s._id, p._id)}
                          disabled={downloadingId === p._id}
                          hitSlop={8}
                        >
                          <FileText
                            size={14}
                            color={colors.blue}
                            strokeWidth={2.5}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {isParent &&
                s.status !== 'active' &&
                s.status !== 'cancelled' && (
                  <Button
                    title={
                      s.payments?.some((p: any) => p.status === 'pending')
                        ? 'Awaiting Verification'
                        : s.amountPaid > 0
                        ? 'Pay Remaining'
                        : 'Renew'
                    }
                    onPress={() =>
                      navigation.navigate('QrRenewal', { subscription: s })
                    }
                    color={colors.blue}
                    disabled={s.payments?.some(
                      (p: any) => p.status === 'pending',
                    )}
                  />
                )}
              {isParent && s.status === 'active' && (
                <Button
                  title="Cancel Subscription"
                  onPress={() => handleCancel(s._id)}
                  color={colors.red}
                  variant="outline"
                  loading={cancellingId === s._id}
                />
              )}
              {!isParent && (
                <View style={styles.paymentRow}>
                  <Badge
                    label={s.paymentStatus}
                    color={
                      PAYMENT_STATUS_COLORS[s.paymentStatus] || colors.muted
                    }
                  />
                  {s.payments?.some((p: any) => p.status === 'pending') && (
                    <TouchableOpacity
                      style={styles.reviewBtn}
                      onPress={() => setReviewSub(s)}
                    >
                      <Eye size={14} color={colors.blue} strokeWidth={2.5} />
                      <Text style={styles.reviewBtnText}>Review</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

      {!isParent && (
        <ImportExportModal
          visible={importVisible}
          onClose={() => setImportVisible(false)}
          entityLabel="Subscription"
          headers={SUBSCRIPTION_IMPORT_HEADERS}
          templateFilename="subscriptions_import_template.xlsx"
          notes={[
            "Student ID must exactly match a student's ID (e.g. STU0001) from the Students screen.",
            'Plan Name must exactly match an existing coaching plan.',
            'Billing Cycle must be monthly or yearly. Imported records are created as already paid — for backfilling historical records.',
            'Maximum 200 subscriptions per import.',
          ]}
          previewLine={r => `${r.studentId} — ${r.planName}`}
          onImport={rows => subscriptionAPI.bulkImport(rows) as any}
          onImported={load}
        />
      )}

      <Modal
        visible={!!reviewSub}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewSub(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Payment</Text>
              <TouchableOpacity onPress={() => setReviewSub(null)} hitSlop={8}>
                <X size={20} color={colors.black} />
              </TouchableOpacity>
            </View>
            {reviewSub && reviewPayment && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Student</Text>
                  <Text style={styles.detailValue}>
                    {reviewSub.student?.firstName} {reviewSub.student?.lastName}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan</Text>
                  <Text style={styles.detailValue}>{reviewSub.planName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(reviewPayment.amount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>UTR Number</Text>
                  <Text style={styles.detailValue}>
                    {reviewPayment.utrNumber || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction No.</Text>
                  <Text style={styles.detailValue}>
                    {reviewPayment.transactionNumber || '—'}
                  </Text>
                </View>
                {reviewPayment.screenshot ? (
                  <Image
                    source={{ uri: reviewPayment.screenshot }}
                    style={styles.screenshot}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.detailValue}>
                    No screenshot uploaded.
                  </Text>
                )}
                <View style={styles.modalActions}>
                  <Button
                    title="Verified"
                    onPress={handleVerify}
                    color={colors.green}
                    loading={reviewing}
                  />
                  <Button
                    title="Not Verified"
                    onPress={handleReject}
                    color={colors.red}
                    loading={reviewing}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  choosePlanBtn: {
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  choosePlanBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  planName: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    padding: 10,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 4,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.black },
  paymentHistory: { marginBottom: 12, gap: 8 },
  paymentEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    padding: 8,
  },
  paymentEntryAmount: { fontSize: 13, fontWeight: '800', color: colors.black },
  paymentEntryDate: { fontSize: 10, color: colors.muted, marginTop: 1 },
  receiptBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewBtnText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontFamily: FONT.bold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.black,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  detailValue: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.black,
  },
  screenshot: {
    width: '100%',
    height: 200,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.black,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
});
