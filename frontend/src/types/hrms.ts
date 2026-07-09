// Internal role strings kept identical to the HRMS this was forked from, so
// every existing authorize(...) check keeps working. In the NestSports UI
// these are labeled: super_admin/hr_manager -> "Owner", employee -> "Staff",
// parent -> "Parent" (the one genuinely new role).
export type UserRole =
  | "super_admin"
  | "hr_manager"
  | "hr_executive"
  | "department_head"
  | "employee"
  | "parent";

export interface Subscription {
  status: "active" | "inactive" | "pending_renewal" | "trial";
  plan?: string;
  paymentStatus?: "completed" | "pending" | "failed";
  isTrial?: boolean;
  renewalDate?: string;
  trialEndDate?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "trial";
  subscription?: Subscription;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  status?: string;
  department?: string;
  company?: Company;
  subscription?: Subscription;
  children?: string[]; // Student IDs — only set when role === "parent"
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  head?: { _id: string; name: string; email: string };
  description?: string;
  headcount: number;
  budget?: number;
  status: "active" | "inactive";
}

export interface Employee {
  _id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: Department;
  designation: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  joinDate: string;
  exitDate?: string;
  status: "active" | "inactive" | "on_leave" | "terminated";
  salary?: number;
  workDaysPerWeek?: 5 | 6 | 7;
  otRate?: number;
  otEnabled?: boolean;
  avatar?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  reportingTo?: { firstName: string; lastName: string };
}

export interface AttendanceRecord {
  _id: string;
  employee: Employee;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status:
    | "present"
    | "absent"
    | "half_day"
    | "late"
    | "on_leave"
    | "holiday"
    | "weekend";
  workHours?: number;
  earlyLeaving?: boolean;
  notes?: string;
  verifyMode?:
    | "fingerprint"
    | "card"
    | "face"
    | "password"
    | "manual"
    | "auto"
    | "geo_camera";
  checkInLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    distanceMeters?: number;
  };
  checkOutLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
    distanceMeters?: number;
  };
}

export interface LeaveRequest {
  _id: string;
  employee: Employee;
  leaveType:
    | "casual"
    | "sick"
    | "earned"
    | "maternity"
    | "paternity"
    | "unpaid"
    | "compensatory";
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: { name: string };
  approvedAt?: string;
  rejectionReason?: string;
  isHalfDay?: boolean;
  halfDayType?: "first_half" | "second_half";
  createdAt: string;
}

export interface Payroll {
  _id: string;
  employee: Employee;
  month: number;
  year: number;
  basicSalary: number;
  earnedBasic?: number;
  otherAllowances?: number;
  otPay?: number;
  totalWorkHours?: number;
  hourlyRate?: number;
  lateDeductionAmount?: number;
  halfDayDeduction?: number;
  earlyCheckoutDeduction?: number;
  penaltyAmount?: number;
  grossSalary: number;
  loanDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  overtimeHours?: number;
  weeklyOffDays?: number;
  status: "draft" | "processed" | "paid";
  paidAt?: string;
  remarks?: string;
  slipReceived?: "received" | "not_received" | null;
  slipReceivedAt?: string;
}

export interface Job {
  _id: string;
  title: string;
  department?: Department;
  positions: number;
  type: string;
  status: "open" | "on_hold" | "closed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  description?: string;
  requirements?: string;
  minSalary?: number;
  maxSalary?: number;
  location?: string;
  candidates: Candidate[];
  postedBy?: { name: string };
  closingDate?: string;
  createdAt: string;
}

export interface Candidate {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  stage:
    | "applied"
    | "screening"
    | "interview"
    | "technical"
    | "hr_round"
    | "offered"
    | "hired"
    | "rejected";
  notes?: string;
  appliedAt: string;
}

export interface PerformanceReview {
  _id: string;
  employee: Employee;
  reviewPeriod: string;
  year: number;
  reviewType: "quarterly" | "half_yearly" | "annual" | "probation";
  overallRating?: number;
  status: "draft" | "in_review" | "completed";
  reviewedBy?: { name: string };
  reviewedAt?: string;
}
