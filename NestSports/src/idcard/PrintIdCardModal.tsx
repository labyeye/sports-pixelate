import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Printer, X } from 'lucide-react-native';
import { C } from '../theme';
import IdCardView from './IdCardView';
import { loadIdCardSetup } from './data';
import { printIdCards } from './printHtml';
import type { IdCardTemplate, IdCompany } from './idCard';

/** "Print ID card(s)" for one or more employees, using the design saved in the ID Card Designer. */
export default function PrintIdCardModal({
  employees,
  onClose,
}: {
  employees: any[] | null;
  onClose: () => void;
}) {
  const [setup, setSetup] = useState<{
    template: IdCardTemplate;
    company: IdCompany;
    saved: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [sides, setSides] = useState<'front' | 'both'>('both');
  const [busy, setBusy] = useState(false);
  const open = !!employees && employees.length > 0;

  useEffect(() => {
    if (!open) return;
    setSetup(null);
    setError('');
    loadIdCardSetup()
      .then(s => {
        setSetup(s);
        setSides(s.template.backEnabled ? 'both' : 'front');
      })
      .catch(e => setError(e?.message || 'Could not load the ID card design'));
  }, [open]);

  const print = async () => {
    if (!setup || !employees) return;
    setBusy(true);
    try {
      await printIdCards(employees, setup.template, setup.company, sides);
      onClose();
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) Alert.alert('Print failed', e.message);
    }
    setBusy(false);
  };

  const first = employees?.[0];
  const Choice = ({ on, label, sub, onPress, disabled }: any) => (
    <TouchableOpacity
      style={[s.choice, on && s.choiceOn, disabled && { opacity: 0.4 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[s.choiceText, on && { color: '#fff' }]}>{label}</Text>
      {!!sub && <Text style={[s.choiceSub, on && { color: '#fff' }]}>{sub}</Text>}
    </TouchableOpacity>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Printer size={20} color={C.primary} />
            <Text style={s.title}>
              Print ID card{(employees?.length || 0) > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={22} color={C.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {!setup && !error && <ActivityIndicator color={C.primary} style={{ margin: 30 }} />}
            {!!error && <Text style={s.err}>{error}</Text>}
            {setup && first && (
              <>
                <Text style={s.body}>
                  <Text style={{ fontWeight: '700' }}>{employees!.length}</Text> employee
                  {employees!.length > 1 ? 's' : ''}:{' '}
                  {employees!
                    .slice(0, 3)
                    .map(e => `${e.firstName} ${e.lastName}`)
                    .join(', ')}
                  {employees!.length > 3 ? '…' : ''}
                </Text>
                {!setup.saved && (
                  <Text style={s.note}>
                    No design saved yet, so the default one is used. Customise it in Manage → ID Card
                    Designer.
                  </Text>
                )}
                <View style={s.preview}>
                  <IdCardView
                    template={setup.template}
                    side="front"
                    employee={first}
                    company={setup.company}
                    width={setup.template.size === 'cr80-portrait' ? 150 : 260}
                  />
                </View>
                <Text style={s.label}>Sides</Text>
                <View style={s.row}>
                  <Choice on={sides === 'front'} label="Front only" onPress={() => setSides('front')} />
                  <Choice
                    on={sides === 'both'}
                    label="Front & back"
                    disabled={!setup.template.backEnabled}
                    onPress={() => setSides('both')}
                  />
                </View>
                <Text style={s.note}>
                  Prints on A4 sheets with cut lines. Choose “Save as PDF” in the print dialog to
                  export instead.
                </Text>
              </>
            )}
          </ScrollView>
          <View style={[s.row, { padding: 16, paddingTop: 0 }]}>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: C.primary }, (!setup || busy) && { opacity: 0.5 }]}
              onPress={print}
              disabled={!setup || busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Print</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#fff' }]} onPress={onClose}>
              <Text style={[s.btnText, { color: C.black }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', maxHeight: '90%' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 2,
    borderColor: '#000',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: C.black },
  body: { fontSize: 14, color: C.black },
  note: { fontSize: 12, color: C.textLight },
  err: { color: C.danger, fontWeight: '700', fontSize: 13 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: C.black },
  preview: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderWidth: 1,
    borderColor: '#0001',
  },
  row: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderWidth: 2, borderColor: '#000', padding: 10, backgroundColor: '#fff' },
  choiceOn: { backgroundColor: C.primary },
  choiceText: { fontWeight: '700', fontSize: 13, color: C.black },
  choiceSub: { fontSize: 11, color: C.black },
  btn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#000',
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
