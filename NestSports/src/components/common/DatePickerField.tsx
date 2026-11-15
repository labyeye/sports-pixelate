import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { C } from '../../theme';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Reusable up/down spinner column
function SpinCol({
  label,
  value,
  min,
  max,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const inc = () => onChange(value >= max ? min : value + 1);
  const dec = () => onChange(value <= min ? max : value - 1);
  return (
    <View style={s.col}>
      <TouchableOpacity
        onPress={inc}
        style={s.arrow}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronUp size={24} color={C.primary} />
      </TouchableOpacity>
      <View style={s.valBox}>
        <Text style={s.valText}>
          {format ? format(value) : String(value).padStart(2, '0')}
        </Text>
      </View>
      <TouchableOpacity
        onPress={dec}
        style={s.arrow}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronDown size={24} color={C.primary} />
      </TouchableOpacity>
      <Text style={s.colLabel}>{label}</Text>
    </View>
  );
}

// ─── DATE PICKER ────────────────────────────────────────────────────────────────

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  required?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
}

export function DatePickerField({
  label,
  value,
  onChange,
}: DatePickerFieldProps) {
  const now = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : now;
  const isValid = !!value && !isNaN(parsed.getTime());

  const [show, setShow] = useState(false);
  const [day, setDay] = useState(isValid ? parsed.getDate() : now.getDate());
  const [month, setMonth] = useState(
    isValid ? parsed.getMonth() + 1 : now.getMonth() + 1,
  );
  const [year, setYear] = useState(
    isValid ? parsed.getFullYear() : now.getFullYear(),
  );

  const openPicker = () => {
    const d = isValid ? parsed : now;
    setDay(d.getDate());
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setShow(true);
  };

  const handleDone = () => {
    const maxDay = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    const str = `${year}-${String(month).padStart(2, '0')}-${String(
      safeDay,
    ).padStart(2, '0')}`;
    onChange(str);
    setShow(false);
  };

  const displayValue = isValid
    ? parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : `Select ${label.replace(' *', '')}`;

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={s.input}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !isValid && s.placeholder]}>
          {displayValue}
        </Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.sheetTitle}>{label.replace(' *', '')}</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={s.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={s.spinRow}>
              <SpinCol
                label="Day"
                value={day}
                min={1}
                max={new Date(year, month, 0).getDate()}
                onChange={setDay}
              />
              <View style={s.sep} />
              <SpinCol
                label="Month"
                value={month}
                min={1}
                max={12}
                onChange={setMonth}
                format={v => MONTHS[v - 1]}
              />
              <View style={s.sep} />
              <SpinCol
                label="Year"
                value={year}
                min={1950}
                max={2100}
                onChange={setYear}
                format={v => String(v)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── TIME PICKER ────────────────────────────────────────────────────────────────

interface TimePickerFieldProps {
  label: string;
  value: string; // HH:MM
  onChange: (val: string) => void;
}

export function TimePickerField({
  label,
  value,
  onChange,
}: TimePickerFieldProps) {
  const parts = (value || '09:00').split(':').map(Number);
  const [show, setShow] = useState(false);
  const [hour, setHour] = useState(parts[0] || 9);
  const [minute, setMinute] = useState(parts[1] || 0);

  const openPicker = () => {
    const p = (value || '09:00').split(':').map(Number);
    setHour(p[0] || 9);
    setMinute(p[1] || 0);
    setShow(true);
  };

  const handleDone = () => {
    onChange(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );
    setShow(false);
  };

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={s.input}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <Text style={[s.inputText, !value && s.placeholder]}>
          {value || `Select ${label.replace(' *', '')}`}
        </Text>
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.sheetTitle}>{label.replace(' *', '')}</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={s.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={s.spinRow}>
              <SpinCol
                label="Hour"
                value={hour}
                min={0}
                max={23}
                onChange={setHour}
              />
              <View style={s.timeSep}>
                <Text style={s.timeColon}>:</Text>
              </View>
              <SpinCol
                label="Minute"
                value={minute}
                min={0}
                max={59}
                onChange={setMinute}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  inputText: {
    fontSize: 14,
    color: C.black,
    fontWeight: '400',
  },
  placeholder: {
    color: C.textLight,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingBottom: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: C.black,
  },
  cancelText: {
    fontSize: 15,
    color: C.textMuted,
    fontWeight: '400',
  },
  doneText: {
    fontSize: 15,
    color: C.primary,
    fontWeight: '400',
  },
  spinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    padding: 6,
  },
  valBox: {
    borderWidth: 2,
    borderColor: C.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    minWidth: 72,
    alignItems: 'center',
  },
  valText: {
    fontSize: 22,
    fontWeight: '400',
    color: C.primary,
  },
  colLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textMuted,
  },
  sep: {
    width: 1,
    height: 100,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  timeSep: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  timeColon: {
    fontSize: 32,
    fontWeight: '400',
    color: C.black,
    marginBottom: 24,
  },
});
