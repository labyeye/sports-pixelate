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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import {
  ArrowUpDown,
  Trash2,
  Plus,
  X,
  Download,
  Upload,
  Tag,
} from 'lucide-react-native';
import { documentAPI, employeeAPI } from '../api/client';
import {
  Row,
  Badge,
  EmptyState,
  LoadingView,
  SearchBar,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const DOC_TYPES = [
  'id_proof',
  'certificate',
  'contract',
  'resume',
  'offer_letter',
  'other',
] as const;

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'createdAt', label: 'Date Uploaded' },
];

function uriToDataUri(uri: string): Promise<string> {
  return fetch(uri)
    .then(res => res.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

let searchDebounce: ReturnType<typeof setTimeout>;

export default function DocumentsScreen() {
  const { user } = useAuth();
  const isSelf = user?.role === 'employee';

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [docType, setDocType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortVisible, setSortVisible] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [uploadForm, setUploadForm] = useState({
    employeeId: '',
    name: '',
    docType: 'id_proof' as (typeof DOC_TYPES)[number],
  });
  const [pickedAsset, setPickedAsset] = useState<Asset | undefined>();
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (pageNum: number) =>
      documentAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        ...(docType ? { docType } : {}),
        sortBy,
        sortDir,
      }),
    [search, docType, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      if (res.success) {
        setDocuments(res.data || []);
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
        setDocuments(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const onDelete = (doc: any) => {
    Alert.alert(
      'Delete Document',
      `Delete "${doc.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentAPI.delete(doc._id);
              setDocuments(prev => prev.filter(d => d._id !== doc._id));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete document');
            }
          },
        },
      ],
    );
  };

  const openUpload = () => {
    setUploadForm({ employeeId: '', name: '', docType: 'id_proof' });
    setPickedAsset(undefined);
    setFormVisible(true);
    if (!isSelf) {
      employeeAPI
        .getAll({ limit: '500' })
        .then((r: any) => setEmployees(r.data || []))
        .catch(() => {});
    }
  };

  const pickFile = () => {
    launchImageLibrary({ mediaType: 'mixed', quality: 0.8 }, r => {
      const asset = r.assets?.[0];
      if (asset) {
        setPickedAsset(asset);
        if (!uploadForm.name) {
          setUploadForm(p => ({ ...p, name: asset.fileName || 'Document' }));
        }
      }
    });
  };

  const submitUpload = async () => {
    if (!pickedAsset?.uri) {
      Alert.alert('Missing file', 'Choose a photo or file to upload');
      return;
    }
    if (!uploadForm.name.trim()) {
      Alert.alert('Missing field', 'Document name is required');
      return;
    }
    if (!isSelf && !uploadForm.employeeId) {
      Alert.alert(
        'Missing field',
        'Select which employee this document belongs to',
      );
      return;
    }
    setUploading(true);
    try {
      const fileData = await uriToDataUri(pickedAsset.uri);
      await documentAPI.upload({
        employeeId: uploadForm.employeeId || undefined,
        name: uploadForm.name.trim(),
        docType: uploadForm.docType,
        mimeType: pickedAsset.type || 'application/octet-stream',
        fileData,
      });
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not upload document');
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (doc: any) => {
    setDownloadingId(doc._id);
    try {
      const res: any = await documentAPI.download(doc._id);
      const { fileData, mimeType, name } = res.data || res;
      const uri = fileData?.startsWith('data:')
        ? fileData
        : `data:${mimeType || 'application/octet-stream'};base64,${fileData}`;
      await Share.share({ url: uri, title: name || doc.name });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not download document');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Documents</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openUpload}
              style={styles.addBtn}
              hitSlop={8}
            >
              <Plus size={14} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search documents..."
        />
        <FilterPills
          options={[
            { value: '', label: 'All' },
            ...DOC_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') })),
          ]}
          value={docType}
          onChange={setDocType}
        />

        <FlatList
          data={documents}
          keyExtractor={d => d._id}
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
          ListEmptyComponent={<EmptyState title="No documents found" />}
          renderItem={({ item: doc }) => (
            <Row
              title={doc.name}
              subtitle={
                doc.createdAt
                  ? new Date(doc.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : ''
              }
              right={
                <View style={styles.rowActions}>
                  <Badge
                    label={(doc.docType || '-').replace(/_/g, ' ')}
                    color={colors.blue}
                  />
                  <TouchableOpacity
                    onPress={() => onDownload(doc)}
                    hitSlop={8}
                    disabled={downloadingId === doc._id}
                  >
                    {downloadingId === doc._id ? (
                      <ActivityIndicator size="small" color={colors.blue} />
                    ) : (
                      <Download size={16} color={colors.blue} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete(doc)} hitSlop={8}>
                    <Trash2 size={16} color={colors.red} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              }
            />
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
            <Text style={styles.formTitle}>Upload Document</Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            <TouchableOpacity onPress={pickFile} style={styles.pickFileBox}>
              <Upload size={20} color={colors.blue} strokeWidth={2.5} />
              <Text style={styles.pickFileText}>
                {pickedAsset
                  ? pickedAsset.fileName || 'File selected'
                  : 'Choose a file to upload'}
              </Text>
            </TouchableOpacity>

            {!isSelf && (
              <>
                <SectionTitle title="Employee" />
                <ScrollView style={styles.pickList} nestedScrollEnabled>
                  {employees.map((e: any) => {
                    const selected = uploadForm.employeeId === e._id;
                    return (
                      <TouchableOpacity
                        key={e._id}
                        onPress={() =>
                          setUploadForm(p => ({ ...p, employeeId: e._id }))
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
                          {e.firstName} {e.lastName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <TextField
              label="Document Name"
              icon={Tag}
              value={uploadForm.name}
              onChangeText={v => setUploadForm(p => ({ ...p, name: v }))}
              placeholder="e.g. Aadhaar Card"
              required
            />
            <ChipSelect
              label="Document Type"
              icon={Tag}
              options={DOC_TYPES}
              value={uploadForm.docType}
              onChange={v => setUploadForm(p => ({ ...p, docType: v }))}
            />

            <Button
              title={uploading ? 'Uploading...' : 'Upload'}
              onPress={submitUpload}
              disabled={uploading}
            />
            {uploading && (
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
  listCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  pickFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    padding: 14,
    marginBottom: 16,
  },
  pickFileText: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: colors.black,
    flex: 1,
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
});
