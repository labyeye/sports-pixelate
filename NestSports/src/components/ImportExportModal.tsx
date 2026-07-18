import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { FileSpreadsheet, Download, Upload, X } from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';
import {
  pickAndParseExcelFile,
  shareImportTemplate,
  type ImportHeader,
} from '../utils/excelImportExport';

export type { ImportHeader };

interface ImportResult {
  imported: number;
  failed: number;
  results: { row: number; status: 'success' | 'error'; message?: string }[];
}

interface ImportExportModalProps {
  visible: boolean;
  onClose: () => void;
  entityLabel: string; // singular, e.g. "Employee", "Student"
  headers: ImportHeader[];
  templateFilename: string;
  notes?: string[];
  previewLine: (row: Record<string, string>) => string;
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onImported?: () => void;
}

// Generic 3-step (guide → preview → result) Excel import modal for mobile,
// mirroring the web app's ImportExportModal (frontend/src/components).
export function ImportExportModal({
  visible,
  onClose,
  entityLabel,
  headers,
  templateFilename,
  notes,
  previewLine,
  onImport,
  onImported,
}: ImportExportModalProps) {
  const [step, setStep] = useState<'guide' | 'preview' | 'result'>('guide');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const close = () => {
    onClose();
    setStep('guide');
    setRows([]);
    setResult(null);
  };

  const handlePick = async () => {
    setPicking(true);
    try {
      const parsed = await pickAndParseExcelFile(headers);
      if (parsed === null) return; // user cancelled
      if (parsed.length === 0) {
        Alert.alert('Empty file', 'That sheet has no data rows.');
        return;
      }
      setRows(parsed);
      setStep('preview');
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED' && err?.code !== 'OPERATION_CANCELED') {
        Alert.alert('Could not read file', err?.message || 'Please try a valid .xlsx/.xls file.');
      }
    } finally {
      setPicking(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      setStep('result');
      if (res.imported > 0) onImported?.();
    } catch (err: any) {
      Alert.alert('Import failed', err?.message || 'Something went wrong.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <FileSpreadsheet size={18} color={colors.blue} strokeWidth={2.5} />
              <Text style={styles.headerTitle}>
                {step === 'guide' && `Import ${entityLabel}s via Excel`}
                {step === 'preview' &&
                  `Preview — ${rows.length} row${rows.length !== 1 ? 's' : ''}`}
                {step === 'result' && 'Import Complete'}
              </Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <X size={20} color={colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
            {step === 'guide' && (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Download the template, fill it in, then pick the file to
                    import {entityLabel.toLowerCase()}s in bulk.
                  </Text>
                </View>
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Column</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Required</Text>
                  </View>
                  {headers.map(h => (
                    <View key={h.key} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 2, fontWeight: '700' }]}>
                        {h.label}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          { flex: 1, color: h.required ? colors.red : colors.muted, fontWeight: '700' },
                        ]}
                      >
                        {h.required ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  ))}
                </View>
                {notes && notes.length > 0 && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesTitle}>Notes:</Text>
                    {notes.map((n, i) => (
                      <Text key={i} style={styles.notesText}>
                        • {n}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}

            {step === 'preview' && (
              <>
                {rows.length === 0 ? (
                  <Text style={styles.emptyText}>No data rows found in the file.</Text>
                ) : (
                  rows.map((r, i) => (
                    <View key={i} style={styles.previewRow}>
                      <Text style={styles.previewIndex}>{i + 1}</Text>
                      <Text style={styles.previewLine}>{previewLine(r)}</Text>
                    </View>
                  ))
                )}
              </>
            )}

            {step === 'result' && result && (
              <>
                <View style={styles.resultRow}>
                  <View style={[styles.resultTile, { borderColor: colors.green, backgroundColor: `${colors.green}1A` }]}>
                    <Text style={[styles.resultCount, { color: colors.green }]}>
                      {result.imported}
                    </Text>
                    <Text style={[styles.resultLabel, { color: colors.green }]}>Imported</Text>
                  </View>
                  <View style={[styles.resultTile, { borderColor: colors.red, backgroundColor: `${colors.red}1A` }]}>
                    <Text style={[styles.resultCount, { color: colors.red }]}>
                      {result.failed}
                    </Text>
                    <Text style={[styles.resultLabel, { color: colors.red }]}>Failed</Text>
                  </View>
                </View>
                {result.failed > 0 && (
                  <View style={styles.table}>
                    <View style={[styles.tableHeaderRow, { backgroundColor: colors.red }]}>
                      <Text style={[styles.tableHeaderCell, { color: colors.white }]}>
                        Failed Rows
                      </Text>
                    </View>
                    {result.results
                      .filter(r => r.status === 'error')
                      .map(r => (
                        <View key={r.row} style={styles.tableRow}>
                          <Text style={styles.previewLine}>
                            <Text style={{ fontWeight: '700', color: colors.red }}>
                              Row {r.row}:{' '}
                            </Text>
                            {r.message}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step === 'guide' && (
              <>
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => shareImportTemplate(headers, templateFilename)}
                >
                  <Download size={16} color={colors.black} strokeWidth={2.5} />
                  <Text style={styles.outlineBtnText}>Template</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.solidBtn}
                  onPress={handlePick}
                  disabled={picking}
                >
                  {picking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Upload size={16} color={colors.white} strokeWidth={2.5} />
                      <Text style={styles.solidBtnText}>Choose File</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === 'preview' && (
              <>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setStep('guide')}>
                  <Text style={styles.outlineBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.solidBtn, { flex: 1 }]}
                  onPress={handleImport}
                  disabled={importing || rows.length === 0}
                >
                  {importing ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.solidBtnText}>
                      Import {rows.length} {entityLabel}
                      {rows.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === 'result' && (
              <TouchableOpacity style={[styles.solidBtn, { flex: 1 }]} onPress={close}>
                <Text style={styles.solidBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderColor: colors.black,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.black, fontFamily: FONT.bold, flexShrink: 1 },
  body: { flexGrow: 0 },
  infoBox: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.blue,
    padding: 12,
    marginBottom: 14,
  },
  infoText: { fontSize: 13, color: colors.blue, fontWeight: '500', fontFamily: FONT.medium },
  table: { borderWidth: 2, borderColor: colors.black, marginBottom: 14 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: colors.white, textTransform: 'uppercase', fontFamily: FONT.bold },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  tableCell: { fontSize: 13, color: colors.black, fontFamily: FONT.regular },
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 10,
  },
  notesTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4, fontFamily: FONT.bold },
  notesText: { fontSize: 11, color: '#92400E', marginBottom: 2, fontFamily: FONT.regular },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 24, fontFamily: FONT.regular },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  previewIndex: { fontSize: 12, color: colors.muted, width: 20, fontFamily: FONT.regular },
  previewLine: { fontSize: 13, color: colors.black, flex: 1, fontFamily: FONT.regular },
  resultRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  resultTile: { flex: 1, borderWidth: 2, padding: 16, alignItems: 'center' },
  resultCount: { fontSize: 28, fontWeight: '700', fontFamily: FONT.bold },
  resultLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, fontFamily: FONT.bold },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: colors.black,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', color: colors.black, fontFamily: FONT.bold },
  solidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  solidBtnText: { fontSize: 13, fontWeight: '700', color: colors.white, fontFamily: FONT.bold },
});
