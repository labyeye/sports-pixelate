import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Download } from 'lucide-react-native';
import { studentAPI } from '../api/client';
import { Card, SearchBar, EmptyState, LoadingView } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

// Slots guardians into Father / Mother / Guardian 1 / Guardian 2, mirroring
// the web app's slotting rule: father and mother get dedicated slots; any
// remaining guardians (relation "guardian"/"other") fill Guardian 1, then
// Guardian 2, in array order.
function slotGuardians(guardians: any[] = []) {
  const father = guardians.find(g => g.relation === 'father') || null;
  const mother = guardians.find(g => g.relation === 'mother') || null;
  const rest = guardians.filter(
    g => g.relation !== 'father' && g.relation !== 'mother',
  );
  return {
    father,
    mother,
    guardian1: rest[0] || null,
    guardian2: rest[1] || null,
  };
}

let searchDebounce: ReturnType<typeof setTimeout>;

export default function GuardianContactListScreen() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res: any = await studentAPI.getAll({ limit: '1000' });
    setStudents(res.data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(
      () => setSearch(searchInput.trim().toLowerCase()),
      300,
    );
    return () => clearTimeout(searchDebounce);
  }, [searchInput]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    return (
      name.includes(search) ||
      (s.studentId || '').toLowerCase().includes(search)
    );
  });

  const onExport = () =>
    exportRowsToExcel(
      [
        { key: 'student', label: 'Student' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'fatherName', label: 'Father Name' },
        { key: 'fatherPhone', label: 'Father Phone' },
        { key: 'motherName', label: 'Mother Name' },
        { key: 'motherPhone', label: 'Mother Phone' },
        { key: 'guardian1Name', label: 'Guardian 1 Name' },
        { key: 'guardian1Phone', label: 'Guardian 1 Phone' },
        { key: 'guardian2Name', label: 'Guardian 2 Name' },
        { key: 'guardian2Phone', label: 'Guardian 2 Phone' },
      ],
      filtered.map(s => {
        const { father, mother, guardian1, guardian2 } = slotGuardians(
          s.guardians,
        );
        return {
          student: `${s.firstName} ${s.lastName}`,
          studentId: s.studentId,
          fatherName: father?.name || '',
          fatherPhone: father?.phone || '',
          motherName: mother?.name || '',
          motherPhone: mother?.phone || '',
          guardian1Name: guardian1?.name || '',
          guardian1Phone: guardian1?.phone || '',
          guardian2Name: guardian2?.name || '',
          guardian2Phone: guardian2?.phone || '',
        };
      }),
      'guardian_contact_list.xlsx',
      'Guardians',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Guardian Contact List</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by student name..."
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={s => s._id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No students found" icon={Phone} />
        }
        renderItem={({ item: s }) => {
          const { father, mother, guardian1, guardian2 } = slotGuardians(
            s.guardians,
          );
          return (
            <Card>
              <Text style={styles.name}>
                {s.firstName} {s.lastName}
              </Text>
              <Text style={styles.sub}>{s.studentId}</Text>
              <View style={styles.guardianList}>
                {father ? (
                  <Text style={styles.guardianLine}>
                    Father: {father.name} — {father.phone}
                  </Text>
                ) : null}
                {mother ? (
                  <Text style={styles.guardianLine}>
                    Mother: {mother.name} — {mother.phone}
                  </Text>
                ) : null}
                {guardian1 ? (
                  <Text style={styles.guardianLine}>
                    Guardian 1: {guardian1.name} — {guardian1.phone}
                  </Text>
                ) : null}
                {guardian2 ? (
                  <Text style={styles.guardianLine}>
                    Guardian 2: {guardian2.name} — {guardian2.phone}
                  </Text>
                ) : null}
                {!father && !mother && !guardian1 && !guardian2 ? (
                  <Text style={styles.guardianLine}>No guardians on file</Text>
                ) : null}
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
    flex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  searchWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  name: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
  },
  sub: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  guardianList: { marginTop: 8, gap: 3 },
  guardianLine: { fontFamily: FONT.medium, fontSize: 12, color: colors.black },
});
