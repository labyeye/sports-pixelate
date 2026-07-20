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
  status: "active" | "inactive";
}

export interface Sport {
  _id: string;
  name: string;
  active: boolean;
  studentCount: number;
  coachCount: number;
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
  role?: "coach" | "staff";
  sport?: string; // which sport they coach, when role === "coach"
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

// ── Events (generalized Tournament module) ─────────────────────────────
// Backend contract: /api/events (Event.js pinned to the old "tournaments"
// collection). Field names below match the Mongoose doc shape exactly.

export interface EventVenue {
  name?: string;
  hallGroundCourtStage?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  mapsUrl?: string;
  indoorOutdoor?: string;
}

export interface EventSchedule {
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  checkInTime?: string;
  openingCeremonyTime?: string;
  closingCeremonyTime?: string;
}

export interface EventParticipation {
  type: "individual" | "team" | "group";
  maxRegistrations?: number;
  minParticipants?: number;
  maxParticipants?: number;
  waitingListEnabled?: boolean;
  onlineRegistration?: boolean;
  approvalRequired?: boolean;
}

export interface EventCategories {
  ageCategory: string[];
  gender: string[];
  skillLevel: string[];
  division: string[];
}

export interface EventFees {
  entryFee?: number;
  currency?: string;
  earlyBirdDiscount?: number;
  earlyBirdDeadline?: string;
  lateRegistrationFee?: number;
  registrationDeadline?: string;
  onlinePaymentEnabled?: boolean;
}

export interface EventAwards {
  winnerPrize?: string;
  runnerUpPrize?: string;
  participationCertificate?: boolean;
  cashPrize?: number;
  medals?: boolean;
  trophies?: boolean;
  specialAwards: string[];
  description?: string;
}

export interface EventOfficial {
  _id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface EventDocument {
  _id: string;
  kind:
    | "rule_book"
    | "guidelines"
    | "consent_form"
    | "medical_form"
    | "performance_music"
    | "fixture_pdf"
    | "other";
  label?: string;
  url: string;
  uploadedAt?: string;
}

export interface EventAutomation {
  notifications?: boolean;
  onlinePayments?: boolean;
  autoPublishResults?: boolean;
  qrCheckIn?: boolean;
  attendanceTracking?: boolean;
  liveUpdates?: boolean;
  certificates?: boolean;
}

export interface SportFields {
  maxTeams?: number;
  groupsEnabled?: boolean;
  matchDurationMinutes?: number;
  extraTimeAllowed?: boolean;
  penaltyRules?: string;
  tieBreakRules?: string;
  playerLimit?: number;
  substitutesAllowed?: number;
  seedingEnabled?: boolean;
  randomDraw?: boolean;
}

export interface DanceFields {
  danceStyle?: string;
  performanceMode?: "solo" | "duo" | "group" | null;
  performanceDurationMinutes?: number;
  musicUploadUrl?: string;
  theme?: string;
  propsAllowed?: boolean;
  costumeGuidelines?: string;
  judgingCriteria: string[];
  performanceOrder?: string;
  stageDimensions?: string;
  maxPerformers?: number;
  minPerformers?: number;
}

export interface WorkshopFields {
  instructor?: string;
  maxSeats?: number;
  sessionDurationMinutes?: number;
  materialsRequired?: string;
  certificateAvailable?: boolean;
}

export interface PerformanceFields {
  performanceOrder?: string;
  greenRoomRequired?: boolean;
  soundCheckTime?: string;
  lightingNotes?: string;
  stageManager?: string;
}

export interface EventTeam {
  _id: string;
  name: string;
}

export interface EventRegistration {
  _id: string;
  student:
    | {
        _id: string;
        firstName: string;
        lastName: string;
        sport?: string;
        avatar?: string;
      }
    | string;
  team?: string | null;
  registeredAt: string;
  status: "confirmed" | "waitlisted";
}

export interface EventSlot {
  team: string | null;
  name: string | null;
}

export interface EventFixture {
  _id: string;
  event: string;
  round: number;
  roundLabel: string;
  matchIndex: number;
  teamA: EventSlot;
  teamB: EventSlot;
  scoreA?: number;
  scoreB?: number;
  winner?: "A" | "B" | null;
  status: "scheduled" | "completed" | "bye";
  date?: string;
  venue?: string;
  nextFixture?: string | null;
  nextFixtureSlot?: "A" | "B" | null;
}

export interface Event {
  _id: string;
  company: string;
  name: string;
  eventType: string;
  activity: string;
  activityCategory?: string;
  coverImageUrl?: string;
  bannerImageUrl?: string;
  description?: string;
  organizerName?: string;
  contactPerson?: string;
  mobileNumber?: string;
  email?: string;
  website?: string;
  schedule?: EventSchedule;
  venue?: EventVenue;
  participation?: EventParticipation;
  categories?: EventCategories;
  fees?: EventFees;
  awards?: EventAwards;
  officials: EventOfficial[];
  documents: EventDocument[];
  automation?: EventAutomation;
  sportFields?: SportFields;
  danceFields?: DanceFields;
  workshopFields?: WorkshopFields;
  performanceFields?: PerformanceFields;
  format:
    | "knockout"
    | "round_robin"
    | "single_elimination"
    | "double_elimination"
    | "league"
    | "group_stage"
    | "swiss"
    | "best_of_series";
  startDate?: string;
  endDate?: string;
  entryFee?: number;
  teams: EventTeam[];
  registrations: EventRegistration[];
  registrationOpen: boolean;
  fixturesGenerated: boolean;
  status:
    | "draft"
    | "registration_open"
    | "registration_closed"
    | "upcoming"
    | "live"
    | "completed"
    | "cancelled";
  visibility: "public" | "private" | "invite_only";
  registrationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventDashboard {
  totalRegistrations: number;
  totalParticipants: number;
  upcomingSessions: number;
  completedSessions: number;
  revenue: number;
  pendingPayments: number;
  certificatesIssued: number;
  attendancePercent: number | null;
}

export interface EventGalleryItem {
  _id: string;
  event: string;
  company: string;
  url: string;
  caption?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface EventAnnouncement {
  _id: string;
  event: string;
  company: string;
  title: string;
  message: string;
  postedBy?: string;
  createdAt: string;
}

export interface EventPayment {
  _id: string;
  event: string;
  company: string;
  student?: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  createdAt: string;
}

export interface EventAttendanceRecord {
  _id: string;
  event: string;
  company: string;
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  status: "present" | "absent";
  markedAt?: string;
  createdAt: string;
}
