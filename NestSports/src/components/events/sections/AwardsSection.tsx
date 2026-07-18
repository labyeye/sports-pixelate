import React from 'react';
import { Award } from 'lucide-react-native';
import { CollapsibleSection, TextField, ToggleRow } from '../../ui';

export interface AwardsData {
  winnerPrize?: string;
  runnerUpPrize?: string;
  participationCertificate?: boolean;
  cashPrize?: string | number;
  medals?: boolean;
  trophies?: boolean;
  specialAwards?: string[];
  description?: string;
}

function toCsv(arr?: string[]): string {
  return (arr || []).join(', ');
}
function fromCsv(text: string): string[] {
  return text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function AwardsSection({
  value,
  onChange,
}: {
  value: AwardsData;
  onChange: (v: AwardsData) => void;
}) {
  const set = (key: keyof AwardsData, v: any) => onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Awards" icon={Award}>
      <TextField
        label="Winner Prize"
        value={value.winnerPrize || ''}
        onChangeText={t => set('winnerPrize', t)}
      />
      <TextField
        label="Runner-up Prize"
        value={value.runnerUpPrize || ''}
        onChangeText={t => set('runnerUpPrize', t)}
      />
      <TextField
        label="Cash Prize"
        value={String(value.cashPrize ?? '')}
        onChangeText={t => set('cashPrize', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Special Awards"
        value={toCsv(value.specialAwards)}
        onChangeText={t => set('specialAwards', fromCsv(t))}
        placeholder="e.g. Best Performer, Fair Play (comma separated)"
      />
      <TextField
        label="Description"
        value={value.description || ''}
        onChangeText={t => set('description', t)}
        multiline
      />
      <ToggleRow
        label="Participation Certificate"
        value={!!value.participationCertificate}
        onChange={v => set('participationCertificate', v)}
      />
      <ToggleRow
        label="Medals"
        value={!!value.medals}
        onChange={v => set('medals', v)}
      />
      <ToggleRow
        label="Trophies"
        value={!!value.trophies}
        onChange={v => set('trophies', v)}
      />
    </CollapsibleSection>
  );
}
