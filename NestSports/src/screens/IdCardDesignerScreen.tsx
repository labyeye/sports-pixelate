import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  IdCard,
  LayoutTemplate,
  Minus,
  Plus,
  Printer,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react-native';
import { C } from '../theme';
import { settingsAPI } from '../api/client';
import IdCardView from '../idcard/IdCardView';
import { loadIdCardSetup } from '../idcard/data';
import { printIdCards } from '../idcard/printHtml';
import {
  DEFAULT_PALETTE,
  LIBRARY,
  PALETTES,
  type Palette,
} from '../idcard/idCardLibrary';
import {
  fieldOptionsFor,
  toStudentTemplate,
  SAMPLE_STUDENT,
  type CardKind,
  FONT_LABELS,
  KIND_LABELS,
  SAMPLE_EMPLOYEE,
  SIZE_OPTIONS,
  makeEl,
  type ElKind,
  type FontKey,
  type IdCardTemplate,
  type IdCompany,
  type IdEl,
  type IdSide,
} from '../idcard/idCard';

const SWATCHES = [
  '#000000', '#111827', '#475569', '#94a3b8', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#1e3a8f',
  '#8b5cf6', '#d946ef', '#ec4899', '#9f1239', '#78350f',
];
const ADDABLE: ElKind[] = ['text', 'field', 'photo', 'logo', 'qr', 'shape'];
const FONT_KEYS = Object.keys(FONT_LABELS) as FontKey[];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

function Stepper({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={s.stepper}>
      <Text style={s.mini}>{label}</Text>
      <View style={s.stepRow}>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(r1(value - step))}>
          <Minus size={14} color={C.black} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{r1(value)}</Text>
        <TouchableOpacity style={s.stepBtn} onPress={() => onChange(r1(value + step))}>
          <Plus size={14} color={C.black} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <View style={s.swatchWrap}>
      {SWATCHES.map(c => (
        <TouchableOpacity
          key={c}
          onPress={() => onPick(c)}
          style={[
            s.swatch,
            { backgroundColor: c },
            value?.toLowerCase() === c && { borderColor: C.primary, borderWidth: 3 },
          ]}
        />
      ))}
    </View>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, on && s.chipOn]} onPress={onPress}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function IdCardDesignerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kind: CardKind = route.params?.kind === 'student' ? 'student' : 'staff';
  const isStudent = kind === 'student';
  const FIELD_OPTIONS = fieldOptionsFor(kind);
  const SAMPLE = isStudent ? SAMPLE_STUDENT : SAMPLE_EMPLOYEE;
  const { width: winW } = useWindowDimensions();
  const [template, setTemplate] = useState<IdCardTemplate | null>(null);
  const [company, setCompany] = useState<IdCompany | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [undo, setUndo] = useState<IdCardTemplate[]>([]);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [selId, setSelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [error, setError] = useState('');

  useEffect(() => {
    loadIdCardSetup(kind)
      .then(r => {
        setTemplate(r.template);
        setCompany(r.company);
        setSavedJson(JSON.stringify(r.template));
      })
      .catch(e => setError(e?.message || 'Could not load the design'));
  }, []);

  const dirty = !!template && JSON.stringify(template) !== savedJson;
  const cur: IdSide | null = template ? (side === 'front' ? template.front : template.back) : null;
  const sel = cur?.elements.find(e => e.id === selId) || null;

  /** Every edit goes through here so it can be undone. */
  const commit = (next: IdCardTemplate) => {
    setUndo(u => [...u.slice(-29), template!]);
    setTemplate(next);
  };
  const setSideData = (patch: Partial<IdSide>) =>
    commit({ ...template!, [side]: { ...cur!, ...patch } });
  const patchEl = (patch: Partial<IdEl>) =>
    setSideData({ elements: cur!.elements.map(e => (e.id === selId ? { ...e, ...patch } : e)) });

  const move = (id: string, dir: -1 | 1) => {
    const els = [...cur!.elements];
    const i = els.findIndex(e => e.id === id);
    const j = i + dir;
    if (j < 0 || j >= els.length) return;
    [els[i], els[j]] = [els[j], els[i]];
    setSideData({ elements: els });
  };

  const addEl = (kind: ElKind) => {
    const el = makeEl(kind, { x: 10, y: 10 });
    setSideData({ elements: [...cur!.elements, el] });
    setSelId(el.id);
    setAddOpen(false);
  };
  const dupEl = () => {
    if (!sel) return;
    const el = { ...sel, id: makeEl('text').id, x: sel.x + 3, y: sel.y + 3 };
    setSideData({ elements: [...cur!.elements, el] });
    setSelId(el.id);
  };
  const delEl = () => {
    if (!sel) return;
    setSideData({ elements: cur!.elements.filter(e => e.id !== sel.id) });
    setSelId(null);
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await settingsAPI.update(
        isStudent ? { studentIdCardTemplate: template } : { idCardTemplate: template },
      );
      setSavedJson(JSON.stringify(template));
      Alert.alert('Saved', "It's now used when you print ID cards.");
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
    setSaving(false);
  };

  const testPrint = async () => {
    try {
      await printIdCards([SAMPLE], template!, company!, 'both');
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) Alert.alert('Print failed', e.message);
    }
  };

  const back = () => {
    if (!dirty) return navigation.goBack();
    Alert.alert('Discard changes?', 'Your unsaved design changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const portrait = template?.size === 'cr80-portrait';
  const previewW = Math.min(winW - 64, portrait ? 220 : 340);
  const libItems = useMemo(
    () =>
      LIBRARY.map(l => ({
        ...l,
        t: isStudent ? toStudentTemplate(l.build(palette)) : l.build(palette),
      })),
    [palette, isStudent],
  );

  if (error)
    return (
      <SafeAreaView style={s.safe}>
        <Text style={[s.err, { margin: 20 }]}>{error}</Text>
      </SafeAreaView>
    );
  if (!template || !company || !cur)
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator color={C.primary} />
      </SafeAreaView>
    );

  const isText = sel && (sel.kind === 'text' || sel.kind === 'field');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={back} hitSlop={8} style={{ padding: 4 }}>
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <IdCard size={20} color={C.primary} />
        <Text style={s.title}>{isStudent ? 'Student ID Card Designer' : 'ID Card Designer'}</Text>
        <TouchableOpacity
          disabled={!undo.length}
          onPress={() => {
            setTemplate(undo[undo.length - 1]);
            setUndo(u => u.slice(0, -1));
          }}
          style={{ opacity: undo.length ? 1 : 0.3, padding: 6 }}
        >
          <Undo2 size={20} color={C.black} />
        </TouchableOpacity>
        <TouchableOpacity onPress={testPrint} style={{ padding: 6 }}>
          <Printer size={20} color={C.black} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={save}
          disabled={saving || !dirty}
          style={[s.saveBtn, (!dirty || saving) && { opacity: 0.45 }]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save size={14} color="#fff" />
              <Text style={s.saveText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* side toggle */}
        <View style={s.rowWrap}>
          <Chip on={side === 'front'} label="Front" onPress={() => { setSide('front'); setSelId(null); }} />
          {template.backEnabled && (
            <Chip on={side === 'back'} label="Back" onPress={() => { setSide('back'); setSelId(null); }} />
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.toolBtn} onPress={() => setLibOpen(true)}>
            <LayoutTemplate size={15} color={C.primary} />
            <Text style={s.toolText}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.toolBtn} onPress={() => setAddOpen(true)}>
            <Plus size={15} color={C.primary} />
            <Text style={s.toolText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* preview */}
        <View style={s.preview}>
          <View style={s.shadow}>
            <IdCardView
              template={template}
              side={side}
              employee={SAMPLE}
              company={company}
              width={previewW}
              selectedId={selId}
              onSelect={setSelId}
            />
          </View>
          <Text style={s.hint}>Tap an element on the card to edit it.</Text>
        </View>

        {/* selected element */}
        {sel ? (
          <View style={s.panel}>
            <View style={s.panelHead}>
              <Text style={s.panelTitle}>{KIND_LABELS[sel.kind]}</Text>
              <TouchableOpacity onPress={dupEl} style={s.iconBtn}>
                <Copy size={16} color={C.black} />
              </TouchableOpacity>
              <TouchableOpacity onPress={delEl} style={s.iconBtn}>
                <Trash2 size={16} color={C.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelId(null)} style={s.iconBtn}>
                <X size={16} color={C.black} />
              </TouchableOpacity>
            </View>

            {sel.kind === 'text' && (
              <>
                <Text style={s.mini}>Text</Text>
                <TextInput
                  style={s.input}
                  value={sel.text}
                  onChangeText={v => patchEl({ text: v })}
                  multiline
                />
              </>
            )}
            {sel.kind === 'field' && (
              <>
                <Text style={s.mini}>Data field</Text>
                <View style={s.rowWrap}>
                  {FIELD_OPTIONS.map(f => (
                    <Chip key={f.key} on={sel.field === f.key} label={f.label} onPress={() => patchEl({ field: f.key })} />
                  ))}
                </View>
                <Text style={s.mini}>Prefix</Text>
                <TextInput style={s.input} value={sel.prefix} onChangeText={v => patchEl({ prefix: v })} />
              </>
            )}
            {sel.kind === 'qr' && (
              <>
                <Text style={s.mini}>QR encodes</Text>
                <View style={s.rowWrap}>
                  {FIELD_OPTIONS.filter(f => f.group !== 'Company').map(f => (
                    <Chip key={f.key} on={sel.qrField === f.key} label={f.label} onPress={() => patchEl({ qrField: f.key })} />
                  ))}
                </View>
              </>
            )}
            {isText && (
              <>
                <View style={s.rowWrap}>
                  <Stepper label="Size (pt)" value={sel.size} step={0.5} onChange={v => patchEl({ size: clamp(v, 3, 40) })} />
                  <Chip on={sel.bold} label="Bold" onPress={() => patchEl({ bold: !sel.bold })} />
                  <Chip on={sel.italic} label="Italic" onPress={() => patchEl({ italic: !sel.italic })} />
                  <Chip on={sel.upper} label="CAPS" onPress={() => patchEl({ upper: !sel.upper })} />
                </View>
                <View style={s.rowWrap}>
                  {(['left', 'center', 'right'] as const).map(a => (
                    <Chip key={a} on={sel.align === a} label={a} onPress={() => patchEl({ align: a })} />
                  ))}
                </View>
                <Text style={s.mini}>Font</Text>
                <View style={s.rowWrap}>
                  {FONT_KEYS.map(k => (
                    <Chip key={k} on={sel.font === k} label={FONT_LABELS[k].split(' ')[0]} onPress={() => patchEl({ font: k })} />
                  ))}
                </View>
                <Text style={s.mini}>Colour</Text>
                <Swatches value={sel.color} onPick={c => patchEl({ color: c })} />
              </>
            )}
            {sel.kind === 'shape' && (
              <>
                <Text style={s.mini}>Fill</Text>
                <Swatches value={sel.fill} onPick={c => patchEl({ fill: c })} />
                <View style={s.rowWrap}>
                  {(['square', 'rounded', 'circle'] as const).map(k => (
                    <Chip key={k} on={sel.shape === k} label={k} onPress={() => patchEl({ shape: k })} />
                  ))}
                </View>
              </>
            )}
            {sel.kind === 'photo' && (
              <View style={s.rowWrap}>
                {(['square', 'rounded', 'circle'] as const).map(k => (
                  <Chip key={k} on={sel.shape === k} label={k} onPress={() => patchEl({ shape: k })} />
                ))}
              </View>
            )}

            <Text style={s.mini}>Position & size (% of card)</Text>
            <View style={s.rowWrap}>
              <Stepper label="X" value={sel.x} step={1} onChange={v => patchEl({ x: clamp(v, -20, 120) })} />
              <Stepper label="Y" value={sel.y} step={1} onChange={v => patchEl({ y: clamp(v, -20, 120) })} />
              <Stepper label="Width" value={sel.w} step={1} onChange={v => patchEl({ w: clamp(v, 1, 140) })} />
              <Stepper label="Height" value={sel.h} step={1} onChange={v => patchEl({ h: clamp(v, 1, 140) })} />
            </View>
          </View>
        ) : (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Card</Text>
            <Text style={s.mini}>Size</Text>
            <View style={s.rowWrap}>
              {SIZE_OPTIONS.filter(o => o.key !== 'custom').map(o => (
                <Chip
                  key={o.key}
                  on={template.size === o.key}
                  label={o.key === 'cr80-portrait' ? 'Portrait' : 'Landscape'}
                  onPress={() => commit({ ...template, size: o.key })}
                />
              ))}
            </View>
            <View style={s.switchRow}>
              <Text style={s.body}>Print a back side</Text>
              <Switch
                value={template.backEnabled}
                onValueChange={v => {
                  commit({ ...template, backEnabled: v });
                  if (!v) setSide('front');
                }}
              />
            </View>
            <Text style={s.mini}>{side === 'front' ? 'Front' : 'Back'} background</Text>
            <Swatches value={cur.bg} onPick={c => setSideData({ bg: c, bg2: '' })} />
          </View>
        )}

        {/* layers */}
        <View style={s.panel}>
          <Text style={s.panelTitle}>Elements ({cur.elements.length})</Text>
          {cur.elements.map(e => (
            <View key={e.id} style={[s.layer, e.id === selId && { backgroundColor: '#044bab14' }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelId(e.id)}>
                <Text style={s.layerText} numberOfLines={1}>
                  {KIND_LABELS[e.kind]}
                  {e.kind === 'text' ? ` · ${e.text}` : e.kind === 'field' ? ` · ${e.field}` : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => move(e.id, 1)}>
                <ArrowUp size={14} color={C.black} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => move(e.id, -1)}>
                <ArrowDown size={14} color={C.black} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() =>
                  setSideData({
                    elements: cur.elements.map(x => (x.id === e.id ? { ...x, visible: !x.visible } : x)),
                  })
                }
              >
                {e.visible ? <Eye size={14} color={C.black} /> : <EyeOff size={14} color={C.textLight} />}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* add element */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setAddOpen(false)}>
          <View style={s.menu}>
            {ADDABLE.map(k => (
              <TouchableOpacity key={k} style={s.menuItem} onPress={() => addEl(k)}>
                <Text style={s.body}>{KIND_LABELS[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* template library */}
      <Modal visible={libOpen} animationType="slide" onRequestClose={() => setLibOpen(false)}>
        <SafeAreaView style={s.safe}>
          <View style={s.header}>
            <Text style={[s.title, { marginLeft: 8 }]}>Template library</Text>
            <TouchableOpacity onPress={() => setLibOpen(false)} style={{ padding: 6 }}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Text style={s.hint}>
              Pick a layout and a colour theme. You can change everything afterwards, and undo it.
            </Text>
            <View style={s.rowWrap}>
              {PALETTES.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPalette(p)}
                  style={[s.pal, palette.id === p.id && { borderColor: C.primary, borderWidth: 3 }]}
                >
                  <View style={{ backgroundColor: p.primary, flex: 1 }} />
                  <View style={{ backgroundColor: p.accent, flex: 1 }} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.mini}>{palette.name}</Text>
            <View style={s.rowWrap}>
              {libItems.map(it => (
                <TouchableOpacity
                  key={it.id}
                  style={s.libCard}
                  onPress={() => {
                    commit(it.t);
                    setSide('front');
                    setSelId(null);
                    setLibOpen(false);
                  }}
                >
                  <IdCardView
                    template={it.t}
                    side="front"
                    employee={SAMPLE}
                    company={company}
                    width={it.orientation === 'portrait' ? 100 : 150}
                  />
                  <Text style={s.layerText}>{it.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderColor: '#000',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: C.black },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
  chip: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  chipOn: { backgroundColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: C.black, textTransform: 'capitalize' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 2, borderColor: '#000', paddingHorizontal: 10, paddingVertical: 5 },
  toolText: { fontSize: 12, fontWeight: '700', color: C.primary },
  preview: { alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#000', padding: 16, gap: 8 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 4 },
  hint: { fontSize: 12, color: C.textLight },
  panel: { borderWidth: 2, borderColor: '#000', padding: 12, gap: 10 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  panelTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.black },
  mini: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: C.black },
  body: { fontSize: 14, color: C.black },
  input: { borderWidth: 2, borderColor: '#000', paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: C.black },
  stepper: { minWidth: 92, gap: 3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#000' },
  stepBtn: { padding: 7 },
  stepVal: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: C.black },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderWidth: 1, borderColor: '#0006' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  layer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 4 },
  layerText: { fontSize: 13, color: C.black },
  iconBtn: { padding: 7, borderWidth: 1, borderColor: '#0003' },
  err: { color: C.danger, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 32 },
  menu: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' },
  menuItem: { padding: 14, borderBottomWidth: 1, borderColor: '#0002' },
  pal: { width: 44, height: 28, flexDirection: 'row', borderWidth: 1, borderColor: '#0006' },
  libCard: { gap: 4, alignItems: 'center', padding: 6, borderWidth: 1, borderColor: '#0003' },
});
