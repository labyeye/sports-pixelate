import { UserRole } from "@/types/hrms";
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  IndianRupee,
  Building2,
  Settings,
  LucideIcon,
  User,
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
  Fingerprint,
  AlertCircle,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Internal role strings are inherited from the HRMS fork (super_admin/hr_manager
// = "Owner", employee = "Staff/Coach", parent = "Parent" — see types/hrms.ts).
const OWNER: UserRole[] = ["super_admin", "hr_manager"];
const OWNER_STAFF: UserRole[] = ["super_admin", "hr_manager", "employee"];
const ALL: UserRole[] = ["super_admin", "hr_manager", "employee", "parent"];

const allGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, roles: OWNER },
      {
        title: "My Profile",
        href: "/my-profile",
        icon: User,
        roles: ["employee"],
      },
      {
        title: "Home",
        href: "/parent-home",
        icon: LayoutDashboard,
        roles: ["parent"],
      },
    ],
  },
  {
    label: "Academy",
    items: [
      {
        title: "Students",
        href: "/students",
        icon: GraduationCap,
        roles: OWNER_STAFF,
      },
      { title: "Staff", href: "/employees", icon: Users, roles: OWNER },
      {
        title: "Departments",
        href: "/departments",
        icon: Building2,
        roles: OWNER,
      },
      {
        title: "Credentials",
        href: "/employee-credentials",
        icon: Lock,
        roles: OWNER,
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FolderOpen,
        roles: ["super_admin", "hr_manager", "employee"],
      },
      { title: "Events", href: "/events", icon: Trophy, roles: ALL },
    ],
  },
  {
    label: "Attendance",
    items: [
      {
        title: "Student Attendance",
        href: "/student-attendance",
        icon: Clock,
        roles: OWNER_STAFF,
      },
      {
        title: "Staff Attendance",
        href: "/attendance",
        icon: Clock,
        roles: OWNER,
      },
      { title: "Leave", href: "/leave", icon: CalendarDays, roles: OWNER },
      { title: "Holidays", href: "/holidays", icon: Gift, roles: OWNER },
      {
        title: "Attendance Settings",
        href: "/attendance-settings",
        icon: SlidersHorizontal,
        roles: OWNER,
      },
      {
        title: "Biometric Devices",
        href: "/biometric",
        icon: Fingerprint,
        roles: OWNER,
      },
      {
        title: "Late Approvals",
        href: "/late-approvals",
        icon: AlertCircle,
        roles: OWNER,
      },
    ],
  },
  {
    label: "My Workspace",
    items: [
      {
        title: "My Payroll",
        href: "/my-payroll",
        icon: Banknote,
        roles: ["employee"],
      },
      {
        title: "My Report",
        href: "/my-report",
        icon: FileText,
        roles: ["employee"],
      },
      {
        title: "My Loans",
        href: "/my-loans",
        icon: Banknote,
        roles: ["employee"],
      },
    ],
  },
  {
    label: "For Parents",
    items: [
      {
        title: "My Children",
        href: "/parent-home",
        icon: GraduationCap,
        roles: ["parent"],
      },
      {
        title: "Attendance",
        href: "/parent-attendance",
        icon: Clock,
        roles: ["parent"],
      },
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: Wallet,
        roles: ["parent"],
      },
      {
        title: "Bookings",
        href: "/bookings",
        icon: CalendarClock,
        roles: ["parent"],
      },
      {
        title: "Student Report",
        href: "/parent-report",
        icon: FileText,
        roles: ["parent"],
      },
    ],
  },
  {
    label: "Billing & Plans",
    items: [
      { title: "Coaching Plans", href: "/plans", icon: Gift, roles: OWNER },
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: Wallet,
        roles: OWNER,
      },
      { title: "Expenses", href: "/expenses", icon: Receipt, roles: OWNER },
      { title: "Payroll", href: "/payroll", icon: IndianRupee, roles: OWNER },
      {
        title: "Loans & Advances",
        href: "/loans",
        icon: Banknote,
        roles: OWNER,
      },
    ],
  },
  {
    label: "Facilities",
    items: [
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: OWNER_STAFF,
      },
      { title: "Facilities", href: "/facilities", icon: MapPin, roles: OWNER },
      {
        title: "Bookings",
        href: "/bookings",
        icon: CalendarClock,
        roles: OWNER_STAFF,
      },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart2, roles: OWNER },
      {
        title: "Manage",
        href: "/manage",
        icon: SlidersHorizontal,
        roles: OWNER,
      },
      {
        title: "Billing",
        href: "/billing",
        icon: CreditCard,
        roles: ["super_admin"],
      },
      { title: "Settings", href: "/settings", icon: Settings, roles: OWNER },
      { title: "Audit Log", href: "/audit-log", icon: Shield, roles: OWNER },
      {
        title: "Support",
        href: "/support",
        icon: LifeBuoy,
        roles: ["super_admin", "hr_manager", "employee", "parent"],
      },
    ],
  },
];

export const navItems: NavItem[] = allGroups.flatMap((g) => g.items);

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  return allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
}
