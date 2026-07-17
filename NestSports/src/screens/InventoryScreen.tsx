import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { Plus, Pencil, Trash2, Package, X, Camera } from 'lucide-react-native';
import { inventoryAPI, RNFile } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
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

export default function InventoryScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<RNFile | undefined>();
  const [existingPhoto, setExistingPhoto] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res: any = await inventoryAPI.getAll();
    setItems(res.data || []);
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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>Sports equipment and stock levels</Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
              <Plus size={20} color={colors.blue} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <Card>
            <EmptyState title="No inventory items found" />
          </Card>
        ) : (
          items.map(i => {
            const low = i.availableQuantity <= (i.reorderThreshold ?? 0);
            return (
              <Card key={i._id}>
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
                  </View>
                </View>
                {isOwner && (
                  <View style={styles.actionsRow}>
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
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

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
});
