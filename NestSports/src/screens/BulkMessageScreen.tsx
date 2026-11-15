import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { bulkMessageAPI, studentAPI } from '../api/client';
import {
  Button,
  Card,
  FilePicker,
  LoadingView,
  PickedFile,
  SearchBar,
  SectionTitle,
  TextField,
  useToast,
} from '../components/ui';
import { BackTitle } from '../components/ScreenHeader';
import { colors, FONT } from '../theme/colors';
import { fetchAllPages } from '../utils/fetchAllPages';
import { notifyError } from '../utils/notifyError';

type Audience = 'all' | 'custom';

export default function BulkMessageScreen() {
  const toast = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [doc, setDoc] = useState<PickedFile | undefined>();
  const [audience, setAudience] = useState<Audience>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const r: any = await bulkMessageAPI.list();
    setHistory(r.data || []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchAllPages(studentAPI.getAll, { limit: '1000' }).then((r: any) =>
        setStudents((r.data || []).filter((s: any) => s.status === 'active')),
      ),
      loadHistory(),
    ])
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, [loadHistory]);

  // a batch that is still sending: poll until it settles
  useEffect(() => {
    if (!history.some(h => h.running)) return;
    const t = setInterval(() => loadHistory().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [history, loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory().catch(notifyError);
    setRefreshing(false);
  };

  const toggle = (id: string) =>
    setPicked(p => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const q = search.trim().toLowerCase();
  const shown = students.filter(s =>
    q
      ? `${s.firstName} ${s.lastName || ''} ${s.studentId || ''}`
          .toLowerCase()
          .includes(q)
      : true,
  );

  const count = audience === 'all' ? students.length : picked.size;
  const canSend = (text.trim() || doc) && count > 0;

  const send = () =>
    Alert.alert(
      'Send on WhatsApp?',
      `This goes to the parents of ${count} student${count === 1 ? '' : 's'}${
        doc ? ' with the document' : ''
      }. Each message uses WhatsApp credits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              await bulkMessageAPI.create(
                text.trim(),
                audience === 'all' ? [] : Array.from(picked),
                doc,
              );
              toast.success('Sending started');
              setText('');
              setDoc(undefined);
              setPicked(new Set());
              await loadHistory();
            } catch (e) {
              notifyError(e);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );

  const resend = async (id: string) => {
    setResendingId(id);
    try {
      await bulkMessageAPI.resend(id);
      toast.success('Retrying the ones who did not get it');
      await loadHistory();
    } catch (e) {
      notifyError(e);
    } finally {
      setResendingId(null);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <BackTitle title="WhatsApp to Parents" />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card>
          <TextField
            label="Message"
            value={text}
            onChangeText={setText}
            placeholder="Type your message to parents…"
            multiline
          />
          <FilePicker
            label="Document (optional)"
            value={doc}
            onChange={setDoc}
          />
          <Text style={styles.note}>
            WhatsApp delivers free-text messages only to parents who messaged
            your number in the last 24 hours. Anyone missed shows as Failed —
            tap Resend tomorrow.
          </Text>
        </Card>

        <SectionTitle title="Send to" />
        <View style={styles.chips}>
          {(['all', 'custom'] as Audience[]).map(a => (
            <TouchableOpacity
              key={a}
              onPress={() => setAudience(a)}
              style={[styles.chip, audience === a && styles.chipOn]}
            >
              <Text
                style={[styles.chipText, audience === a && { color: '#fff' }]}
              >
                {a === 'all'
                  ? `All parents (${students.length})`
                  : `Select students${picked.size ? ` (${picked.size})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {audience === 'custom' ? (
          <View style={{ marginTop: 10 }}>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search student…"
            />
            <Card style={{ marginTop: 8, padding: 0 }}>
              <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
                {shown.map(s => {
                  const on = picked.has(s._id);
                  return (
                    <TouchableOpacity
                      key={s._id}
                      onPress={() => toggle(s._id)}
                      style={styles.pickRow}
                    >
                      <View style={[styles.box, on && styles.boxOn]}>
                        {on ? (
                          <Check size={14} color="#fff" strokeWidth={3} />
                        ) : null}
                      </View>
                      <Text style={styles.pickName}>
                        {s.firstName} {s.lastName}
                      </Text>
                      <Text style={styles.pickId}>{s.studentId}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Card>
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <Button
            title={`Send to ${count} student${count === 1 ? '' : 's'}`}
            onPress={send}
            loading={sending}
            disabled={!canSend}
          />
        </View>

        <SectionTitle title="Sent messages" />
        {history.length === 0 ? (
          <Text style={styles.note}>Nothing sent yet.</Text>
        ) : null}
        {history.map(h => {
          const left = h.failed + h.pending;
          return (
            <Card key={h._id} style={{ marginBottom: 10 }}>
              <Text style={styles.msg} numberOfLines={3}>
                {h.text || h.doc}
              </Text>
              {h.doc && h.text ? (
                <Text style={styles.note}>📎 {h.doc}</Text>
              ) : null}
              <Text style={styles.stats}>
                {new Date(h.createdAt).toLocaleString('en-IN')} · Sent {h.sent}
                /{h.total}
                {h.failed ? ` · Failed ${h.failed}` : ''}
                {h.running ? ' · sending…' : ''}
              </Text>
              {left > 0 && !h.running ? (
                <View style={{ marginTop: 10 }}>
                  <Button
                    title={`Resend to ${left} who didn't get it`}
                    variant="outline"
                    loading={resendingId === h._id}
                    onPress={() => resend(h._id)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  note: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.blue },
  chipText: { fontFamily: FONT.bold, fontSize: 12, color: colors.black },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.blue },
  pickName: { flex: 1, fontFamily: FONT.medium, fontSize: 13, color: colors.black },
  pickId: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted },
  msg: { fontFamily: FONT.medium, fontSize: 13, color: colors.black },
  stats: { fontFamily: FONT.bold, fontSize: 11, color: colors.black, marginTop: 8 },
});
