import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { departmentAPI } from '../api/client';
import { Button, Card, EmptyState, FilterPills, PickerField, TextField } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { findReport, Filters, ReportDef, ReportTable } from '../reports/catalog';
import { colors, FONT } from '../theme/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAME_HEADERS = ['employee', 'name', 'employee name', 'student', 'team a', 'designation', 'round'];

const initFilters = (def: ReportDef): Filters => {
  const now = new Date();
  const f: Filters = {};
  for (const x of def.filters) {
    if (x.kind === 'month') {
      f.month = String(now.getMonth() + 1);
      f.year = String(now.getFullYear());
    } else if (x.kind === 'year') f.year = String(now.getFullYear());
    else if (x.kind === 'dept') f.dept = 'all';
    else if (x.kind === 'select') f[x.key] = x.options[0].value;
    else f[x.key] = '';
  }
  return f;
};

function Stepper({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={onPrev} hitSlop={10}>
        <ChevronLeft size={20} color={colors.black} strokeWidth={2.5} />
      </TouchableOpacity>
      <Text style={styles.stepperText}>{label}</Text>
      <TouchableOpacity onPress={onNext} hitSlop={10}>
        <ChevronRight size={20} color={colors.black} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

export default function ReportViewerScreen({ route, navigation }: any) {
  const def = findReport(route.params?.reportId);
  const [filters, setFilters] = useState<Filters>(() => (def ? initFilters(def) : {}));
  const [depts, setDepts] = useState<any[]>([]);
  const [refs, setRefs] = useState<Record<string, any[]>>({});
  const [table, setTable] = useState<ReportTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }));

  // Load option lists for department / reference filters.
  useEffect(() => {
    if (!def) return;
    if (def.filters.some(x => x.kind === 'dept'))
      departmentAPI
        .getAll()
        .then((r: any) => setDepts(r.data || []))
        .catch(() => {});
    def.filters.forEach(x => {
      if (x.kind !== 'ref') return;
      x.load()
        .then(list => {
          setRefs(r => ({ ...r, [x.key]: list }));
          // Default to the first record, as the web report does.
          setFilters(f => (f[x.key] || !list.length ? f : { ...f, [x.key]: list[0]._id }));
        })
        .catch(() => {});
    });
  }, [def]);

  // Re-run whenever a filter changes (debounced so typing doesn't spam the API).
  useEffect(() => {
    if (!def) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await def.run(filters);
        if (alive) setTable(result);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Could not load report');
      } finally {
        if (alive) setLoading(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [def, filters]);

  if (!def)
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <EmptyState title="Report not found" />
      </SafeAreaView>
    );

  const stepMonth = (d: number) => {
    let m = Number(filters.month) + d;
    let y = Number(filters.year);
    if (m < 1) [m, y] = [12, y - 1];
    if (m > 12) [m, y] = [1, y + 1];
    setFilters(f => ({ ...f, month: String(m), year: String(y) }));
  };

  const exportExcel = async () => {
    if (!table?.rows.length) return;
    const period = filters.month ? `${MONTHS[+filters.month - 1]}_${filters.year}` : filters.year || 'all';
    try {
      await exportRowsToExcel(
        table.headers.map((h, i) => ({ key: String(i), label: h })),
        table.rows.map(r => Object.fromEntries(r.map((c, i) => [String(i), c]))),
        `${def.id}_${period}.xlsx`,
        def.name.slice(0, 31),
      );
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export the report');
    }
  };

  const titleIdx = table ? Math.max(0, table.headers.findIndex(h => NAME_HEADERS.includes(h.toLowerCase()))) : 0;

  const header = (
    <View>
      {def.filters.map(x => {
        if (x.kind === 'month')
          return (
            <Stepper
              key="month"
              label={`${MONTHS[+filters.month - 1]} ${filters.year}`}
              onPrev={() => stepMonth(-1)}
              onNext={() => stepMonth(1)}
            />
          );
        if (x.kind === 'year')
          return (
            <Stepper
              key="year"
              label={filters.year}
              onPrev={() => set('year', String(+filters.year - 1))}
              onNext={() => set('year', String(+filters.year + 1))}
            />
          );
        if (x.kind === 'dept')
          return (
            <PickerField
              key="dept"
              label="Department"
              options={['All departments', ...depts.map(d => d.name)]}
              value={filters.dept === 'all' ? 'All departments' : depts.find(d => d._id === filters.dept)?.name || ''}
              onChange={n => set('dept', n === 'All departments' ? 'all' : depts.find(d => d.name === n)?._id || 'all')}
            />
          );
        if (x.kind === 'select')
          return (
            <View key={x.key} style={{ marginBottom: 12 }}>
              <Text style={styles.filterLabel}>{x.label}</Text>
              <FilterPills options={x.options} value={filters[x.key]} onChange={v => set(x.key, v)} />
            </View>
          );
        if (x.kind === 'ref') {
          const list = refs[x.key] || [];
          return (
            <PickerField
              key={x.key}
              label={x.label}
              options={list.map(r => r.name || r.title)}
              value={(list.find(r => r._id === filters[x.key]) || {}).name || (list.find(r => r._id === filters[x.key]) || {}).title || ''}
              onChange={n => set(x.key, list.find(r => (r.name || r.title) === n)?._id || '')}
            />
          );
        }
        return (
          <TextField
            key={x.key}
            label={x.label}
            placeholder={x.placeholder}
            keyboardType={x.numeric ? 'numeric' : undefined}
            value={filters[x.key]}
            onChangeText={v => set(x.key, v)}
          />
        );
      })}
      <Text style={styles.count}>
        {loading ? 'Loading…' : error ? error : `${table?.rows.length ?? 0} records`}
      </Text>
      <Button
        title="Export to Excel"
        onPress={exportExcel}
        disabled={loading || !table?.rows.length}
        color={colors.green}
      />
      <View style={{ height: 12 }} />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={22} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {def.name}
        </Text>
      </View>
      <FlatList
        data={loading ? [] : table?.rows || []}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.blue} /> : <EmptyState title="No data for these filters" />
        }
        renderItem={({ item: row }) => (
          <Card>
            <Text style={styles.rowTitle}>{row[titleIdx]}</Text>
            {table!.headers.map((h, i) =>
              i === titleIdx ? null : (
                <View key={h + i} style={styles.line}>
                  <Text style={styles.lineLabel}>{h}</Text>
                  <Text style={styles.lineValue}>{row[i]}</Text>
                </View>
              ),
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  title: { flex: 1, fontSize: 18, fontFamily: FONT.bold, color: colors.black },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  stepperText: { fontSize: 15, fontFamily: FONT.bold, color: colors.black },
  filterLabel: { fontSize: 12, fontFamily: FONT.bold, color: colors.black, marginBottom: 6, textTransform: 'uppercase' },
  count: { color: colors.muted, fontFamily: FONT.medium, fontSize: 12, marginVertical: 8 },
  rowTitle: { fontSize: 15, fontFamily: FONT.bold, color: colors.black, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  lineLabel: { flexShrink: 0, color: colors.muted, fontSize: 12, fontFamily: FONT.medium },
  lineValue: { flex: 1, textAlign: 'right', color: colors.black, fontSize: 12, fontFamily: FONT.semiBold },
});
