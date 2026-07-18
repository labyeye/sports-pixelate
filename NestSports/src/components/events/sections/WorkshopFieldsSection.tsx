import React from 'react';
import { GraduationCap } from 'lucide-react-native';
import { CollapsibleSection, TextField, ToggleRow } from '../../ui';

export interface WorkshopFieldsData {
  instructor?: string;
  maxSeats?: string | number;
  sessionDurationMinutes?: string | number;
  materialsRequired?: string;
  certificateAvailable?: boolean;
}

export default function WorkshopFieldsSection({
  value,
  onChange,
}: {
  value: WorkshopFieldsData;
  onChange: (v: WorkshopFieldsData) => void;
}) {
  const set = (key: keyof WorkshopFieldsData, v: any) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Workshop Details" icon={GraduationCap}>
      <TextField
        label="Instructor"
        value={value.instructor || ''}
        onChangeText={t => set('instructor', t)}
      />
      <TextField
        label="Max Seats"
        value={String(value.maxSeats ?? '')}
        onChangeText={t => set('maxSeats', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Session Duration (minutes)"
        value={String(value.sessionDurationMinutes ?? '')}
        onChangeText={t => set('sessionDurationMinutes', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Materials Required"
        value={value.materialsRequired || ''}
        onChangeText={t => set('materialsRequired', t)}
        multiline
      />
      <ToggleRow
        label="Certificate Available"
        value={!!value.certificateAvailable}
        onChange={v => set('certificateAvailable', v)}
      />
    </CollapsibleSection>
  );
}
