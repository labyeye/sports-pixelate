import { UserRole } from '../types';
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
  ShieldAlert,
  AlertCircle,
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
  UserCircle,
  ShieldCheck,
  Cpu,
  FileBarChart,
} from 'lucide-react-native';

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
  desc: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const OWNER: UserRole[] = ['super_admin', 'hr_manager'];
const OWNER_STAFF: UserRole[] = ['super_admin', 'hr_manager', 'employee'];
const ALL: UserRole[] = [
  'super_admin',
  'hr_manager',
  'hr_executive',
  'department_head',
  'employee',
  'parent',
];

export const navGroups: NavGroup[] = [
  {
    label: 'Academy',
    items: [
      {
        title: 'Students',
        screen: 'Students',
        icon: GraduationCap,
        roles: OWNER_STAFF,
        desc: 'Manage student profiles & enrollment',
      },
      {
        title: 'Staff',
        screen: 'Employees',
        icon: Users,
        roles: OWNER,
        desc: 'Manage coaching & academy staff',
      },
      {
        title: 'Departments',
        screen: 'Departments',
        icon: Building2,
        roles: OWNER,
        desc: 'Manage teams & department structure',
      },
      {
        title: 'Credentials',
        screen: 'EmployeeCredentials',
        icon: Lock,
        roles: OWNER,
        desc: 'Reset staff login credentials',
      },
      {
        title: 'Documents',
        screen: 'Documents',
        icon: FolderOpen,
        roles: OWNER_STAFF,
        desc: 'Staff & student document vault',
      },
      {
        title: 'Events',
        screen: 'Events',
        icon: Trophy,
        roles: ALL,
        desc: 'Manage tournaments, competitions & events',
      },
    ],
  },
  {
    label: 'Attendance',
    items: [
      {
        title: 'Student Attendance',
        screen: 'StudentAttendance',
        icon: Clock,
        roles: OWNER_STAFF,
        desc: 'Mark & track student attendance',
      },
      {
        title: 'Staff Attendance',
        screen: 'Attendance',
        icon: Clock,
        roles: OWNER,
        desc: 'Mark & track staff attendance',
      },
      {
        title: 'Leave',
        screen: 'Leave',
        icon: CalendarDays,
        roles: OWNER,
        desc: 'Approve & manage leave requests',
      },
      {
        title: 'Holidays',
        screen: 'Holidays',
        icon: Gift,
        roles: OWNER,
        desc: 'Academy holidays calendar',
      },
      {
        title: 'Attendance Settings',
        screen: 'AttendanceSettings',
        icon: ShieldAlert,
        roles: OWNER,
        desc: 'Shift, late & leave allowance rules',
      },
      {
        title: 'Biometric Devices',
        screen: 'BiometricDevices',
        icon: Cpu,
        roles: OWNER,
        desc: 'Manage biometric attendance devices',
      },
      {
        title: 'Late Approvals',
        screen: 'LateApprovals',
        icon: AlertCircle,
        roles: OWNER,
        desc: 'Resolve late check-ins beyond allowance',
      },
    ],
  },
  {
    label: 'My Workspace',
    items: [
      {
        title: 'My Payroll',
        screen: 'MyPayroll',
        icon: Banknote,
        roles: ['employee'],
        desc: 'View your salary & payslips',
      },
      {
        title: 'My Report',
        screen: 'MyReport',
        icon: FileText,
        roles: ['employee'],
        desc: 'View your performance report',
      },
      {
        title: 'My Loans',
        screen: 'MyLoans',
        icon: Banknote,
        roles: ['employee'],
        desc: 'Request a loan or salary advance',
      },
    ],
  },
  {
    label: 'For Parents',
    items: [
      {
        title: 'Attendance',
        screen: 'ParentAttendance',
        icon: Clock,
        roles: ['parent'],
        desc: "View your child's attendance",
      },
      {
        title: 'Subscriptions',
        screen: 'Subscriptions',
        icon: Wallet,
        roles: ['parent'],
        desc: 'Manage your subscription plan',
      },
      {
        title: 'Bookings',
        screen: 'Bookings',
        icon: CalendarClock,
        roles: ['parent'],
        desc: 'Book facilities & courts',
      },
      {
        title: 'Student Report',
        screen: 'ParentReport',
        icon: FileBarChart,
        roles: ['parent'],
        desc: "Generate your child's report card",
      },
    ],
  },
  {
    label: 'Billing & Plans',
    items: [
      {
        title: 'Coaching Plans',
        screen: 'Plans',
        icon: Gift,
        roles: OWNER,
        desc: 'Manage coaching plans & pricing',
      },
      {
        title: 'Subscriptions',
        screen: 'Subscriptions',
        icon: Wallet,
        roles: OWNER,
        desc: 'Manage student subscriptions',
      },
      {
        title: 'Expenses',
        screen: 'Expenses',
        icon: Receipt,
        roles: OWNER,
        desc: 'Track academy expenses',
      },
      {
        title: 'Payroll',
        screen: 'Payroll',
        icon: IndianRupee,
        roles: OWNER,
        desc: 'Manage staff salaries & payslips',
      },
      {
        title: 'Loans & Advances',
        screen: 'Loans',
        icon: Banknote,
        roles: OWNER,
        desc: 'Employee loan management',
      },
    ],
  },
  {
    label: 'Facilities',
    items: [
      {
        title: 'Inventory',
        screen: 'Inventory',
        icon: Package,
        roles: OWNER_STAFF,
        desc: 'Track sports equipment & gear',
      },
      {
        title: 'Facilities',
        screen: 'Facilities',
        icon: MapPin,
        roles: OWNER,
        desc: 'Manage courts & facilities',
      },
      {
        title: 'Bookings',
        screen: 'Bookings',
        icon: CalendarClock,
        roles: OWNER_STAFF,
        desc: 'Facility & court bookings',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        title: 'Reports',
        screen: 'Reports',
        icon: BarChart2,
        roles: OWNER,
        desc: 'Analytics & export data',
      },
      {
        title: 'Student Reports',
        screen: 'StudentReports',
        icon: FileBarChart,
        roles: OWNER,
        desc: 'Attendance, fees, enrollment & directory reports',
      },
      {
        title: 'Manage',
        screen: 'Manage',
        icon: SlidersHorizontal,
        roles: OWNER,
        desc: 'Shifts, roles & configuration',
      },
      {
        title: 'Billing',
        screen: 'Billing',
        icon: CreditCard,
        roles: ['super_admin'],
        desc: 'Subscription & invoices',
      },
      {
        title: 'Settings',
        screen: 'Settings',
        icon: Settings,
        roles: OWNER,
        desc: 'Academy & app configuration',
      },
      {
        title: 'Permissions',
        screen: 'Permissions',
        icon: ShieldCheck,
        roles: OWNER,
        desc: 'Role-based access control',
      },
      {
        title: 'Audit Log',
        screen: 'AuditLog',
        icon: Shield,
        roles: OWNER,
        desc: 'Track who changed what & when',
      },
      {
        title: 'Support',
        screen: 'Support',
        icon: LifeBuoy,
        roles: ALL,
        desc: 'Report issues & track tickets',
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        title: 'My Profile',
        screen: 'Profile',
        icon: UserCircle,
        roles: ALL,
        desc: 'View & edit your profile',
      },
      {
        title: '2FA Security',
        screen: 'TwoFactor',
        icon: ShieldCheck,
        roles: ALL,
        desc: 'Two-factor authentication',
      },
    ],
  },
];

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return navGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => item.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0);
}
