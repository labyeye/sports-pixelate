import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  View,
  Text,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  X,
  Camera,
  ArrowUpDown,
  UserCheck,
  Undo2,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react-native';
import { inventoryAPI, studentAPI, employeeAPI, RNFile } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
  SearchBar,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  equipment: colors.blue,
  apparel: colors.purple,
  consumable: colors.orange,
  other: colors.muted,
};

const CATEGORIES = ['equipment', 'apparel', 'consumable', 'other'] as const;

function assetToRNFile(asset: Asset): RNFile | undefined {
  if (!asset.uri) return undefined;
  return {
    uri: asset.uri,
    name: asset.fileName || `photo_${Date.now()}.jpg`,
    type: asset.type || 'image/jpeg',
  };
}

function pickPhoto(onPicked: (file: RNFile) => void) {
  Alert.alert('Item Photo', 'Choose source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera({ mediaType: 'photo', quality: 0.7 }, r => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, r => {
          const file = r.assets?.[0] && assetToRNFile(r.assets[0]);
          if (file) onPicked(file);
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function ItemPhoto({ uri, size = 44 }: { uri?: string; size?: number }) {
  return (
    <View style={[styles.photoBox, { width: size, height: size }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Package size={size * 0.5} color={colors.muted} strokeWidth={2} />
      )}
    </View>
  );
}

interface FormState {
  name: string;
  category: (typeof CATEGORIES)[number];
  sport: string;
  totalQuantity: string;
  reorderThreshold: string;
  unitCost: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'equipment',
  sport: '',
  totalQuantity: '',
  reorderThreshold: '',
  unitCost: '',
};

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'availableQuantity', label: 'Available Qty' },
  { key: 'totalQuantity', label: 'Total Qty' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

export default function InventoryScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<RNFile | undefined>();
  const [existingPhoto, setExistingPhoto] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const [assignItem, setAssignItem] = useState<any>(null);
  const [assignModel, setAssignModel] = useState<'Student' | 'Employee'>(
    'Student',
  );
  const [assignPersonId, setAssignPersonId] = useState('');
  const [assignQty, setAssignQty] = useState('1');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignPeople, setAssignPeople] = useState<any[]>([]);
  const [assignPeopleLoading, setAssignPeopleLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [txnItem, setTxnItem] = useState<any>(null);
  const [txnQty, setTxnQty] = useState('1');
  const [txnSaving, setTxnSaving] = useState<string | null>(null);

  const fetchPage = useCallback(
    (pageNum: number) =>
      inventoryAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
        sortBy,
        sortDir,
      }),
    [search, category, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setItems(res.data || []);
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
      setItems(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhotoFile(undefined);
    setExistingPhoto(undefined);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item._id);
    setForm({
      name: item.name || '',
      category: item.category || 'equipment',
      sport: item.sport || '',
      totalQuantity: String(item.totalQuantity ?? ''),
      reorderThreshold: String(item.reorderThreshold ?? ''),
      unitCost: String(item.unitCost ?? ''),
    });
    setPhotoFile(undefined);
    setExistingPhoto(item.photo);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const openTxn = (item: any) => {
    setTxnItem(item);
    setTxnQty('1');
  };

  const handleTxn = async (
    type: 'order' | 'purchase' | 'consume' | 'damage' | 'return',
  ) => {
    if (!txnItem) return;
    const qty = Number(txnQty);
    if (!qty || qty <= 0) {
      Alert.alert('Missing field', 'Enter a valid quantity');
      return;
    }
    setTxnSaving(type);
    try {
      await inventoryAPI.recordTransaction(txnItem._id, {
        type,
        quantity: qty,
      });
      setTxnItem(null);
      setTxnQty('1');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not record movement');
    } finally {
      setTxnSaving(null);
    }
  };

  const openAssign = (item: any) => {
    setAssignItem(item);
    setAssignModel('Student');
    setAssignPersonId('');
    setAssignQty('1');
    setAssignNotes('');
  };

  useEffect(() => {
    if (!assignItem) return;
    setAssignPeopleLoading(true);
    setAssignPeople([]);
    const api = assignModel === 'Student' ? studentAPI : employeeAPI;
    api
      .getAll({ limit: '500' })
      .then((r: any) => setAssignPeople(r.data || []))
      .catch(() => {})
      .finally(() => setAssignPeopleLoading(false));
  }, [assignItem, assignModel]);

  const submitAssign = async () => {
    if (!assignItem) return;
    const qty = Number(assignQty);
    if (!assignPersonId) {
      Alert.alert('Missing field', 'Select who is taking the item');
      return;
    }
    if (!qty || qty <= 0) {
      Alert.alert('Missing field', 'Enter a valid quantity');
      return;
    }
    setAssigning(true);
    try {
      const res: any = await inventoryAPI.assign(assignItem._id, {
        assignedTo: assignPersonId,
        assignedToModel: assignModel,
        quantity: qty,
        notes: assignNotes || undefined,
      });
      setAssignItem(res.data);
      setAssignPersonId('');
      setAssignQty('1');
      setAssignNotes('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not record check-out');
    } finally {
      setAssigning(false);
    }
  };

  const returnAssignment = async (assignmentId: string) => {
    if (!assignItem) return;
    try {
      const res: any = await inventoryAPI.returnAssignment(
        assignItem._id,
        assignmentId,
      );
      setAssignItem(res.data);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not mark item returned');
    }
  };

  const confirmDelete = (item: any) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await inventoryAPI.delete(item._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete item');
          }
        },
      },
    ]);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing field', 'Item name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        category: form.category,
        sport: form.sport.trim(),
        totalQuantity: Number(form.totalQuantity) || 0,
        reorderThreshold: Number(form.reorderThreshold) || 0,
        unitCost: Number(form.unitCost) || 0,
      };
      let itemId = editingId;
      if (editingId) {
        await inventoryAPI.update(editingId, body);
      } else {
        const res: any = await inventoryAPI.create(body);
        itemId = res.data._id;
      }
      if (photoFile && itemId) {
        await inventoryAPI.uploadPhoto(itemId, photoFile).catch(() => {});
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save item');
    } finally {
      setSaving(false);
    }
  };

  const previewUri = photoFile?.uri || existingPhoto;

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>Sports equipment and stock levels</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.addBtn}
              hitSlop={8}
            >
              <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
                <Plus size={20} color={colors.blue} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search inventory..."
        />
        <FilterPills
          options={[
            { value: '', label: 'All' },
            { value: 'equipment', label: 'Equipment' },
            { value: 'apparel', label: 'Apparel' },
            { value: 'consumable', label: 'Consumable' },
            { value: 'other', label: 'Other' },
          ]}
          value={category}
          onChange={setCategory}
        />
        <TouchableOpacity
          onPress={() => setLowStockOnly(v => !v)}
          style={[styles.lowStockToggle, lowStockOnly && styles.lowStockToggleActive]}
        >
          <Text
            style={[
              styles.lowStockToggleText,
              lowStockOnly && { color: colors.white },
            ]}
          >
            Low stock only
          </Text>
        </TouchableOpacity>

        <FlatList
          data={
            lowStockOnly
              ? items.filter(
                  i => (i.availableQuantity ?? 0) <= (i.reorderThreshold ?? 0),
                )
              : items
          }
          keyExtractor={i => i._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={<EmptyState title="No inventory items found" />}
          renderItem={({ item: i }) => {
            const low = i.availableQuantity <= (i.reorderThreshold ?? 0);
            return (
              <Card>
                <View style={styles.itemRow}>
                  <ItemPhoto uri={i.photo} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.headerRowInner}>
                      <Text style={styles.name} numberOfLines={1}>
                        {i.name}
                      </Text>
                      <Badge
                        label={i.category}
                        color={CATEGORY_COLORS[i.category] || colors.blue}
                      />
                    </View>
                    {i.sport ? <Text style={styles.sub}>{i.sport}</Text> : null}
                    <Text style={[styles.qty, low && { color: colors.red }]}>
                      {i.availableQuantity} / {i.totalQuantity} available
                    </Text>
                    {!!i.onOrderQuantity && (
                      <View style={styles.onOrderRow}>
                        <Truck size={12} color={colors.purple} strokeWidth={2.5} />
                        <Text style={styles.onOrderText}>
                          {i.onOrderQuantity} on order
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={() => openTxn(i)}
                      style={styles.actionBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Truck size={14} color={colors.purple} strokeWidth={2.5} />
                      <Text style={[styles.actionText, { color: colors.purple }]}>
                        Stock
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => openAssign(i)}
                    style={styles.actionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <UserCheck size={14} color={colors.blue} strokeWidth={2.5} />
                    <Text style={[styles.actionText, { color: colors.blue }]}>
                      Check Out
                    </Text>
                  </TouchableOpacity>
                  {isOwner && (
                    <>
                      <TouchableOpacity
                        onPress={() => openEdit(i)}
                        style={styles.actionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={14} color={colors.blue} strokeWidth={2.5} />
                        <Text style={[styles.actionText, { color: colors.blue }]}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDelete(i)}
                        style={styles.actionBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                        <Text style={[styles.actionText, { color: colors.red }]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </Card>
            );
          }}
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
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.photoPickRow}>
              <TouchableOpacity
                onPress={() => pickPhoto(setPhotoFile)}
                style={styles.photoPickBox}
              >
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.photoPickImg} />
                ) : (
                  <Package size={28} color={colors.muted} strokeWidth={2} />
                )}
                <View style={styles.photoEditBadge}>
                  <Camera size={12} color={colors.white} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to add item photo</Text>
            </View>

            <Card>
              <SectionTitle title="Item Details" />
              <TextField
                label="Name"
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Tennis Racket"
                required
              />
              <ChipSelect
                label="Category"
                options={CATEGORIES}
                value={form.category}
                onChange={v => setForm(p => ({ ...p, category: v }))}
              />
              <TextField
                label="Sport"
                value={form.sport}
                onChangeText={v => setForm(p => ({ ...p, sport: v }))}
                placeholder="e.g. Tennis"
              />
              <TextField
                label="Total Quantity"
                value={form.totalQuantity}
                onChangeText={v => setForm(p => ({ ...p, totalQuantity: v }))}
                keyboardType="numeric"
                placeholder="0"
              />
              <TextField
                label="Reorder Threshold"
                value={form.reorderThreshold}
                onChangeText={v => setForm(p => ({ ...p, reorderThreshold: v }))}
                keyboardType="numeric"
                placeholder="0"
              />
              <TextField
                label="Unit Cost (₹)"
                value={form.unitCost}
                onChangeText={v => setForm(p => ({ ...p, unitCost: v }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </Card>

            <Button
              title={saving ? 'Saving...' : editingId ? 'Update Item' : 'Save Item'}
              onPress={save}
              disabled={saving}
            />
            {saving && (
              <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!assignItem}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAssignItem(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Check Out — {assignItem?.name}
            </Text>
            <TouchableOpacity onPress={() => setAssignItem(null)}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Card>
              <SectionTitle
                title="Record who's taking this"
                sub="Track where equipment goes and when it's due back"
              />
              <ChipSelect
                label="Taken by"
                options={['Student', 'Employee'] as const}
                value={assignModel}
                onChange={v => {
                  setAssignModel(v);
                  setAssignPersonId('');
                }}
                labels={{ Student: 'Student', Employee: 'Employee / Coach' }}
              />
              <Text style={styles.fieldLabelStandalone}>
                {assignModel} {assignPeopleLoading ? '(loading…)' : ''}
              </Text>
              <ScrollView style={styles.personList} nestedScrollEnabled>
                {assignPeople.length === 0 && !assignPeopleLoading ? (
                  <Text style={styles.emptyPeopleText}>No {assignModel.toLowerCase()}s found</Text>
                ) : (
                  assignPeople.map(p => {
                    const selected = assignPersonId === p._id;
                    return (
                      <TouchableOpacity
                        key={p._id}
                        onPress={() => setAssignPersonId(p._id)}
                        style={[styles.personRow, selected && styles.personRowSelected]}
                      >
                        <Text
                          style={[
                            styles.personRowText,
                            selected && { color: colors.white },
                          ]}
                        >
                          {p.firstName} {p.lastName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
              <TextField
                label="Quantity"
                value={assignQty}
                onChangeText={setAssignQty}
                keyboardType="numeric"
                placeholder="1"
              />
              <TextField
                label="Notes (optional)"
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder="e.g. for weekend tournament"
              />
            </Card>

            <Button
              title={assigning ? 'Recording...' : 'Record Check-Out'}
              onPress={submitAssign}
              disabled={assigning}
            />
            {assigning && (
              <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />
            )}

            {!!assignItem?.assignments?.filter((a: any) => !a.returnedAt)
              .length && (
              <Card>
                <SectionTitle title="Currently taken out" />
                {assignItem.assignments
                  .filter((a: any) => !a.returnedAt)
                  .map((a: any) => (
                    <View key={a._id} style={styles.activeAssignmentRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.activeAssignmentName} numberOfLines={1}>
                          {typeof a.assignedTo === 'object'
                            ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                            : 'Unknown'}
                        </Text>
                        <Text style={styles.sub}>
                          {a.assignedToModel} · Qty {a.quantity}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => returnAssignment(a._id)}
                        style={styles.returnBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Undo2 size={13} color={colors.blue} strokeWidth={2.5} />
                        <Text style={styles.returnBtnText}>Returned</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!txnItem}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTxnItem(null)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Stock Movement — {txnItem?.name}
            </Text>
            <TouchableOpacity onPress={() => setTxnItem(null)}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {!!txnItem?.onOrderQuantity && (
              <Text style={[styles.onOrderText, { marginBottom: 8 }]}>
                {txnItem.onOrderQuantity} unit
                {txnItem.onOrderQuantity === 1 ? '' : 's'} on order, not yet
                received
              </Text>
            )}
            <Card>
              <TextField
                label="Quantity"
                value={txnQty}
                onChangeText={setTxnQty}
                keyboardType="numeric"
                placeholder="1"
              />
            </Card>

            <TouchableOpacity
              style={[styles.txnRow, { borderColor: colors.purple }]}
              onPress={() => handleTxn('order')}
              disabled={!!txnSaving}
            >
              <Truck size={16} color={colors.purple} strokeWidth={2.5} />
              <Text style={[styles.txnRowText, { color: colors.purple }]}>
                Order Placed (with supplier)
              </Text>
              {txnSaving === 'order' && <ActivityIndicator color={colors.purple} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.txnRow, { borderColor: colors.green }]}
              onPress={() => handleTxn('purchase')}
              disabled={!!txnSaving}
            >
              <ArrowDownCircle size={16} color={colors.green} strokeWidth={2.5} />
              <Text style={[styles.txnRowText, { color: colors.green }]}>
                Received
              </Text>
              {txnSaving === 'purchase' && (
                <ActivityIndicator color={colors.green} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.txnRow, { borderColor: colors.blue }]}
              onPress={() => handleTxn('return')}
              disabled={!!txnSaving}
            >
              <ArrowDownCircle size={16} color={colors.blue} strokeWidth={2.5} />
              <Text style={[styles.txnRowText, { color: colors.blue }]}>
                Return to Stock
              </Text>
              {txnSaving === 'return' && <ActivityIndicator color={colors.blue} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.txnRow, { borderColor: colors.orange }]}
              onPress={() => handleTxn('consume')}
              disabled={!!txnSaving}
            >
              <ArrowUpCircle size={16} color={colors.orange} strokeWidth={2.5} />
              <Text style={[styles.txnRowText, { color: colors.orange }]}>
                Consume
              </Text>
              {txnSaving === 'consume' && (
                <ActivityIndicator color={colors.orange} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.txnRow, { borderColor: colors.red }]}
              onPress={() => handleTxn('damage')}
              disabled={!!txnSaving}
            >
              <ArrowUpCircle size={16} color={colors.red} strokeWidth={2.5} />
              <Text style={[styles.txnRowText, { color: colors.red }]}>
                Damaged / Lost
              </Text>
              {txnSaving === 'damage' && <ActivityIndicator color={colors.red} />}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  subtitle: { color: colors.muted, marginTop: 2, fontFamily: FONT.medium },
  addBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  lowStockToggle: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  lowStockToggleActive: { backgroundColor: colors.red },
  lowStockToggleText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  photoBox: {
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black, flexShrink: 1 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2, fontFamily: FONT.medium },
  qty: { fontWeight: '800', color: colors.black, fontSize: 15, marginTop: 8 },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  photoPickRow: { alignItems: 'center', marginBottom: 16 },
  photoPickBox: {
    width: 84,
    height: 84,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  photoPickImg: { width: 84, height: 84 },
  photoEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  fieldLabelStandalone: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  personList: {
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: 14,
    maxHeight: 220,
  },
  emptyPeopleText: {
    fontFamily: FONT.medium,
    color: colors.muted,
    fontSize: 13,
    padding: 12,
  },
  personRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  personRowSelected: {
    backgroundColor: colors.blue,
  },
  personRowText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: colors.black,
  },
  activeAssignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  activeAssignmentName: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 2,
    borderColor: colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  returnBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.blue,
  },
  onOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  onOrderText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.purple,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  txnRowText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
    flex: 1,
  },
});
