import React from 'react';
import { GraduationCap } from 'lucide-react-native';
import { PickerField } from '../ui';

interface ChildLike {
  _id: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
}

const ALL = 'All children';

// Dropdown a parent uses to pick which of their children in this academy a
// screen should show. Renders nothing for a single child — nothing to choose.
// `allowAll` adds an "All children" entry, reported as an empty id.
export function ChildSelect({
  children,
  value,
  onChange,
  allowAll,
}: {
  children: ChildLike[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  if (children.length < 2) return null;

  const base = (c: ChildLike) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Student';
  // Twins can share a name — tell them apart by student ID.
  const labelOf = (c: ChildLike) =>
    children.filter(o => base(o) === base(c)).length > 1 && c.studentId
      ? `${base(c)} (${c.studentId})`
      : base(c);

  const byLabel = new Map(children.map(c => [labelOf(c), c._id]));
  const current = children.find(c => c._id === value);

  return (
    <PickerField
      label="Child"
      icon={GraduationCap}
      value={current ? labelOf(current) : allowAll ? ALL : ''}
      options={[...(allowAll ? [ALL] : []), ...byLabel.keys()]}
      onChange={label => onChange(label === ALL ? '' : byLabel.get(label) || '')}
    />
  );
}
