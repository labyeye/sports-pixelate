import React from 'react';
import { Users } from 'lucide-react-native';
import { CollapsibleSection, TextField, ChipSelect, ToggleRow } from '../../ui';

export interface ParticipationData {
  type?: 'individual' | 'team' | 'group';
  maxRegistrations?: string | number;
  minParticipants?: string | number;
  maxParticipants?: string | number;
  waitingListEnabled?: boolean;
  onlineRegistration?: boolean;
  approvalRequired?: boolean;
}

const TYPES = ['individual', 'team', 'group'] as const;

export default function ParticipationSection({
  value,
  onChange,
}: {
  value: ParticipationData;
  onChange: (v: ParticipationData) => void;
}) {
  const set = (key: keyof ParticipationData, v: any) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Participation" icon={Users}>
      <ChipSelect
        label="Participation Type"
        options={TYPES}
        value={value.type || 'team'}
        onChange={v => set('type', v)}
      />
      <TextField
        label="Max Registrations"
        value={String(value.maxRegistrations ?? '')}
        onChangeText={t => set('maxRegistrations', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Min Participants"
        value={String(value.minParticipants ?? '')}
        onChangeText={t => set('minParticipants', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Max Participants"
        value={String(value.maxParticipants ?? '')}
        onChangeText={t => set('maxParticipants', t)}
        keyboardType="numeric"
      />
      <ToggleRow
        label="Waiting List"
        value={!!value.waitingListEnabled}
        onChange={v => set('waitingListEnabled', v)}
      />
      <ToggleRow
        label="Online Registration"
        value={!!value.onlineRegistration}
        onChange={v => set('onlineRegistration', v)}
      />
      <ToggleRow
        label="Approval Required"
        value={!!value.approvalRequired}
        onChange={v => set('approvalRequired', v)}
      />
    </CollapsibleSection>
  );
}
