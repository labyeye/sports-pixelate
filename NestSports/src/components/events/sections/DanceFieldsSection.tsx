import React from 'react';
import { Music } from 'lucide-react-native';
import { CollapsibleSection, TextField, ChipSelect, ToggleRow } from '../../ui';

export interface DanceFieldsData {
  danceStyle?: string;
  performanceMode?: 'solo' | 'duo' | 'group' | '';
  performanceDurationMinutes?: string | number;
  musicUploadUrl?: string;
  theme?: string;
  propsAllowed?: boolean;
  costumeGuidelines?: string;
  judgingCriteria?: string[];
  performanceOrder?: string | number;
  stageDimensions?: string;
  maxPerformers?: string | number;
  minPerformers?: string | number;
}

const MODES = ['solo', 'duo', 'group'] as const;

function toCsv(arr?: string[]): string {
  return (arr || []).join(', ');
}
function fromCsv(text: string): string[] {
  return text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function DanceFieldsSection({
  value,
  onChange,
}: {
  value: DanceFieldsData;
  onChange: (v: DanceFieldsData) => void;
}) {
  const set = (key: keyof DanceFieldsData, v: any) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Dance Details" icon={Music}>
      <TextField
        label="Dance Style"
        value={value.danceStyle || ''}
        onChangeText={t => set('danceStyle', t)}
      />
      <ChipSelect
        label="Performance Mode"
        options={MODES}
        value={(value.performanceMode || 'solo') as any}
        onChange={v => set('performanceMode', v)}
      />
      <TextField
        label="Performance Duration (minutes)"
        value={String(value.performanceDurationMinutes ?? '')}
        onChangeText={t => set('performanceDurationMinutes', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Music Upload URL"
        value={value.musicUploadUrl || ''}
        onChangeText={t => set('musicUploadUrl', t)}
      />
      <TextField
        label="Theme"
        value={value.theme || ''}
        onChangeText={t => set('theme', t)}
      />
      <TextField
        label="Costume Guidelines"
        value={value.costumeGuidelines || ''}
        onChangeText={t => set('costumeGuidelines', t)}
        multiline
      />
      <TextField
        label="Judging Criteria"
        value={toCsv(value.judgingCriteria)}
        onChangeText={t => set('judgingCriteria', fromCsv(t))}
        placeholder="e.g. Technique, Expression (comma separated)"
      />
      <TextField
        label="Stage Dimensions"
        value={value.stageDimensions || ''}
        onChangeText={t => set('stageDimensions', t)}
      />
      <TextField
        label="Min Performers"
        value={String(value.minPerformers ?? '')}
        onChangeText={t => set('minPerformers', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Max Performers"
        value={String(value.maxPerformers ?? '')}
        onChangeText={t => set('maxPerformers', t)}
        keyboardType="numeric"
      />
      <ToggleRow
        label="Props Allowed"
        value={!!value.propsAllowed}
        onChange={v => set('propsAllowed', v)}
      />
    </CollapsibleSection>
  );
}
