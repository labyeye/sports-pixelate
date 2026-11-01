import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Plus, Trash2, X } from 'lucide-react-native';
import { employeeAPI, offerLetterAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  ChipSelect,
  EmptyState,
  LoadingView,
  TextField,
} from '../components/ui';
import ScreenHeader, { headerBtn } from '../components/ScreenHeader';
import SlideInCard from '../components/motion/SlideInCard';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

export default function LettersScreen() {
  const { user } = useAuth();
  const [letters, setLetters] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ id?: string; name: string; body: string } | null>(null);
  const [gen, setGen] = useState<{ letter: any; who: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r: any = await offerLetterAPI.getAll();
      setLetters(r.data || []);
    } catch (e) {
      notifyError(e);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    employeeAPI
      .getAll({ limit: '200' })
      .then((r: any) => setStaff(r.data || []))
      .catch(() => {});
  }, [load]);

  const nameOf = (s: any) => `${s.firstName || ''} ${s.lastName || ''}`.trim();

  const fill = (body: string, who: string) => {
    const e = staff.find(s => nameOf(s) === who);
    const vals: Record<string, string> = {
      name: e ? nameOf(e) : '',
      designation: e?.designation || '',
      company: (user as any)?.company?.name || '',
      empId: e?.employeeId || '',
      joiningDate: e?.joinDate ? new Date(e.joinDate).toLocaleDateString('en-IN') : '',
    };
    return body.replace(/{{(\w+)}}/g, (m, k) => vals[k] || m);
  };

  const save = async () => {
    if (!edit || !edit.name.trim()) return;
    try {
      const body = { name: edit.name.trim(), body: edit.body };
      if (edit.id) await offerLetterAPI.update(edit.id, body);
      else await offerLetterAPI.create(body);
      setEdit(null);
      await load();
    } catch (e) {
      notifyError(e);
    }
  };

  const remove = (l: any) =>
    Alert.alert('Delete template', `Delete "${l.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await offerLetterAPI.delete(l._id);
            setLetters(p => p.filter(x => x._id !== l._id));
          } catch (e) {
            notifyError(e);
          }
        },
      },
    ]);

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader
        title="Letters"
        right={
          <TouchableOpacity
            onPress={() => setEdit({ name: '', body: '' })}
            style={headerBtn}
            hitSlop={8}
          >
            <Plus size={20} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={letters}
        keyExtractor={l => l._id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState title="No templates" icon={FileText} />}
        renderItem={({ item: l, index }) => (
          <SlideInCard index={index}>
            <View style={styles.card}>
              <Text style={styles.title}>{l.name}</Text>
              <Text style={styles.meta} numberOfLines={2}>
                {l.body}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => setGen({ letter: l, who: '', text: l.body })}>
                  <Text style={styles.link}>Generate</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEdit({ id: l._id, name: l.name, body: l.body })}>
                  <Text style={styles.link}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(l)} hitSlop={8}>
                  <Trash2 size={16} color={colors.red} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          </SlideInCard>
        )}
      />

      <Modal visible={!!edit} animationType="slide" onRequestClose={() => setEdit(null)}>
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>{edit?.id ? 'Edit' : 'New'} template</Text>
            <TouchableOpacity onPress={() => setEdit(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TextField label="Name" value={edit?.name || ''} onChangeText={v => edit && setEdit({ ...edit, name: v })} required />
              <TextField label="Body" value={edit?.body || ''} onChangeText={v => edit && setEdit({ ...edit, body: v })} multiline />
              <Text style={styles.meta}>
                Placeholders: {'{{name}} {{designation}} {{company}} {{empId}} {{joiningDate}} {{ctc}}'}
              </Text>
              <View style={{ height: 12 }} />
              <Button title="Save" onPress={save} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!gen} animationType="slide" onRequestClose={() => setGen(null)}>
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>{gen?.letter.name}</Text>
            <TouchableOpacity onPress={() => setGen(null)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <ChipSelect
                label="Staff member"
                options={staff.map(nameOf) as readonly string[]}
                value={gen?.who || ''}
                onChange={w => gen && setGen({ ...gen, who: w, text: fill(gen.letter.body, w) })}
              />
              <TextField label="Letter" value={gen?.text || ''} onChangeText={v => gen && setGen({ ...gen, text: v })} multiline />
              <Button title="Share / Save" onPress={() => gen && Share.share({ message: gen.text })} />
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
    borderColor: colors.black,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    padding: 14,
  },
  title: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 15, color: colors.black },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  link: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12, color: colors.blue },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headTitle: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 18, color: colors.black },
});
