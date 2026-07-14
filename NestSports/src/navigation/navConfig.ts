import { UserRole } from "../types";
import {
  Users,
  Clock,
  CalendarDays,
  IndianRupee,
  Building2,
  Settings,
  LucideIcon,
  Lock,
  BarChart2,
  Gift,
  CreditCard,
  SlidersHorizontal,
  FileText,
  Banknote,
  Shield,
  LifeBuoy,
  FolderOpen,
  GraduationCap,
  Wallet,
  Package,
  CalendarClock,
  MapPin,
  Receipt,
  Trophy,
} from "lucide-react-native";

// Mirrors frontend/src/config/navigation.ts (the web sidebar) so every role
// sees the same set of sections on mobile, just reached via the Menu tab
// instead of a sidebar. `screen` is the RootStack route name (see
// RootNavigator.tsx) — screen names deliberately match the web route's
// intent, not its URL. Icons mirror the web nav's lucide-react icons
// (lucide-react-native is the same icon set for React Native).
export interface NavItem {
  title: string;
  screen: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const OWNER: UserRole[] = ["super_admin", "hr_manager"];
const OWNER_STAFF: UserRole[] = ["super_admin", "hr_manager", "employee"];
const ALL: UserRole[] = [
  "super_admin",
  "hr_manager",
  "hr_executive",
  "department_head",
  "employee",
  "parent",
];

export const navGroups: NavGroup[] = [
  {
    label: "Academy",
    items: [
      { title: "Students", screen: "Students", icon: GraduationCap, roles: OWNER_STAFF },
      { title: "Staff", screen: "Employees", icon: Users, roles: OWNER },
      { title: "Departments", screen: "Departments", icon: Building2, roles: OWNER },
      { title: "Credentials", screen: "EmployeeCredentials", icon: Lock, roles: OWNER },
      { title: "Documents", screen: "Documents", icon: FolderOpen, roles: OWNER_STAFF },
      { title: "Tournaments", screen: "Tournaments", icon: Trophy, roles: ALL },
    ],
  },
  {
    label: "Attendance",
    items: [
      { title: "Student Attendance", screen: "StudentAttendance", icon: Clock, roles: OWNER_STAFF },
      { title: "Staff Attendance", screen: "Attendance", icon: Clock, roles: OWNER },
      { title: "Leave", screen: "Leave", icon: CalendarDays, roles: OWNER },
      { title: "Holidays", screen: "Holidays", icon: Gift, roles: OWNER },
    ],
  },
  {
    label: "My Workspace",
    items: [
      { title: "My Payroll", screen: "MyPayroll", icon: Banknote, roles: ["employee"] },
      { title: "My Report", screen: "MyReport", icon: FileText, roles: ["employee"] },
      { title: "My Loans", screen: "MyLoans", icon: Banknote, roles: ["employee"] },
    ],
  },
  {
    label: "For Parents",
    items: [
      { title: "Subscriptions", screen: "Subscriptions", icon: Wallet, roles: ["parent"] },
      { title: "Bookings", screen: "Bookings", icon: CalendarClock, roles: ["parent"] },
    ],
  },
  {
    label: "Billing & Plans",
    items: [
      { title: "Coaching Plans", screen: "Plans", icon: Gift, roles: OWNER },
      { title: "Subscriptions", screen: "Subscriptions", icon: Wallet, roles: OWNER },
      { title: "Expenses", screen: "Expenses", icon: Receipt, roles: OWNER },
      { title: "Payroll", screen: "Payroll", icon: IndianRupee, roles: OWNER },
      { title: "Payroll Settings", screen: "PayrollSettings", icon: SlidersHorizontal, roles: OWNER },
      { title: "Loans & Advances", screen: "Loans", icon: Banknote, roles: OWNER },
    ],
  },
  {
    label: "Facilities",
    items: [
      { title: "Inventory", screen: "Inventory", icon: Package, roles: OWNER_STAFF },
      { title: "Facilities", screen: "Facilities", icon: MapPin, roles: OWNER },
      { title: "Bookings", screen: "Bookings", icon: CalendarClock, roles: OWNER_STAFF },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports", screen: "Reports", icon: BarChart2, roles: OWNER },
      { title: "Manage", screen: "Manage", icon: SlidersHorizontal, roles: OWNER },
      { title: "Billing", screen: "Billing", icon: CreditCard, roles: ["super_admin"] },
      { title: "Settings", screen: "Settings", icon: Settings, roles: OWNER },
      { title: "Audit Log", screen: "AuditLog", icon: Shield, roles: OWNER },
      { title: "Support", screen: "Support", icon: LifeBuoy, roles: ALL },
    ],
  },
];

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => item.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}
