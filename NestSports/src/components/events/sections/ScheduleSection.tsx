import React from 'react';
import { CalendarClock } from 'lucide-react-native';
import { CollapsibleSection, DateTimeField } from '../../ui';

export interface ScheduleData {
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  checkInTime?: string;
  openingCeremonyTime?: string;
  closingCeremonyTime?: string;
}

export default function ScheduleSection({
  value,
  onChange,
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
}: {
  value: ScheduleData;
  onChange: (v: ScheduleData) => void;
  startDate: string;
  endDate: string;
  onChangeStartDate: (v: string) => void;
  onChangeEndDate: (v: string) => void;
}) {
  const set = (key: keyof ScheduleData, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Schedule" icon={CalendarClock}>
      <DateTimeField
        label="Start Date"
        mode="date"
        value={startDate}
        onChangeText={onChangeStartDate}
      />
      <DateTimeField
        label="End Date"
        mode="date"
        value={endDate}
        onChangeText={onChangeEndDate}
      />
      <DateTimeField
        label="Event Date"
        mode="date"
        value={value.eventDate || ''}
        onChangeText={t => set('eventDate', t)}
      />
      <DateTimeField
        label="Start Time"
        mode="time"
        value={value.startTime || ''}
        onChangeText={t => set('startTime', t)}
      />
      <DateTimeField
        label="End Time"
        mode="time"
        value={value.endTime || ''}
        onChangeText={t => set('endTime', t)}
      />
      <DateTimeField
        label="Check-in Time"
        mode="time"
        value={value.checkInTime || ''}
        onChangeText={t => set('checkInTime', t)}
      />
      <DateTimeField
        label="Registration Opens"
        mode="date"
        value={value.registrationOpensAt || ''}
        onChangeText={t => set('registrationOpensAt', t)}
      />
      <DateTimeField
        label="Registration Closes"
        mode="date"
        value={value.registrationClosesAt || ''}
        onChangeText={t => set('registrationClosesAt', t)}
      />
      <DateTimeField
        label="Opening Ceremony Time"
        mode="time"
        value={value.openingCeremonyTime || ''}
        onChangeText={t => set('openingCeremonyTime', t)}
      />
      <DateTimeField
        label="Closing Ceremony Time"
        mode="time"
        value={value.closingCeremonyTime || ''}
        onChangeText={t => set('closingCeremonyTime', t)}
      />
    </CollapsibleSection>
  );
}
