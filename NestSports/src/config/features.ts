// Optional modules the owner can switch off in Settings → Features. A disabled
// feature disappears from the menu / tab bar. Core screens (students,
// attendance, subscriptions, settings, billing) can't be disabled. Keep keys in
// sync with frontend/src/config/features.ts.
export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  screens: string[];
}

export const FEATURES: FeatureDef[] = [
  { key: 'leave', label: 'Leave', description: 'Staff leave requests & approvals', screens: ['Leave'] },
  { key: 'holidays', label: 'Holidays', description: 'Academy holiday calendar', screens: ['Holidays'] },
  { key: 'biometric', label: 'Biometric Devices', description: 'Biometric attendance devices', screens: ['BiometricDevices'] },
  { key: 'late_approvals', label: 'Late Approvals', description: 'Late check-in approvals', screens: ['LateApprovals'] },
  { key: 'payroll', label: 'Payroll', description: 'Staff salaries & payslips', screens: ['Payroll', 'MyPayroll'] },
  { key: 'loans', label: 'Loans & Advances', description: 'Staff loans and salary advances', screens: ['Loans', 'MyLoans'] },
  { key: 'expenses', label: 'Expenses', description: 'Academy expense tracking', screens: ['Expenses'] },
  { key: 'inventory', label: 'Inventory', description: 'Equipment & gear tracking', screens: ['Inventory'] },
  { key: 'facilities', label: 'Facilities', description: 'Courts & facilities', screens: ['Facilities'] },
  { key: 'bookings', label: 'Bookings', description: 'Facility & court bookings', screens: ['Bookings'] },
  { key: 'events', label: 'Events', description: 'Tournaments & events', screens: ['Events'] },
  { key: 'documents', label: 'Documents', description: 'Staff & student document vault', screens: ['Documents'] },
  { key: 'exits', label: 'Exit Management', description: 'Offboarding staff & students', screens: ['ExitManagement'] },
  { key: 'departments', label: 'Departments', description: 'Teams & department structure', screens: ['Departments'] },
  { key: 'reports', label: 'Reports', description: 'Analytics & exports', screens: ['Reports'] },
];

export function isScreenDisabled(screen: string, disabled: string[]): boolean {
  return FEATURES.some(
    f => disabled.includes(f.key) && f.screens.includes(screen),
  );
}

export function isFeatureDisabled(key: string, disabled: string[]): boolean {
  return disabled.includes(key);
}
