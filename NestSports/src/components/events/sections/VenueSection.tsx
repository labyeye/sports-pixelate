import React from 'react';
import { MapPin } from 'lucide-react-native';
import { CollapsibleSection, TextField, ChipSelect } from '../../ui';

export interface VenueData {
  name?: string;
  hallGroundCourtStage?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  mapsUrl?: string;
  indoorOutdoor?: 'indoor' | 'outdoor' | '';
}

const INDOOR_OUTDOOR = ['indoor', 'outdoor'] as const;

export default function VenueSection({
  value,
  onChange,
}: {
  value: VenueData;
  onChange: (v: VenueData) => void;
}) {
  const set = (key: keyof VenueData, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Venue" icon={MapPin}>
      <TextField
        label="Venue Name"
        value={value.name || ''}
        onChangeText={t => set('name', t)}
        placeholder="e.g. City Sports Complex"
      />
      <TextField
        label="Hall / Ground / Court / Stage"
        value={value.hallGroundCourtStage || ''}
        onChangeText={t => set('hallGroundCourtStage', t)}
        placeholder="e.g. Court 2"
      />
      <TextField
        label="Address"
        value={value.address || ''}
        onChangeText={t => set('address', t)}
        multiline
      />
      <TextField
        label="City"
        value={value.city || ''}
        onChangeText={t => set('city', t)}
      />
      <TextField
        label="State"
        value={value.state || ''}
        onChangeText={t => set('state', t)}
      />
      <TextField
        label="Pincode"
        value={value.pincode || ''}
        onChangeText={t => set('pincode', t)}
        keyboardType="numeric"
      />
      <TextField
        label="Maps URL"
        value={value.mapsUrl || ''}
        onChangeText={t => set('mapsUrl', t)}
        placeholder="https://maps.google.com/..."
      />
      <ChipSelect
        label="Indoor / Outdoor"
        options={INDOOR_OUTDOOR}
        value={(value.indoorOutdoor || 'indoor') as any}
        onChange={v => set('indoorOutdoor', v)}
      />
    </CollapsibleSection>
  );
}
