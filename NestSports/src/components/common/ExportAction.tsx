import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Download } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { headerBtn } from '../ScreenHeader';
import { exportRowsToExcel } from '../../utils/excelImportExport';

export interface ExportCol {
  header: string;
  value: (row: any) => unknown;
}

interface Props {
  /** File name without extension, e.g. "leave_requests". */
  name: string;
  cols: ExportCol[];
  rows: any[];
}

/** Download icon for a page header: exports the rows as Excel or PDF, like NestHR's ExportButton. */
export default function ExportAction({ name, cols, rows }: Props) {
  const run = () => {
    const headers = cols.map((c, i) => ({ key: `c${i}`, label: c.header }));
    const data = rows.map(r =>
      Object.fromEntries(cols.map((c, i) => [`c${i}`, c.value(r) ?? ''])),
    );
    exportRowsToExcel(headers, data, `${name}.xlsx`, name.slice(0, 31));
  };
  return (
    <TouchableOpacity
      onPress={run}
      style={headerBtn}
      hitSlop={8}
      accessibilityLabel="Export"
    >
      <Download size={20} color={colors.black} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}
