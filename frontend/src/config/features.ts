// Optional modules the owner can switch off in Settings → Features. A disabled
// feature disappears from the sidebar and its pages redirect home. Core
// screens (students, attendance, subscriptions, settings, billing) are not
// listed here and can't be disabled. Keep keys in sync with NestSports/src/config/features.ts.
export interface FeatureDef {
  key: string;
  label: string;
  description: string;
  paths: string[];
}

export const FEATURES: FeatureDef[] = [
  { key: "leave", label: "Leave", description: "Staff leave requests & approvals", paths: ["/leave"] },
  { key: "holidays", label: "Holidays", description: "Academy holiday calendar", paths: ["/holidays"] },
  { key: "biometric", label: "Biometric Devices", description: "Biometric attendance devices", paths: ["/biometric"] },
  { key: "late_approvals", label: "Late Approvals", description: "Late check-in approvals", paths: ["/late-approvals"] },
  { key: "payroll", label: "Payroll", description: "Staff salaries & payslips", paths: ["/payroll", "/my-payroll"] },
  { key: "loans", label: "Loans & Advances", description: "Staff loans and salary advances", paths: ["/loans", "/my-loans"] },
  { key: "expenses", label: "Expenses", description: "Academy expense tracking", paths: ["/expenses"] },
  { key: "inventory", label: "Inventory", description: "Equipment & gear tracking", paths: ["/inventory"] },
  { key: "facilities", label: "Facilities", description: "Courts & facilities", paths: ["/facilities"] },
  { key: "bookings", label: "Bookings", description: "Facility & court bookings", paths: ["/bookings"] },
  { key: "events", label: "Events", description: "Tournaments & events", paths: ["/events"] },
  { key: "documents", label: "Documents", description: "Staff & student document vault", paths: ["/documents"] },
  { key: "exits", label: "Exit Management", description: "Offboarding staff & students", paths: ["/exits"] },
  { key: "departments", label: "Departments", description: "Teams & department structure", paths: ["/departments"] },
  { key: "reports", label: "Reports", description: "Analytics & exports", paths: ["/reports"] },
];

export function isPathDisabled(pathname: string, disabled: string[]): boolean {
  if (disabled.length === 0) return false;
  return FEATURES.some(
    (f) =>
      disabled.includes(f.key) &&
      f.paths.some((p) => pathname === p || pathname.startsWith(p + "/")),
  );
}
