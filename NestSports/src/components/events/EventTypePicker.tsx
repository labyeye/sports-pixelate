import React from 'react';
import { ChipSelect } from '../ui';
import { eventTypes, EventTypeKey } from '../../config/eventTypeConfig';

const OPTIONS = Object.keys(eventTypes) as EventTypeKey[];
const LABELS = Object.fromEntries(
  OPTIONS.map(k => [k, eventTypes[k].label]),
) as Partial<Record<EventTypeKey, string>>;

export default function EventTypePicker({
  value,
  onChange,
}: {
  value: EventTypeKey;
  onChange: (v: EventTypeKey) => void;
}) {
  return (
    <ChipSelect
      label="Event Type"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      labels={LABELS}
    />
  );
}
