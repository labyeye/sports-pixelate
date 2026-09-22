import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Edit2, Plus, Trash2, X } from 'lucide-react-native';
import {
  Badge,
  Button,
  ChipSelect,
  EmptyState,
  LoadingView,
  PickerField,
  SearchBar,
  TextField,
  ToggleRow,
} from './ui';
import { colors, FONT } from '../theme/colors';

// One list + add/edit/delete form driven by a config object — used for the
// small "configuration" entities (shifts, salary heads, designations, offer
// letters) that share the same CRUD shape and differ only in fields.

export type CrudField = {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'multiline' | 'select' | 'ref' | 'toggle';
  options?: string[]; // select
  labels?: Record<string, string>; // select: value -> display label
  ref?: string; // ref: key into CrudConfig.refs; form value is the record _id
  placeholder?: string;
  required?: boolean;
};

export type CrudConfig = {
  title: string; // singular, e.g. "Shift"
  api: {
    getAll: () => Promise<any>;
    create: (b: object) => Promise<any>;
    update: (id: string, b: object) => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
  fields: CrudField[];
  defaults: Record<string, any>;
  refs?: Record<string, () => Promise<any>>;
  row: (item: any) => {
    title: string;
    subtitle: string;
    badge?: { label: string; color: string };
    dot?: string;
  };
};

const toForm = (cfg: CrudConfig, item: any) => {
  const f: Record<string, any> = {};
  for (const k of cfg.fields) {
    const v = item[k.key];
    if (k.kind === 'ref') f[k.key] = v?._id || v || '';
    else if (k.kind === 'toggle') f[k.key] = !!v;
    else if (k.kind === 'number') f[k.key] = v == null ? '' : String(v);
    else f[k.key] = v ?? '';
  }
  return f;
};

const toPayload = (cfg: CrudConfig, form: Record<string, any>) => {
  const p: Record<string, any> = { ...form };
  for (const k of cfg.fields) {
    if (k.kind === 'number') p[k.key] = Number(form[k.key]) || 0;
  }
  return p;
};

export default function ConfigCrud({ config }: { config: CrudConfig }) {
  const [items, setItems] = useState<any[]>([]);
  const [refs, setRefs] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(config.defaults);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [res, ...refRes]: any[] = await Promise.all([
      config.api.getAll(),
      ...Object.values(config.refs || {}).map(fn => fn()),
    ]);
    if (res.success) setItems(res.data || []);
    const names = Object.keys(config.refs || {});
    setRefs(
      Object.fromEntries(names.map((n, i) => [n, refRes[i]?.data || []])),
    );
  }, [config]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    // Ref fields default to the first record, as the web form does.
    const f = { ...config.defaults };
    for (const k of config.fields) {
      if (k.kind === 'ref' && !f[k.key]) f[k.key] = refs[k.ref!]?.[0]?._id || '';
    }
    setForm(f);
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm(toForm(config, item));
    setFormOpen(true);
  };

  const save = async () => {
    const missing = config.fields.find(
      k => k.required && !String(form[k.key] ?? '').trim(),
    );
    if (missing) {
      Alert.alert('Missing fields', `${missing.label} is required`);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(config, form);
      if (editing) await config.api.update(editing._id, payload);
      else await config.api.create(payload);
      setFormOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Could not save ${config.title}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: any) =>
    Alert.alert(`Delete ${config.title}`, `Delete "${config.row(item).title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await config.api.delete(item._id);
            setItems(prev => prev.filter(x => x._id !== item._id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || `Could not delete ${config.title}`);
          }
        },
      },
    ]);

  if (loading) return <LoadingView />;

  const q = search.trim().toLowerCase();
  const shown = q
    ? items.filter(i => config.row(i).title.toLowerCase().includes(q))
    : items;

  return (
    <View>
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${config.title.toLowerCase()}s...`}
          />
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
          <Plus size={14} color={colors.white} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {shown.length === 0 ? (
        <EmptyState title={`No ${config.title.toLowerCase()}s found`} />
      ) : (
        shown.map(item => {
          const r = config.row(item);
          return (
            <TouchableOpacity
              key={item._id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openEdit(item)}
            >
              {r.dot ? <View style={[styles.dot, { backgroundColor: r.dot }]} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.sub} numberOfLines={2}>
                  {r.subtitle}
                </Text>
              </View>
              {r.badge ? <Badge label={r.badge.label} color={r.badge.color} /> : null}
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(item)}>
                <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}

      <Modal
        visible={formOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormOpen(false)}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editing ? `Edit ${config.title}` : `Add ${config.title}`}
            </Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {config.fields.map(k => {
              const set = (v: any) => setForm(f => ({ ...f, [k.key]: v }));
              if (k.kind === 'toggle')
                return (
                  <ToggleRow key={k.key} label={k.label} value={!!form[k.key]} onChange={set} />
                );
              if (k.kind === 'select')
                return (
                  <ChipSelect
                    key={k.key}
                    label={k.label}
                    options={k.options || []}
                    labels={k.labels}
                    value={form[k.key]}
                    onChange={set}
                  />
                );
              if (k.kind === 'ref') {
                const list = refs[k.ref!] || [];
                return (
                  <PickerField
                    key={k.key}
                    label={k.label}
                    required={k.required}
                    options={list.map(x => x.name)}
                    value={list.find(x => x._id === form[k.key])?.name || ''}
                    onChange={name => set(list.find(x => x.name === name)?._id || '')}
                  />
                );
              }
              return (
                <TextField
                  key={k.key}
                  label={k.label}
                  required={k.required}
                  placeholder={k.placeholder}
                  multiline={k.kind === 'multiline'}
                  keyboardType={k.kind === 'number' ? 'numeric' : undefined}
                  value={String(form[k.key] ?? '')}
                  onChangeText={set}
                />
              );
            })}
            <Button
              title={editing ? 'Save Changes' : `Add ${config.title}`}
              onPress={save}
              loading={saving}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 12,
    marginBottom: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.black },
  name: { fontSize: 15, color: colors.black, fontFamily: FONT.bold },
  sub: { fontSize: 12, color: colors.muted, fontFamily: FONT.medium, marginTop: 2 },
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
  formTitle: { fontSize: 17, color: colors.black, fontFamily: FONT.bold },
});
