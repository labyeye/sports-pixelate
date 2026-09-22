import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpDown, KeyRound, X } from 'lucide-react-native';
import { employeeAPI, parentAPI } from '../api/client';
import {
  FilterPills,
  Row,
  EmptyState,
  LoadingView,
  SearchBar,
  SortSheet,
  LoadMoreFooter,
  SortOption,
  TextField,
  Button,
  SectionTitle,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const SORT_OPTIONS: SortOption[] = [
  { key: 'firstName', label: 'Name' },
  { key: 'createdAt', label: 'Date Added' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

const PWD_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
const generatePassword = () =>
  Array.from(
    { length: 12 },
    () => PWD_CHARS[Math.floor(Math.random() * PWD_CHARS.length)],
  ).join('');

// The web page copies credentials to the clipboard; on mobile the share sheet
// is the equivalent way to hand them to the person securely.
const offerShare = (title: string, email: string, password: string) =>
  Alert.alert(title, 'Share the new credentials with them securely.', [
    { text: 'Done', style: 'cancel' },
    {
      text: 'Share',
      onPress: () =>
        Share.share({ message: `Email: ${email}\nPassword: ${password}` }),
    },
  ]);

type Tab = 'staff' | 'parents';
const TABS: { value: Tab; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'parents', label: 'Parents' },
];

export default function EmployeeCredentialsScreen() {
  const [tab, setTab] = useState<Tab>('staff');
  const [parents, setParents] = useState<any[]>([]);
  const [parentFor, setParentFor] = useState<any>(null);
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  // Generated passwords are revealed so the admin can read them out; typed ones stay masked.
  const [showPwd, setShowPwd] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);

  const [resetFor, setResetFor] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      employeeAPI.getAll({
        page: String(pageNum),
        limit: '20',
        status: 'active',
        ...(search ? { search } : {}),
        sortBy,
        sortDir,
      }),
    [search, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      if (res.success) {
        setEmployees(res.data || []);
        setPage(1);
        setHasMore((res.page || 1) < (res.pages || 1));
      }
    });
  }, [fetchPage]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(searchDebounce);
  }, [searchInput]);

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
      if (res.success) {
        setEmployees(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const openReset = (emp: any) => {
    setShowPwd(false);
    setResetFor(emp);
    setNewPassword('');
  };

  const submitReset = async () => {
    if (!resetFor) return;
    if (newPassword.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await employeeAPI.resetPassword(resetFor._id, newPassword);
      const done = resetFor;
      setResetFor(null);
      offerShare(
        `Password reset for ${done.firstName} ${done.lastName}`,
        done.email,
        newPassword,
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not reset password');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (tab !== 'parents') return;
    parentAPI
      .getAll(search ? { search } : undefined)
      .then((res: any) => res.success && setParents(res.data || []))
      .catch(() => {});
  }, [tab, search]);

  const openParent = (p: any) => {
    setShowPwd(false);
    setParentFor(p);
    setParentEmail(p.email || '');
    setParentPassword('');
  };

  const submitParent = async () => {
    if (!parentFor) return;
    const email = parentEmail.trim();
    if (!email && !parentPassword) {
      Alert.alert('Nothing to update', 'Set an email or a password');
      return;
    }
    setSaving(true);
    try {
      const body: { email?: string; password?: string } = {};
      if (email && email !== parentFor.email) body.email = email;
      if (parentPassword) body.password = parentPassword;
      await parentAPI.updateCredentials(parentFor._id, body);
      setParents(list =>
        list.map(p =>
          p._id === parentFor._id ? { ...p, email: body.email || p.email } : p,
        ),
      );
      const done = parentFor;
      setParentFor(null);
      offerShare(
        'Credentials updated',
        body.email || done.email,
        parentPassword || '(unchanged)',
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update credentials');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Credentials</Text>
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <FilterPills options={TABS} value={tab} onChange={setTab} />
        <View style={{ height: 10 }} />
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={tab === 'staff' ? 'Search staff...' : 'Search parents...'}
        />

        {tab === 'staff' ? (
          <FlatList
            data={employees}
            keyExtractor={e => e._id}
            style={styles.listCard}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
            }
            ListEmptyComponent={<EmptyState title="No staff found" />}
            renderItem={({ item: e }) => (
              <Row
                title={`${e.firstName} ${e.lastName}`}
                subtitle={`${e.employeeId || '-'} · ${e.email || '-'}`}
                onPress={() => openReset(e)}
                right={
                  <TouchableOpacity onPress={() => openReset(e)} hitSlop={8}>
                    <KeyRound size={18} color={colors.blue} strokeWidth={2} />
                  </TouchableOpacity>
                }
              />
            )}
          />
        ) : (
          <FlatList
            data={parents}
            keyExtractor={p => p._id}
            style={styles.listCard}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 8 }}
            ListEmptyComponent={<EmptyState title="No parents found" />}
            renderItem={({ item: p }) => (
              <Row
                title={p.name || p.email || '-'}
                subtitle={`${p.email || '-'}${
                  p.children?.length
                    ? ` · ${p.children.map((c: any) => c.firstName).join(', ')}`
                    : ''
                }`}
                onPress={() => openParent(p)}
                right={
                  <TouchableOpacity onPress={() => openParent(p)} hitSlop={8}>
                    <KeyRound size={18} color={colors.blue} strokeWidth={2} />
                  </TouchableOpacity>
                }
              />
            )}
          />
        )}
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
        visible={!!resetFor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setResetFor(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Reset Password</Text>
            <TouchableOpacity onPress={() => setResetFor(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            <SectionTitle
              title={
                resetFor ? `${resetFor.firstName} ${resetFor.lastName}` : ''
              }
              sub={resetFor?.email}
            />
            <TextField
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              secureTextEntry={!showPwd}
              required
            />
            <Button
              title="Generate Password"
              variant="outline"
              onPress={() => {
                setShowPwd(true);
                setNewPassword(generatePassword());
              }}
            />
            <View style={{ height: 10 }} />
            <Button
              title={saving ? 'Saving...' : 'Reset Password'}
              onPress={submitReset}
              disabled={saving}
            />
            {saving && (
              <ActivityIndicator
                style={{ marginTop: 12 }}
                color={colors.blue}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!parentFor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setParentFor(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Parent Credentials</Text>
            <TouchableOpacity onPress={() => setParentFor(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <SectionTitle
              title={parentFor?.name || ''}
              sub={parentFor?.phone || undefined}
            />
            <TextField
              label="Email"
              value={parentEmail}
              onChangeText={setParentEmail}
              keyboardType="email-address"
            />
            <TextField
              label="New Password (leave blank to keep)"
              value={parentPassword}
              onChangeText={setParentPassword}
              secureTextEntry={!showPwd}
            />
            <Button
              title="Generate Password"
              variant="outline"
              onPress={() => {
                setShowPwd(true);
                setParentPassword(generatePassword());
              }}
            />
            <View style={{ height: 10 }} />
            <Button
              title={saving ? 'Saving...' : 'Update Credentials'}
              onPress={submitParent}
              disabled={saving}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  listCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
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
});
