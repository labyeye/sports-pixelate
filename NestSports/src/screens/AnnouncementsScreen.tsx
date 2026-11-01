import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Pin, Plus, Trash2, X } from 'lucide-react-native';
import { announcementAPI } from '../api/client';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import {
  Badge,
  Button,
  ChipSelect,
  EmptyState,
  ImagePicker,
  LoadingView,
  TextField,
  ToggleRow,
  PickedImage,
} from '../components/ui';
import ScreenHeader, { headerBtn } from '../components/ScreenHeader';
import SlideInCard from '../components/motion/SlideInCard';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

const CATEGORIES = [
  'general',
  'urgent',
  'event',
  'holiday',
  'policy',
  'hr',
] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const AUDIENCES = ['all', 'parents', 'staff'] as const;

const PRIORITY_COLOR: Record<string, string> = {
  low: colors.muted,
  medium: colors.blue,
  high: colors.orange,
  critical: colors.red,
};

// The API serves posters from the server root, not under /api.
const assetUrl = (p?: string) =>
  p ? `${API_BASE_URL.replace(/\/api$/, '')}${p}` : undefined;

const EMPTY = {
  title: '',
  content: '',
  category: 'general' as (typeof CATEGORIES)[number],
  priority: 'medium' as (typeof PRIORITIES)[number],
  audience: 'all' as (typeof AUDIENCES)[number],
  pinned: false,
  acknowledgementRequired: false,
};

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'hr_manager';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [poster, setPoster] = useState<PickedImage | undefined>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await announcementAPI.getAll();
      setItems(r.data || []);
    } catch (e) {
      notifyError(e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const open = (a: any) => {
    if (!isAdmin && !a.read) {
      announcementAPI.markRead(a._id).catch(() => {});
      setItems(p => p.map(x => (x._id === a._id ? { ...x, read: true } : x)));
    }
  };

  const acknowledge = async (a: any) => {
    try {
      await announcementAPI.acknowledge(a._id);
      setItems(p =>
        p.map(x =>
          x._id === a._id ? { ...x, read: true, acknowledged: true } : x,
        ),
      );
    } catch (e) {
      notifyError(e);
    }
  };

  const remove = (a: any) =>
    Alert.alert('Delete announcement', `Delete "${a.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await announcementAPI.delete(a._id);
            setItems(p => p.filter(x => x._id !== a._id));
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert('Missing details', 'Title and message are required');
      return;
    }
    setSaving(true);
    try {
      let posterUrl: string | undefined;
      if (poster) {
        const up: any = await announcementAPI.uploadPoster(poster);
        posterUrl = up.url;
      }
      await announcementAPI.create({
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        priority: form.priority,
        pinned: form.pinned,
        acknowledgementRequired: form.acknowledgementRequired,
        posterUrl,
        ...(form.audience === 'all'
          ? { targetAudience: 'all' }
          : {
              targetAudience: 'role',
              roles:
                form.audience === 'parents'
                  ? ['parent']
                  : ['employee', 'department_head', 'hr_executive'],
            }),
      });
      setFormOpen(false);
      setForm({ ...EMPTY });
      setPoster(undefined);
      await load();
    } catch (e) {
      notifyError(e);
    }
    setSaving(false);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader
        title="Announcements"
        right={
          isAdmin ? (
            <TouchableOpacity
              onPress={() => setFormOpen(true)}
              style={headerBtn}
              hitSlop={8}
            >
              <Plus size={20} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      <FlatList
        data={items}
        keyExtractor={a => a._id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={<EmptyState title="No announcements yet" />}
        renderItem={({ item: a, index }) => (
          <SlideInCard index={index}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => open(a)}
              style={[styles.card, !isAdmin && !a.read && styles.unread]}
            >
              {!!a.posterUrl && (
                <Image
                  source={{ uri: assetUrl(a.posterUrl) }}
                  style={styles.poster}
                />
              )}
              <View style={styles.row}>
                {a.pinned && <Pin size={14} color={colors.orange} />}
                <Text style={styles.title} numberOfLines={2}>
                  {a.title}
                </Text>
              </View>
              <View style={[styles.row, { flexWrap: 'wrap', marginTop: 6 }]}>
                <Badge label={a.category} color={colors.blue} />
                <Badge
                  label={a.priority}
                  color={PRIORITY_COLOR[a.priority] || colors.blue}
                />
                {a.targetAudience === 'role' && (
                  <Badge
                    label={
                      (a.roles || []).includes('parent') ? 'Parents' : 'Staff'
                    }
                    color={colors.purple}
                  />
                )}
              </View>
              <Text style={styles.body}>{a.content}</Text>
              <Text style={styles.meta}>
                {a.postedBy?.name ? `${a.postedBy.name} · ` : ''}
                {new Date(a.date || a.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              {isAdmin ? (
                <View style={[styles.row, { marginTop: 8 }]}>
                  <Text style={styles.meta}>
                    {(a.readBy || []).length} read
                    {a.acknowledgementRequired
                      ? ` · ${(a.acknowledgedBy || []).length} acknowledged`
                      : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => remove(a)}
                    hitSlop={8}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Trash2 size={16} color={colors.red} />
                  </TouchableOpacity>
                </View>
              ) : (
                a.acknowledgementRequired &&
                (a.acknowledged ? (
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <CheckCircle2 size={14} color={colors.green} />
                    <Text style={[styles.meta, { color: colors.green }]}>
                      Acknowledged
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    <Button
                      title="I have read this"
                      onPress={() => acknowledge(a)}
                    />
                  </View>
                ))
              )}
            </TouchableOpacity>
          </SlideInCard>
        )}
      />

      <Modal
        visible={formOpen}
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHead}>
            <Text style={styles.formTitle}>New announcement</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextField
                label="Title"
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
              />
              <TextField
                label="Message"
                value={form.content}
                onChangeText={v => setForm(p => ({ ...p, content: v }))}
                multiline
              />
              <ChipSelect
                label="Category"
                options={CATEGORIES}
                value={form.category}
                onChange={v => setForm(p => ({ ...p, category: v }))}
              />
              <ChipSelect
                label="Priority"
                options={PRIORITIES}
                value={form.priority}
                onChange={v => setForm(p => ({ ...p, priority: v }))}
              />
              <ChipSelect
                label="Send to"
                options={AUDIENCES}
                value={form.audience}
                onChange={v => setForm(p => ({ ...p, audience: v }))}
                labels={{ all: 'Everyone', parents: 'Parents', staff: 'Staff' }}
              />
              <ImagePicker
                label="Poster (optional)"
                value={poster}
                onChange={setPoster}
              />
              <ToggleRow
                label="Pin to top"
                value={form.pinned}
                onChange={v => setForm(p => ({ ...p, pinned: v }))}
              />
              <ToggleRow
                label="Ask readers to acknowledge"
                value={form.acknowledgementRequired}
                onChange={v =>
                  setForm(p => ({ ...p, acknowledgementRequired: v }))
                }
              />
              <Button title="Publish" onPress={save} loading={saving} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 14,
    overflow: 'hidden',
  },
  unread: { borderLeftWidth: 6, borderLeftColor: colors.blue },
  poster: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: 16, color: colors.black },
  body: { marginTop: 8, fontSize: 13, color: colors.black, lineHeight: 19 },
  meta: { marginTop: 6, fontSize: 11, color: colors.muted },
  formHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  formTitle: { fontFamily: FONT.bold, fontSize: 18, color: colors.black },
});
