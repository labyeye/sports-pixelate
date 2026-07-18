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
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Wallet,
  ListChecks,
  IndianRupee,
} from 'lucide-react-native';
import { expenseAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const CATEGORIES = [
  'equipment',
  'facility_maintenance',
  'salaries',
  'utilities',
  'marketing',
  'travel',
  'other',
] as const;

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  category: 'equipment' as (typeof CATEGORIES)[number],
  title: '',
  amount: '',
  date: toDateStr(new Date()),
  description: '',
};

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const res: any = await expenseAPI.getAll({
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });
    setExpenses(res.data || []);
    setTotalAmount(res.totalAmount || 0);
  }, []);

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
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEdit = (e: any) => {
    setEditingExpense(e);
    setForm({
      category: e.category || 'equipment',
      title: e.title || '',
      amount: e.amount ? String(e.amount) : '',
      date: e.date ? String(e.date).slice(0, 10) : toDateStr(new Date()),
      description: e.description || '',
    });
    setFormVisible(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.amount.trim()) {
      Alert.alert('Missing fields', 'Title and amount are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        title: form.title.trim(),
        amount: Number(form.amount),
        date: form.date.trim(),
        description: form.description.trim() || undefined,
      };
      if (editingExpense) {
        await expenseAPI.update(editingExpense._id, payload);
      } else {
        await expenseAPI.create(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (e: any) => {
    Alert.alert('Delete Expense', `Remove ${e.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await expenseAPI.delete(e._id);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete expense');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  const avgExpense = expenses.length ? totalAmount / expenses.length : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Expenses</Text>
            <Text style={styles.subtitle}>
              Spent this month: {formatCurrency(totalAmount)}
            </Text>
          </View>
          <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
            <Plus size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Spent This Month"
            value={formatCurrency(totalAmount)}
            sub="This month"
            color={colors.orange}
            icon={Wallet}
          />
          <KpiTile
            label="Entries"
            value={expenses.length}
            sub="This month"
            color={colors.blue}
            icon={ListChecks}
          />
          <KpiTile
            label="Avg. Expense"
            value={formatCurrency(avgExpense)}
            sub="Per entry"
            color={colors.green}
            icon={IndianRupee}
          />
        </View>

        {expenses.length === 0 ? (
          <Card>
            <EmptyState title="No expenses found" />
          </Card>
        ) : (
          expenses.map(e => (
            <Card key={e._id}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name}>{e.title}</Text>
                <Badge
                  label={e.category?.replace('_', ' ')}
                  color={colors.orange}
                />
              </View>
              <Text style={styles.sub}>
                {e.date
                  ? new Date(e.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.amount}>{formatCurrency(e.amount)}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(e)}>
                    <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(e)}>
                    <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
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
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <SectionTitle title="Expense Details" />
            <TextField
              label="Title"
              value={form.title}
              onChangeText={v => setForm(p => ({ ...p, title: v }))}
              placeholder="e.g. New football nets"
              required
            />
            <ChipSelect
              label="Category"
              options={CATEGORIES}
              value={form.category}
              onChange={v => setForm(p => ({ ...p, category: v }))}
              labels={{ facility_maintenance: 'facility maintenance' } as any}
            />
            <TextField
              label="Amount (₹)"
              value={form.amount}
              onChangeText={v => setForm(p => ({ ...p, amount: v }))}
              placeholder="Amount"
              keyboardType="numeric"
              required
            />
            <TextField
              label="Date"
              value={form.date}
              onChangeText={v => setForm(p => ({ ...p, date: v }))}
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label="Description"
              value={form.description}
              onChangeText={v => setForm(p => ({ ...p, description: v }))}
              placeholder="Optional description"
              multiline
            />
            <Button
              title={saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    marginTop: 4,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  amount: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 16,
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
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
