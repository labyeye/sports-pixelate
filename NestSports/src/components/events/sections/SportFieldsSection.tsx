import React from 'react';
import { Trophy } from 'lucide-react-native';
import { CollapsibleSection, TextField, ChipSelect, ToggleRow } from '../../ui';

export interface SportFieldsData {
  maxTeams?: string | number;
  groupsEnabled?: boolean;
  matchDurationMinutes?: string | number;
  extraTimeAllowed?: boolean;
  penaltyRules?: string;
  tieBreakRules?: string;
  playerLimit?: string | number;
  substitutesAllowed?: string | number;
  seedingEnabled?: boolean;
  randomDraw?: boolean;
}

const FORMATS = [
  'knockout',
  'round_robin',
  'single_elimination',
  'double_elimination',
  'league',
  'group_stage',
  'swiss',
  'best_of_series',
] as const;

// `format` stays top-level on the Event (not duplicated here) — this
// section's format chip reads/writes event.format directly to avoid two
// fields drifting, per the backend contract.
export default function SportFieldsSection({
  format,
  onChangeFormat,
  value,
  onChange,
}: {
  format: string;
  onChangeFormat: (v: string) => void;
  value: SportFieldsData;
  onChange: (v: SportFieldsData) => void;
}) {
  const set = (key: keyof SportFieldsData, v: any) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Sport Details" icon={Trophy}>
      <ChipSelect
        label="Format"
        options={FORMATS}
        value={(format || 'knockout') as any}
        onChange={onChangeFormat}
      />
      <TextField
        label="Max Teams"
        value={String(value.maxTeams ?? '')}
        onChangeText={t => set('maxTeams', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Match Duration (minutes)"
        value={String(value.matchDurationMinutes ?? '')}
        onChangeText={t => set('matchDurationMinutes', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Player Limit"
        value={String(value.playerLimit ?? '')}
        onChangeText={t => set('playerLimit', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Substitutes Allowed"
        value={String(value.substitutesAllowed ?? '')}
        onChangeText={t => set('substitutesAllowed', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Penalty Rules"
        value={value.penaltyRules || ''}
        onChangeText={t => set('penaltyRules', t)}
        multiline
      />
      <TextField
        label="Tie-break Rules"
        value={value.tieBreakRules || ''}
        onChangeText={t => set('tieBreakRules', t)}
        multiline
      />
      <ToggleRow
        label="Groups Enabled"
        value={!!value.groupsEnabled}
        onChange={v => set('groupsEnabled', v)}
      />
      <ToggleRow
        label="Extra Time Allowed"
        value={!!value.extraTimeAllowed}
        onChange={v => set('extraTimeAllowed', v)}
      />
      <ToggleRow
        label="Seeding Enabled"
        value={!!value.seedingEnabled}
        onChange={v => set('seedingEnabled', v)}
      />
      <ToggleRow
        label="Random Draw"
        value={!!value.randomDraw}
        onChange={v => set('randomDraw', v)}
      />
    </CollapsibleSection>
  );
}
