import React from 'react';
import { Zap } from 'lucide-react-native';
import { CollapsibleSection, ToggleRow } from '../../ui';

export interface AutomationData {
  notifications?: boolean;
  onlinePayments?: boolean;
  autoPublishResults?: boolean;
  qrCheckIn?: boolean;
  attendanceTracking?: boolean;
  liveUpdates?: boolean;
  certificates?: boolean;
}

export default function AutomationSection({
  value,
  onChange,
}: {
  value: AutomationData;
  onChange: (v: AutomationData) => void;
}) {
  const set = (key: keyof AutomationData, v: boolean) =>
    onChange({ ...value, [key]: v });

  return (
    <CollapsibleSection title="Automation" icon={Zap}>
      <ToggleRow
        label="Notifications"
        sub="Send registration & update notifications"
        value={!!value.notifications}
        onChange={v => set('notifications', v)}
      />
      <ToggleRow
        label="Online Payments"
        sub="Gates fee-collection UI"
        value={!!value.onlinePayments}
        onChange={v => set('onlinePayments', v)}
      />
      <ToggleRow
        label="Auto-publish Results"
        sub="Marks event completed once all fixtures finish"
        value={!!value.autoPublishResults}
        onChange={v => set('autoPublishResults', v)}
      />
      <ToggleRow
        label="QR Check-in"
        value={!!value.qrCheckIn}
        onChange={v => set('qrCheckIn', v)}
      />
      <ToggleRow
        label="Attendance Tracking"
        value={!!value.attendanceTracking}
        onChange={v => set('attendanceTracking', v)}
      />
      <ToggleRow
        label="Live Updates"
        value={!!value.liveUpdates}
        onChange={v => set('liveUpdates', v)}
      />
      <ToggleRow
        label="Certificates"
        value={!!value.certificates}
        onChange={v => set('certificates', v)}
      />
    </CollapsibleSection>
  );
}
