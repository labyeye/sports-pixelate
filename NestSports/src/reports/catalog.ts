import {
  attendanceAPI,
  employeeAPI,
  eventAPI,
  leaveAPI,
  payrollAPI,
  reportAPI,
} from '../api/client';

// Config-driven port of the web ReportsPage generators: each report declares
// its filters and a `run` that returns headers + rows. One viewer screen
// renders and exports all of them.

export type Filters = Record<string, string>;
export type ReportTable = { headers: string[]; rows: string[][] };

export type ReportFilter =
  | { kind: 'month' } // month + year
  | { kind: 'year' }
  | { kind: 'dept' }
  | {
      kind: 'select';
      key: string;
      label: string;
      options: { value: string; label: string }[];
    }
  | { kind: 'text'; key: string; label: string; placeholder?: string; numeric?: boolean }
  | { kind: 'ref'; key: string; label: string; load: () => Promise<any[]> };

export type ReportCategory = 'payroll' | 'attendance' | 'employee' | 'student';

export type ReportDef = {
  id: string;
  name: string;
  desc: string;
  category: ReportCategory;
  filters: ReportFilter[];
  run: (f: Filters) => Promise<ReportTable>;
};

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  payroll: 'Payroll',
  attendance: 'Attendance',
  employee: 'Employee',
  student: 'Students',
};

// ── formatting ───────────────────────────────────────────────────────────
const money = (n?: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const dash = '—';
const date = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : dash;
const time = (d?: string, fallback = dash) =>
  d
    ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : fallback;
const person = (e?: any) => (e ? `${e.firstName} ${e.lastName}` : dash);
const upper = (s?: string) => (s ? s.toUpperCase().replace(/_/g, ' ') : dash);

// ── data helpers ─────────────────────────────────────────────────────────
const deptParam = (f: Filters): Record<string, string> =>
  f.dept && f.dept !== 'all' ? { department: f.dept } : {};

const payrolls = async (f: Filters): Promise<any[]> =>
  ((await payrollAPI.getAll({ month: f.month, year: f.year, limit: '500' })) as any)
    .data || [];

// Payroll rows only populate a few employee fields (no bank / PF / ESIC), so the
// statutory reports join the full employee record by id.
const employeesById = async (): Promise<Map<string, any>> => {
  const list: any[] =
    ((await employeeAPI.getAll({ limit: '500' })) as any).data || [];
  return new Map(list.map(e => [e._id, e]));
};

const attendance = async (f: Filters): Promise<any[]> =>
  ((await attendanceAPI.getAll({
    month: f.month,
    year: f.year,
    limit: '500',
    ...deptParam(f),
  })) as any).data || [];

// Per-employee status counts — shared by the two summary reports.
const attendanceSummary = (recs: any[]): string[][] => {
  const byEmp = new Map<string, any>();
  for (const r of recs) {
    if (!r.employee) continue;
    const e =
      byEmp.get(r.employee._id) ||
      { emp: r.employee, present: 0, late: 0, absent: 0, leave: 0, half: 0, total: 0 };
    byEmp.set(r.employee._id, e);
    e.total++;
    if (r.status === 'present') e.present++;
    else if (r.status === 'late') e.late++;
    else if (r.status === 'absent') e.absent++;
    else if (r.status === 'on_leave') e.leave++;
    else if (r.status === 'half_day') e.half++;
  }
  return Array.from(byEmp.values()).map(e => [
    e.emp.employeeId || dash,
    person(e.emp),
    e.emp.department?.name || dash,
    String(e.total),
    String(e.present),
    String(e.late),
    String(e.absent),
    String(e.leave),
    String(e.half),
    e.total > 0 ? `${(((e.present + e.late) / e.total) * 100).toFixed(1)}%` : '0%',
  ]);
};

const SUMMARY_HEADERS = [
  'Emp ID',
  'Employee',
  'Department',
  'Total Days',
  'Present',
  'Late',
  'Absent',
  'On Leave',
  'Half Day',
  'Attendance %',
];

const MONTH: ReportFilter[] = [{ kind: 'month' }];
const MONTH_DEPT: ReportFilter[] = [{ kind: 'month' }, { kind: 'dept' }];

const ALL = { value: 'all', label: 'All' };
const opts = (values: string[]) => [
  ALL,
  ...values.map(v => ({ value: v, label: upper(v) })),
];

export const REPORTS: ReportDef[] = [
  // ── Payroll ────────────────────────────────────────────────────────────
  {
    id: 'pay-report',
    name: 'Pay Report',
    desc: 'Salary components, deductions and net pay per employee.',
    category: 'payroll',
    filters: MONTH,
    run: async f => ({
      headers: ['Employee', 'Emp ID', 'Department', 'Basic', 'HRA', 'DA', 'TA', 'Medical', 'Gross', 'PF', 'ESI', 'TDS', 'Net Pay', 'Status'],
      rows: (await payrolls(f)).map(p => [
        person(p.employee),
        p.employee?.employeeId || dash,
        p.employee?.department?.name || dash,
        money(p.basicSalary),
        money(p.hra),
        money(p.da),
        money(p.ta),
        money(p.medicalAllowance),
        money(p.grossSalary),
        money(p.pf),
        money(p.esi),
        money(p.tds),
        money(p.netSalary),
        upper(p.status),
      ]),
    }),
  },
  {
    id: 'salary-register',
    name: 'Salary Register',
    desc: 'Full register with all components, deductions and net pay.',
    category: 'payroll',
    filters: MONTH,
    run: async f => ({
      headers: ['Emp ID', 'Name', 'Dept', 'Basic', 'HRA', 'DA', 'TA', 'Medical', 'Other Allow.', 'Gross', 'PF Emp.', 'ESI Emp.', 'TDS', 'Prof Tax', 'Total Ded.', 'Net Pay'],
      rows: (await payrolls(f)).map(p => [
        p.employee?.employeeId || dash,
        person(p.employee),
        p.employee?.department?.name || dash,
        money(p.basicSalary),
        money(p.hra),
        money(p.da),
        money(p.ta),
        money(p.medicalAllowance),
        money(0),
        money(p.grossSalary),
        money(p.pf),
        money(p.esi),
        money(p.tds),
        money(0),
        money(p.totalDeductions),
        money(p.netSalary),
      ]),
    }),
  },
  {
    id: 'net-salary',
    name: 'Net Salary Report',
    desc: 'Gross, deductions and net payable with payment status.',
    category: 'payroll',
    filters: MONTH,
    run: async f => ({
      headers: ['Emp ID', 'Employee Name', 'Department', 'Designation', 'Gross Salary', 'Total Deductions', 'Net Pay', 'Payment Status'],
      rows: (await payrolls(f)).map(p => [
        p.employee?.employeeId || dash,
        person(p.employee),
        p.employee?.department?.name || dash,
        p.employee?.designation || dash,
        money(p.grossSalary),
        money(p.totalDeductions),
        money(p.netSalary),
        upper(p.status),
      ]),
    }),
  },
  {
    id: 'pf-register',
    name: 'PF Register',
    desc: 'Provident fund contributions (employee + employer).',
    category: 'payroll',
    filters: MONTH,
    run: async f => {
      const [rows, emps] = await Promise.all([payrolls(f), employeesById()]);
      return {
        headers: ['Emp ID', 'Employee Name', 'Department', 'UAN / PF No.', 'Basic Salary', 'PF (Employee 12%)', 'PF (Employer 12%)', 'Total PF'],
        rows: rows
          .filter(p => (p.pf || 0) > 0)
          .map(p => [
            p.employee?.employeeId || dash,
            person(p.employee),
            p.employee?.department?.name || dash,
            emps.get(p.employee?._id)?.pfNumber || dash,
            money(p.basicSalary),
            money(p.pf),
            money(p.pf),
            money((p.pf || 0) * 2),
          ]),
      };
    },
  },
  {
    id: 'esic-register',
    name: 'ESIC Register',
    desc: 'ESI contributions (employee 0.75% + employer 3.25%).',
    category: 'payroll',
    filters: MONTH,
    run: async f => {
      const [rows, emps] = await Promise.all([payrolls(f), employeesById()]);
      return {
        headers: ['Emp ID', 'Employee Name', 'Department', 'ESIC No.', 'Gross Salary', 'ESI (Employee 0.75%)', 'ESI (Employer 3.25%)', 'Total ESI'],
        rows: rows
          .filter(p => (p.esi || 0) > 0)
          .map(p => {
            const employer = Math.round((p.esi || 0) * (3.25 / 0.75));
            return [
              p.employee?.employeeId || dash,
              person(p.employee),
              p.employee?.department?.name || dash,
              emps.get(p.employee?._id)?.esicNumber || dash,
              money(p.grossSalary),
              money(p.esi),
              money(employer),
              money((p.esi || 0) + employer),
            ];
          }),
      };
    },
  },
  {
    id: 'bank-upload',
    name: 'Bank Upload Report',
    desc: 'Bank account details and net pay for bulk transfers.',
    category: 'payroll',
    filters: MONTH,
    run: async f => {
      const [rows, emps] = await Promise.all([payrolls(f), employeesById()]);
      return {
        headers: ['Emp ID', 'Employee Name', 'Bank Name', 'Account Number', 'IFSC Code', 'Net Pay', 'Payment Mode'],
        rows: rows.map(p => {
          const e = emps.get(p.employee?._id) || p.employee || {};
          return [
            p.employee?.employeeId || dash,
            person(p.employee),
            e.bankName || dash,
            e.bankAccount || dash,
            e.ifscCode || dash,
            money(p.netSalary),
            'NEFT',
          ];
        }),
      };
    },
  },
  {
    id: 'absent-leave-summary',
    name: 'Absent / Leave Summary',
    desc: 'Present, late, absent and leave days per employee.',
    category: 'payroll',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: SUMMARY_HEADERS,
      rows: attendanceSummary(await attendance(f)),
    }),
  },
  {
    id: 'late-coming-summary',
    name: 'Late Coming Summary',
    desc: 'Every late arrival with check-in time and minutes late.',
    category: 'payroll',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: ['Date', 'Emp ID', 'Employee Name', 'Department', 'Check In Time', 'Expected Time', 'Late By'],
      rows: (await attendance(f))
        .filter(r => r.status === 'late')
        .map(r => {
          const c = r.checkIn ? new Date(r.checkIn) : null;
          const late = c ? Math.max(0, (c.getHours() - 9) * 60 + c.getMinutes()) : 0;
          return [
            date(r.date),
            r.employee?.employeeId || dash,
            person(r.employee),
            r.employee?.department?.name || dash,
            time(r.checkIn),
            '09:00 AM',
            late > 0 ? `${late} min` : dash,
          ];
        }),
    }),
  },
  {
    id: 'designation-summary',
    name: 'Designation Summary',
    desc: 'Headcount and payroll grouped by designation.',
    category: 'payroll',
    filters: [],
    run: async () => {
      const emps: any[] =
        ((await employeeAPI.getAll({ limit: '500', status: 'active' })) as any).data || [];
      const by = new Map<string, { count: number; total: number; dept: string }>();
      for (const e of emps) {
        const k = e.designation || 'Unknown';
        const cur = by.get(k) || { count: 0, total: 0, dept: e.department?.name || dash };
        cur.count++;
        cur.total += e.salary || 0;
        by.set(k, cur);
      }
      return {
        headers: ['Designation', 'Department', 'Employee Count', 'Total Payroll (p.a.)', 'Avg. Salary (p.a.)'],
        rows: Array.from(by.entries()).map(([d, v]) => [
          d,
          v.dept,
          String(v.count),
          money(v.total),
          money(v.count ? v.total / v.count : 0),
        ]),
      };
    },
  },

  // ── Attendance ─────────────────────────────────────────────────────────
  {
    id: 'attendance-report',
    name: 'Employee Attendance Report',
    desc: 'Day-wise status, check-in/out and work hours.',
    category: 'attendance',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: ['Date', 'Employee', 'Emp ID', 'Department', 'Status', 'Check In', 'Check Out', 'Work Hours'],
      rows: (await attendance(f)).map(r => [
        date(r.date),
        person(r.employee),
        r.employee?.employeeId || dash,
        r.employee?.department?.name || dash,
        upper(r.status),
        time(r.checkIn),
        time(r.checkOut),
        r.workHours ? `${r.workHours}h` : dash,
      ]),
    }),
  },
  {
    id: 'attendance-inout',
    name: 'Attendance In/Out Report',
    desc: 'Punch-in and punch-out times with total hours.',
    category: 'attendance',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: ['Date', 'Employee', 'Emp ID', 'Department', 'In Time', 'Out Time', 'Total Hours', 'Status'],
      rows: (await attendance(f))
        .filter(r => r.checkIn)
        .map(r => [
          date(r.date),
          person(r.employee),
          r.employee?.employeeId || dash,
          r.employee?.department?.name || dash,
          time(r.checkIn),
          time(r.checkOut, 'Missing'),
          r.workHours ? `${r.workHours}h` : dash,
          upper(r.status),
        ]),
    }),
  },
  {
    id: 'attendance-summary',
    name: 'Attendance Summary',
    desc: 'Monthly present / late / absent counts per employee.',
    category: 'attendance',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: SUMMARY_HEADERS,
      rows: attendanceSummary(await attendance(f)),
    }),
  },
  {
    id: 'leave-report',
    name: 'Leave Report',
    desc: 'Leave applications by type and status for a year.',
    category: 'attendance',
    filters: [
      { kind: 'year' },
      {
        kind: 'select',
        key: 'leaveType',
        label: 'Leave type',
        options: opts(['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'compensatory', 'hourly', 'wfh', 'outdoor_duty']),
      },
      {
        kind: 'select',
        key: 'status',
        label: 'Status',
        options: opts(['pending', 'approved', 'rejected', 'cancelled']),
      },
    ],
    run: async f => {
      const params: Record<string, string> = { limit: '500', year: f.year };
      if (f.leaveType && f.leaveType !== 'all') params.leaveType = f.leaveType;
      if (f.status && f.status !== 'all') params.status = f.status;
      const data: any[] = ((await leaveAPI.getAll(params)) as any).data || [];
      return {
        headers: ['Emp ID', 'Employee', 'Department', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status'],
        rows: data.map(l => [
          l.employee?.employeeId || dash,
          person(l.employee),
          l.employee?.department?.name || dash,
          upper(l.leaveType),
          date(l.startDate),
          date(l.endDate),
          String(l.days || 0),
          l.reason || dash,
          upper(l.status),
        ]),
      };
    },
  },
  {
    id: 'miss-punch',
    name: 'Miss Punch Report',
    desc: 'Days with a check-in but no check-out recorded.',
    category: 'attendance',
    filters: MONTH_DEPT,
    run: async f => ({
      headers: ['Date', 'Emp ID', 'Employee', 'Department', 'Check In', 'Check Out', 'Remark'],
      rows: (await attendance(f))
        .filter(r => r.checkIn && !r.checkOut)
        .map(r => [
          date(r.date),
          r.employee?.employeeId || dash,
          person(r.employee),
          r.employee?.department?.name || dash,
          time(r.checkIn),
          'MISSING',
          'Punch-out not recorded',
        ]),
    }),
  },

  // ── Employee ───────────────────────────────────────────────────────────
  {
    id: 'employee-directory',
    name: 'Employee Directory',
    desc: 'Contact, role, joining and salary details for staff.',
    category: 'employee',
    filters: [
      { kind: 'dept' },
      {
        kind: 'select',
        key: 'status',
        label: 'Status',
        options: opts(['active', 'inactive', 'on_leave', 'terminated']),
      },
    ],
    run: async f => {
      const params: Record<string, string> = { limit: '500', ...deptParam(f) };
      if (f.status && f.status !== 'all') params.status = f.status;
      const data: any[] = ((await employeeAPI.getAll(params)) as any).data || [];
      return {
        headers: ['Emp ID', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Type', 'Join Date', 'Salary (p.a.)', 'Status'],
        rows: data.map(e => [
          e.employeeId || dash,
          `${e.firstName} ${e.lastName}`,
          e.email || dash,
          e.phone || dash,
          e.department?.name || dash,
          e.designation || dash,
          e.employmentType ? e.employmentType.replace(/_/g, ' ') : dash,
          date(e.joinDate),
          money(e.salary),
          upper(e.status),
        ]),
      };
    },
  },

  // ── Students (the ones without a dedicated mobile screen) ──────────────
  {
    id: 'student-fee-report',
    name: 'Student Fee Report',
    desc: 'Plan fees, amounts paid and subscription status.',
    category: 'student',
    filters: [
      {
        kind: 'select',
        key: 'status',
        label: 'Status',
        options: opts(['active', 'inactive', 'cancelled', 'pending_renewal']),
      },
      { kind: 'text', key: 'from', label: 'From (YYYY-MM-DD)', placeholder: '2026-01-01' },
      { kind: 'text', key: 'to', label: 'To (YYYY-MM-DD)', placeholder: '2026-12-31' },
    ],
    run: async f => {
      const params: Record<string, string> = { limit: '500' };
      if (f.status && f.status !== 'all') params.status = f.status;
      if (f.from) params.from = f.from;
      if (f.to) params.to = f.to;
      const data: any[] = ((await reportAPI.studentFees(params)) as any).data || [];
      return {
        headers: ['Student', 'Student ID', 'Sport', 'Batch', 'Plan', 'Billing Cycle', 'Amount', 'Amount Paid', 'Status', 'Start Date', 'Renewal Date'],
        rows: data.map(s => [
          person(s.student),
          s.student?.studentId || dash,
          s.student?.sport || dash,
          s.student?.batch || dash,
          s.planName || dash,
          upper(s.billingCycle),
          money(s.amount),
          money(s.amountPaid),
          upper(s.status),
          date(s.startDate),
          date(s.renewalDate),
        ]),
      };
    },
  },
  {
    id: 'student-outstanding-dues',
    name: 'Student Outstanding Dues',
    desc: 'Students with unpaid balances.',
    category: 'student',
    filters: [{ kind: 'text', key: 'minAmount', label: 'Minimum due (₹)', numeric: true }],
    run: async f => {
      const params: Record<string, string> = {};
      if (f.minAmount) params.minAmount = f.minAmount;
      const data: any[] = ((await reportAPI.studentOutstanding(params)) as any).data || [];
      return {
        headers: ['Student', 'Student ID', 'Plan', 'Amount', 'Amount Paid', 'Due', 'Status', 'Renewal Date'],
        rows: data.map(r => [
          person(r.student),
          r.student?.studentId || dash,
          r.planName || dash,
          money(r.amount),
          money(r.amountPaid),
          money(r.due),
          upper(r.status),
          date(r.renewalDate),
        ]),
      };
    },
  },
  {
    id: 'tournament-report',
    name: 'Tournament Report',
    desc: 'Fixtures, scores and winners for a tournament.',
    category: 'student',
    filters: [
      {
        kind: 'ref',
        key: 'tournamentId',
        label: 'Tournament',
        load: async () =>
          ((await eventAPI.getAll({ eventType: 'tournament' })) as any).data || [],
      },
    ],
    run: async f => {
      if (!f.tournamentId) return { headers: ['Round'], rows: [] };
      const data: any[] = ((await eventAPI.getFixtures(f.tournamentId)) as any).data || [];
      return {
        headers: ['Round', 'Team A', 'Team B', 'Score A', 'Score B', 'Winner', 'Status', 'Date', 'Venue'],
        rows: [...data]
          .sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex)
          .map(x => [
            x.roundLabel || `Round ${x.round}`,
            x.teamA?.name || 'TBD',
            x.teamB?.name || 'TBD',
            String(x.scoreA ?? dash),
            String(x.scoreB ?? dash),
            x.winner === 'A' ? x.teamA?.name || 'A' : x.winner === 'B' ? x.teamB?.name || 'B' : dash,
            upper(x.status),
            date(x.date),
            x.venue || dash,
          ]),
      };
    },
  },
];

export const findReport = (id: string) => REPORTS.find(r => r.id === id);
