import React from 'react';
import { Tags } from 'lucide-react-native';
import { CollapsibleSection, TextField } from '../../ui';

export interface CategoriesData {
  ageCategory?: string[];
  gender?: string[];
  skillLevel?: string[];
  division?: string[];
}

// Flexible [String] arrays on the backend (not rigid enums, so "Custom"
// values pass) — edited here as comma-separated text, matching the
// existing app's convention of avoiding heavier multi-select UI on mobile.
function toCsv(arr?: string[]): string {
  return (arr || []).join(', ');
}
function fromCsv(text: string): string[] {
  return text
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export default function CategoriesSection({
  value,
  onChange,
}: {
  value: CategoriesData;
  onChange: (v: CategoriesData) => void;
}) {
  const set = (key: keyof CategoriesData, csv: string) =>
    onChange({ ...value, [key]: fromCsv(csv) });

  return (
    <CollapsibleSection title="Categories" icon={Tags}>
      <TextField
        label="Age Category"
        value={toCsv(value.ageCategory)}
        onChangeText={t => set('ageCategory', t)}
        placeholder="e.g. U-12, U-16, Open (comma separated)"
      />
      <TextField
        label="Gender"
        value={toCsv(value.gender)}
        onChangeText={t => set('gender', t)}
        placeholder="e.g. Male, Female, Mixed"
      />
      <TextField
        label="Skill Level"
        value={toCsv(value.skillLevel)}
        onChangeText={t => set('skillLevel', t)}
        placeholder="e.g. Beginner, Intermediate, Advanced"
      />
      <TextField
        label="Division"
        value={toCsv(value.division)}
        onChangeText={t => set('division', t)}
        placeholder="e.g. Division A, Division B"
      />
    </CollapsibleSection>
  );
}
