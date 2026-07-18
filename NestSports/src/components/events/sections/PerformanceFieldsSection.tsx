import React from 'react';
import { Mic2 } from 'lucide-react-native';
import { CollapsibleSection, TextField, DateTimeField, ToggleRow } from '../../ui';

export interface PerformanceFieldsData {
  performanceOrder?: string | number;
  greenRoomRequired?: boolean;
  soundCheckTime?: string;
  lightingNotes?: string;
  stageManager?: string;
}

export default function PerformanceFieldsSection({
  value,
  onChange,
}: {
  value: PerformanceFieldsData;
  onChange: (v: PerformanceFieldsData) => void;
}) {
  const set = (key: keyof PerformanceFieldsData, v: any) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Performance Details" icon={Mic2}>
      <TextField
        label="Performance Order"
        value={String(value.performanceOrder ?? '')}
        onChangeText={t => set('performanceOrder', t)}
        keyboardType="numeric"
      />
      <DateTimeField
        label="Sound Check Time"
        mode="time"
        value={value.soundCheckTime || ''}
        onChangeText={t => set('soundCheckTime', t)}
      />
      <TextField
        label="Lighting Notes"
        value={value.lightingNotes || ''}
        onChangeText={t => set('lightingNotes', t)}
        multiline
      />
      <TextField
        label="Stage Manager"
        value={value.stageManager || ''}
        onChangeText={t => set('stageManager', t)}
      />
      <ToggleRow
        label="Green Room Required"
        value={!!value.greenRoomRequired}
        onChange={v => set('greenRoomRequired', v)}
      />
    </CollapsibleSection>
  );
}
