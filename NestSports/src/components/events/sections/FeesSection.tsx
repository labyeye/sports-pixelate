import React from 'react';
import { IndianRupee } from 'lucide-react-native';
import { CollapsibleSection, TextField, DateTimeField, ToggleRow } from '../../ui';

export interface FeesData {
  currency?: string;
  earlyBirdDiscount?: string | number;
  earlyBirdDeadline?: string;
  lateRegistrationFee?: string | number;
  registrationDeadline?: string;
  onlinePaymentEnabled?: boolean;
}

export default function FeesSection({
  entryFee,
  onChangeEntryFee,
  value,
  onChange,
}: {
  entryFee: string;
  onChangeEntryFee: (v: string) => void;
  value: FeesData;
  onChange: (v: FeesData) => void;
}) {
  const set = (key: keyof FeesData, v: any) => onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Fees" icon={IndianRupee}>
      <TextField
        label="Entry Fee"
        value={entryFee}
        onChangeText={onChangeEntryFee}
        keyboardType="numeric"
        placeholder="0"
      />
      <TextField
        label="Currency"
        value={value.currency || 'INR'}
        onChangeText={t => set('currency', t)}
      />
      <TextField
        label="Early Bird Discount"
        value={String(value.earlyBirdDiscount ?? '')}
        onChangeText={t => set('earlyBirdDiscount', t)}
        keyboardType="numeric"
      />
      <DateTimeField
        label="Early Bird Deadline"
        mode="date"
        value={value.earlyBirdDeadline || ''}
        onChangeText={t => set('earlyBirdDeadline', t)}
      />
      <TextField
        label="Late Registration Fee"
        value={String(value.lateRegistrationFee ?? '')}
        onChangeText={t => set('lateRegistrationFee', t)}
        keyboardType="numeric"
      />
      <DateTimeField
        label="Registration Deadline"
        mode="date"
        value={value.registrationDeadline || ''}
        onChangeText={t => set('registrationDeadline', t)}
      />
      <ToggleRow
        label="Online Payment Enabled"
        value={!!value.onlinePaymentEnabled}
        onChange={v => set('onlinePaymentEnabled', v)}
      />
    </CollapsibleSection>
  );
}
