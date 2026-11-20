import { UserRole } from "@/types/hrms";
import {
  ListChecks,
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
  UserMinus,
  Layers,
  Megaphone,
  Trash2,
} from "lucide-react";

import { isPathDisabled } from "@/config/features";

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

const baseGroups: NavGroup[] = [
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
      }
    ],
  },
  {
    label: "Students",
    items: [
      {
        title: "Students",
        href: "/students",
        icon: GraduationCap,
        roles: OWNER_STAFF,
      },
      { title: "Groups", href: "/groups", icon: Layers, roles: OWNER },
      {
        title: "Student Attendance",
        href: "/student-attendance",
        icon: Clock,
        roles: OWNER_STAFF,
      },
      { title: "Coaching Plans", href: "/plans", icon: Gift, roles: OWNER },
      {
        title: "Timetable",
        href: "/timetable",
        icon: CalendarDays,
        roles: ALL,
      },
    ],
  },
  {
    label: "Employees",
    items: [
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
        title: "Staff Attendance",
        href: "/attendance",
        icon: Clock,
        roles: OWNER,
      },
      {
        title: "Late Approvals",
        href: "/late-approvals",
        icon: AlertCircle,
        roles: OWNER,
      },
      { title: "Leave", href: "/leave", icon: CalendarDays, roles: OWNER },
      { title: "Holidays", href: "/holidays", icon: Gift, roles: OWNER },
      {
        title: "Tasks",
        href: "/tasks",
        icon: ListChecks,
        roles: OWNER_STAFF,
      },
      {
        title: "Exit Management",
        href: "/exits",
        icon: UserMinus,
        roles: OWNER,
      }
    ],
  },
  {
    label: "Inventory & POS",
    items: [
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: OWNER_STAFF,
      }
    ],
  },
  {
    label: "Booking",
    items: [
      { title: "Facilities", href: "/facilities", icon: MapPin, roles: OWNER },
      {
        title: "Bookings",
        href: "/bookings",
        icon: CalendarClock,
        roles: OWNER_STAFF,
      },
      { title: "Events", href: "/events", icon: Trophy, roles: ALL }
    ],
  },
  {
    label: "Finance",
    items: [
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: Wallet,
        roles: OWNER,
      },
      { title: "Expenses", href: "/expenses", icon: Receipt, roles: OWNER },
      {
        title: "Expense Claims",
        href: "/expense-claims",
        icon: Receipt,
        roles: OWNER_STAFF,
      },
      { title: "Payroll", href: "/payroll", icon: IndianRupee, roles: OWNER },
      {
        title: "Loans & Advances",
        href: "/loans",
        icon: Banknote,
        roles: OWNER,
      }
    ],
  },
  {
    label: "Communication",
    items: [
      {
        title: "Announcements",
        href: "/announcements",
        icon: Megaphone,
        roles: ALL,
      },
      {
        title: "Letters",
        href: "/letters",
        icon: FileText,
        roles: OWNER,
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FolderOpen,
        roles: ["super_admin", "hr_manager", "employee"],
      }
    ],
  },
  {
    label: "Devices & Setup",
    items: [
      {
        title: "Attendance Settings",
        href: "/attendance-settings",
        icon: SlidersHorizontal,
        roles: OWNER,
      },
      {
        title: "NFC Cards",
        href: "/nfc-manager",
        icon: CreditCard,
        roles: OWNER,
      },
      {
        title: "Biometric Devices",
        href: "/biometric",
        icon: Fingerprint,
        roles: OWNER,
      }
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
      }
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
      }
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
      { title: "Trash", href: "/trash", icon: Trash2, roles: OWNER }
    ],
  },
];

// Rarely-used pages are folded into one "Others" group so the main sidebar
// stays short. Mobile mirrors this list (NestSports/src/navigation/navConfig.ts).
const OTHERS_HREFS = [
  "/holidays",
  "/tasks",
  "/late-approvals",
  "/employee-credentials",
  "/exits",
  "/inventory",
  "/letters",
  "/documents",
];

const allGroups: NavGroup[] = (() => {
  const others: NavItem[] = [];
  const groups = baseGroups.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (OTHERS_HREFS.includes(item.href)) {
        others.push(item);
        return false;
      }
      return true;
    }),
  }));
  const at = groups.findIndex((g) => g.label === "My Workspace");
  groups.splice(at < 0 ? groups.length : at, 0, {
    label: "Others",
    items: others,
  });
  return groups.filter((g) => g.items.length > 0);
})();

export const navItems: NavItem[] = allGroups.flatMap((g) => g.items);

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function getNavGroupsForRole(
  role: UserRole,
  disabledFeatures: string[] = [],
): NavGroup[] {
  return allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.roles.includes(role) &&
          !isPathDisabled(item.href, disabledFeatures),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
