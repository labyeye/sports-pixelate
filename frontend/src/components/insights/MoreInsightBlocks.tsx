import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  IndianRupee,
  MapPin,
  TrendingUp,
  Trophy,
  UserX,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  type Insight,
  MiniBars,
  MiniLine,
  PageInsights,
} from "@/components/ui/PageInsights";

const BLUE = "#024BAB";
const GREEN = "#00C48C";
const RED = "#EF4444";
const ORANGE = "#FA731C";
const PURPLE = "#A855F7";
const YELLOW = "#CA8A04";

const pretty = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const count = <T,>(rows: T[], key: (r: T) => string) => {
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const k = key(r);
    m[k] = (m[k] || 0) + 1;
  });
  return m;
};
const nameOf = (e: any) =>
  e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : "Unknown";

export function LeaveInsights({ leaves }: { leaves: any[] }) {
  if (!leaves.length) return null;
  const byStatus = count(leaves, (l) => l.status);
  const byType = Object.entries(count(leaves, (l) => l.leaveType)).sort((a, b) => b[1] - a[1]);
  const approvedDays = leaves.filter((l) => l.status === "approved").reduce((s, l) => s + (l.days || 0), 0);
  const upcoming = leaves.filter((l) => l.status === "approved" && new Date(l.startDate).getTime() >= Date.now()).length;
  const people = count(leaves.filter((l) => l.status === "approved"), (l) => nameOf(l.employee));
  const top = Object.entries(people).sort((a, b) => b[1] - a[1])[0];
  const insights: Insight[] = [
    ...(byStatus.pending ? [{ icon: AlertTriangle, color: ORANGE, msg: `${byStatus.pending} request${byStatus.pending > 1 ? "s" : ""} waiting for approval` }] : []),
    { icon: CalendarDays, color: BLUE, msg: `${approvedDays} approved leave days in total` },
    ...(upcoming ? [{ icon: CalendarClock, color: PURPLE, msg: `${upcoming} approved leave${upcoming > 1 ? "s" : ""} still to start` }] : []),
    ...(byType[0] ? [{ icon: TrendingUp, color: GREEN, msg: `${pretty(byType[0][0])} leave is the most requested (${byType[0][1]})` }] : []),
    ...(top && top[1] > 1 ? [{ icon: Users, color: RED, msg: `${top[0]} has taken ${top[1]} approved leaves` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="By Status" subtitle="All requests" data={["pending", "approved", "rejected", "cancelled"].map((k) => ({ label: pretty(k), requests: byStatus[k] || 0 }))} series={[{ key: "requests", name: "Requests", color: BLUE }]} />
      <MiniBars title="By Leave Type" subtitle="All requests" data={byType.map(([k, v]) => ({ label: pretty(k), requests: v }))} series={[{ key: "requests", name: "Requests", color: ORANGE }]} />
    </PageInsights>
  );
}

export function PayrollInsights({ payrolls }: { payrolls: any[] }) {
  if (!payrolls.length) return null;
  const sum = (k: string) => payrolls.reduce((s, p) => s + (p[k] || 0), 0);
  const net = sum("netSalary");
  const gross = sum("grossSalary");
  const ded = sum("totalDeductions");
  const paid = payrolls.filter((p) => p.status === "paid").length;
  const topPaid = [...payrolls].sort((a, b) => b.netSalary - a.netSalary).slice(0, 6);
  const missingSlip = payrolls.filter((p) => p.status === "paid" && p.slipReceived !== "received").length;
  const insights: Insight[] = [
    { icon: IndianRupee, color: BLUE, msg: `${formatCurrency(net)} net payable to ${payrolls.length} staff` },
    { icon: CheckCircle2, color: paid === payrolls.length ? GREEN : ORANGE, msg: `${paid} of ${payrolls.length} salaries paid` },
    ...(ded > 0 ? [{ icon: TrendingUp, color: RED, msg: `${formatCurrency(ded)} deducted (${gross ? Math.round((ded / gross) * 100) : 0}% of gross)` }] : []),
    { icon: Users, color: PURPLE, msg: `Average net salary ${formatCurrency(Math.round(net / payrolls.length))}` },
    ...(missingSlip ? [{ icon: AlertTriangle, color: ORANGE, msg: `${missingSlip} paid salar${missingSlip > 1 ? "ies" : "y"} without slip receipt confirmed` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Payout Split" subtitle="Total for this month (₹K)" data={[{ label: "Gross", amt: Math.round(gross / 1000) }, { label: "Deductions", amt: Math.round(ded / 1000) }, { label: "Net", amt: Math.round(net / 1000) }]} series={[{ key: "amt", name: "₹K", color: BLUE }]} />
      <MiniBars title="Highest Net Pay" subtitle="Top 6 (₹K)" data={topPaid.map((p) => ({ label: p.employee?.firstName || "—", amt: Math.round(p.netSalary / 1000) }))} series={[{ key: "amt", name: "₹K", color: GREEN }]} />
    </PageInsights>
  );
}

export function LoansInsights({ loans }: { loans: any[] }) {
  if (!loans.length) return null;
  const live = loans.filter((l) => l.status === "active" || l.status === "paused");
  const outstanding = live.reduce((s, l) => s + (l.remainingBalance || 0), 0);
  const given = loans.filter((l) => l.status !== "pending" && l.status !== "rejected").reduce((s, l) => s + (l.amount || 0), 0);
  const pending = loans.filter((l) => l.status === "pending").length;
  const emi = live.reduce((s, l) => s + (l.monthlyEmi || 0), 0);
  const byStatus = count(loans, (l) => l.status);
  const biggest = [...live].sort((a, b) => b.remainingBalance - a.remainingBalance).slice(0, 6);
  const insights: Insight[] = [
    ...(pending ? [{ icon: AlertTriangle, color: ORANGE, msg: `${pending} request${pending > 1 ? "s" : ""} waiting for approval` }] : []),
    { icon: Banknote, color: BLUE, msg: `${formatCurrency(outstanding)} still to recover from ${live.length} running loans` },
    ...(given ? [{ icon: TrendingUp, color: GREEN, msg: `${Math.round(((given - outstanding) / given) * 100)}% of ${formatCurrency(given)} given has been recovered` }] : []),
    ...(emi ? [{ icon: IndianRupee, color: PURPLE, msg: `${formatCurrency(emi)} deducted from salaries every month` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="By Status" subtitle="All loans and advances" data={["pending", "active", "paused", "cleared", "rejected"].map((k) => ({ label: pretty(k), loans: byStatus[k] || 0 }))} series={[{ key: "loans", name: "Loans", color: BLUE }]} />
      <MiniBars title="Largest Balances" subtitle="Still to recover (₹K)" data={biggest.map((l) => ({ label: l.employee?.firstName || "—", amt: Math.round(l.remainingBalance / 1000) }))} series={[{ key: "amt", name: "₹K", color: RED }]} empty="No running loans" />
    </PageInsights>
  );
}

export function StaffAttendanceInsights({ records }: { records: any[] }) {
  if (!records.length) return null;
  const present = (r: any) => r.status === "present" || r.status === "late" || r.status === "half_day";
  const marked = records.filter((r) => !["holiday", "weekend"].includes(r.status));
  const rate = marked.length ? Math.round((marked.filter(present).length / marked.length) * 100) : 0;
  const late = records.filter((r) => r.status === "late");
  const absent = records.filter((r) => r.status === "absent");
  const lateBy = Object.entries(count(late, (r) => nameOf(r.employee))).sort((a, b) => b[1] - a[1]);
  const absentBy = Object.entries(count(absent, (r) => nameOf(r.employee))).sort((a, b) => b[1] - a[1]);
  const byDay: Record<string, { p: number; n: number }> = {};
  marked.forEach((r) => {
    const k = String(r.date).slice(0, 10);
    byDay[k] = byDay[k] || { p: 0, n: 0 };
    byDay[k].n++;
    if (present(r)) byDay[k].p++;
  });
  const trend = Object.entries(byDay).sort().slice(-14).map(([d, v]) => ({ label: d.slice(8) + "/" + d.slice(5, 7), rate: Math.round((v.p / v.n) * 100) }));
  const byStatus = count(records, (r) => r.status);
  const insights: Insight[] = [
    { icon: CheckCircle2, color: rate >= 85 ? GREEN : ORANGE, msg: `${rate}% staff attendance in this period` },
    ...(lateBy[0] ? [{ icon: Clock, color: YELLOW, msg: `${lateBy[0][0]} was late ${lateBy[0][1]} time${lateBy[0][1] > 1 ? "s" : ""}` }] : []),
    ...(absentBy[0] ? [{ icon: UserX, color: RED, msg: `${absentBy[0][0]} was absent ${absentBy[0][1]} time${absentBy[0][1] > 1 ? "s" : ""}` }] : []),
    ...(late.length ? [{ icon: AlertTriangle, color: ORANGE, msg: `${late.length} late check-ins, ${absent.length} absences` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniLine title="Daily Attendance" subtitle="% of staff present" data={trend} series={[{ key: "rate", name: "% present", color: GREEN }]} />
      <MiniBars title="Status Split" subtitle="Records in this period" data={["present", "late", "half_day", "absent", "on_leave"].map((k) => ({ label: pretty(k), n: byStatus[k] || 0 }))} series={[{ key: "n", name: "Records", color: BLUE }]} />
    </PageInsights>
  );
}

export function GroupsInsights({ groups }: { groups: any[] }) {
  if (!groups.length) return null;
  const active = groups.filter((g) => g.active);
  const students = groups.reduce((s, g) => s + (g.studentCount || 0), 0);
  const biggest = [...groups].sort((a, b) => b.studentCount - a.studentCount)[0];
  const rows = [...groups].sort((a, b) => b.studentCount - a.studentCount).slice(0, 8);
  const heavy = groups.filter((g) => g.coachCount > 0 && g.studentCount / g.coachCount > 20);
  const noCoach = groups.filter((g) => g.active && g.studentCount > 0 && !g.coachCount);
  const insights: Insight[] = [
    { icon: Users, color: BLUE, msg: `${students} students across ${active.length} active groups` },
    ...(biggest ? [{ icon: TrendingUp, color: GREEN, msg: `${biggest.name} is the largest group (${biggest.studentCount} students)` }] : []),
    ...(noCoach.length ? [{ icon: AlertTriangle, color: RED, msg: `${noCoach.length} group${noCoach.length > 1 ? "s have" : " has"} students but no coach: ${noCoach.slice(0, 3).map((g) => g.name).join(", ")}` }] : []),
    ...(heavy.length ? [{ icon: AlertTriangle, color: ORANGE, msg: `${heavy[0].name} has over 20 students per coach` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Students per Group" data={rows.map((g) => ({ label: g.name, students: g.studentCount }))} series={[{ key: "students", name: "Students", color: BLUE }]} />
      <MiniBars title="Fees This Month" subtitle="Collected vs pending (₹K)" data={rows.map((g) => ({ label: g.name, collected: Math.round((g.collectedThisMonth || 0) / 1000), pending: Math.round((g.remainingThisMonth || 0) / 1000) }))} series={[{ key: "collected", name: "Collected", color: GREEN }, { key: "pending", name: "Pending", color: RED }]} />
    </PageInsights>
  );
}

export function EventsInsights({ events }: { events: any[] }) {
  if (!events.length) return null;
  const byStatus = count(events, (e) => e.status);
  const byType = Object.entries(count(events, (e) => e.eventType || "Other")).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const next = events
    .filter((e) => e.schedule?.eventDate && new Date(e.schedule.eventDate).getTime() >= Date.now() && e.status !== "cancelled")
    .sort((a, b) => new Date(a.schedule.eventDate).getTime() - new Date(b.schedule.eventDate).getTime())[0];
  const insights: Insight[] = [
    { icon: Trophy, color: BLUE, msg: `${events.length} events, ${byStatus.completed || 0} completed` },
    ...(byStatus.registration_open ? [{ icon: CheckCircle2, color: GREEN, msg: `${byStatus.registration_open} event${byStatus.registration_open > 1 ? "s" : ""} open for registration` }] : []),
    ...(byStatus.live ? [{ icon: AlertTriangle, color: RED, msg: `${byStatus.live} event${byStatus.live > 1 ? "s" : ""} live right now` }] : []),
    ...(next ? [{ icon: CalendarClock, color: PURPLE, msg: `Next: ${next.name} on ${new Date(next.schedule.eventDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` }] : []),
    ...(byStatus.draft ? [{ icon: Flag, color: ORANGE, msg: `${byStatus.draft} draft event${byStatus.draft > 1 ? "s" : ""} not published yet` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="By Status" data={["draft", "registration_open", "upcoming", "live", "completed", "cancelled"].map((k) => ({ label: pretty(k).replace("Registration ", "Reg. "), events: byStatus[k] || 0 }))} series={[{ key: "events", name: "Events", color: BLUE }]} />
      <MiniBars title="By Type" data={byType.map(([k, v]) => ({ label: pretty(k), events: v }))} series={[{ key: "events", name: "Events", color: ORANGE }]} />
    </PageInsights>
  );
}

export function FacilitiesInsights({ facilities }: { facilities: any[] }) {
  if (!facilities.length) return null;
  const cap = facilities.reduce((s, f) => s + (f.capacity || 0), 0);
  const avg = Math.round(facilities.reduce((s, f) => s + (f.hourlyFee || 0), 0) / facilities.length);
  const priciest = [...facilities].sort((a, b) => b.hourlyFee - a.hourlyFee)[0];
  const free = facilities.filter((f) => !f.hourlyFee).length;
  const byType = Object.entries(count(facilities, (f) => f.type || "Other"));
  const insights: Insight[] = [
    { icon: MapPin, color: BLUE, msg: `${facilities.length} facilities with room for ${cap} people` },
    { icon: IndianRupee, color: GREEN, msg: `Average hourly fee ${formatCurrency(avg)}` },
    ...(priciest && priciest.hourlyFee ? [{ icon: TrendingUp, color: PURPLE, msg: `${priciest.name} is the priciest at ${formatCurrency(priciest.hourlyFee)}/hr` }] : []),
    ...(free ? [{ icon: Users, color: ORANGE, msg: `${free} facilit${free > 1 ? "ies are" : "y is"} free to book` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Capacity" subtitle="People per facility" data={facilities.slice(0, 8).map((f) => ({ label: f.name, capacity: f.capacity }))} series={[{ key: "capacity", name: "Capacity", color: BLUE }]} />
      <MiniBars title="Facility Types" data={byType.map(([k, v]) => ({ label: pretty(k), facilities: v }))} series={[{ key: "facilities", name: "Facilities", color: ORANGE }]} />
    </PageInsights>
  );
}

export function HolidaysInsights({ holidays }: { holidays: any[] }) {
  const list = holidays.filter((h) => h.isActive !== false);
  if (!list.length) return null;
  const now = Date.now();
  const upcoming = list.filter((h) => new Date(h.date).getTime() >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const byType = count(list, (h) => h.type);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const byMonth = MONTHS.map((m, i) => ({ label: m, holidays: list.filter((h) => new Date(h.date).getMonth() === i).length }));
  const next = upcoming[0];
  const insights: Insight[] = [
    { icon: CalendarDays, color: BLUE, msg: `${list.length} holidays, ${upcoming.length} still ahead` },
    ...(next ? [{ icon: CalendarClock, color: GREEN, msg: `Next: ${next.name} on ${new Date(next.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} (${Math.max(0, Math.ceil((new Date(next.date).getTime() - now) / 86400000))} days)` }] : []),
    { icon: Flag, color: RED, msg: `${byType.national || 0} national, ${byType.optional || 0} optional, ${byType.restricted || 0} restricted` },
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Holidays by Month" data={byMonth} series={[{ key: "holidays", name: "Holidays", color: BLUE }]} />
      <MiniBars title="By Type" data={["national", "optional", "restricted"].map((k) => ({ label: pretty(k), holidays: byType[k] || 0 }))} series={[{ key: "holidays", name: "Holidays", color: ORANGE }]} />
    </PageInsights>
  );
}

export function ParentAttendanceInsights({ records }: { records: any[] }) {
  if (!records.length) return null;
  const sorted = [...records].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const attended = (r: any) => r.status === "present" || r.status === "late";
  const n = sorted.length;
  const rate = Math.round((sorted.filter(attended).length / n) * 100);
  const absent = sorted.filter((r) => r.status === "absent");
  let best = 0;
  let run = 0;
  sorted.forEach((r) => {
    run = attended(r) ? run + 1 : 0;
    best = Math.max(best, run);
  });
  const weeks: Record<string, { p: number; n: number }> = {};
  sorted.forEach((r) => {
    const d = new Date(r.date);
    const k = `Wk ${Math.ceil(d.getDate() / 7)}`;
    weeks[k] = weeks[k] || { p: 0, n: 0 };
    weeks[k].n++;
    if (attended(r)) weeks[k].p++;
  });
  const insights: Insight[] = [
    { icon: CheckCircle2, color: rate >= 75 ? GREEN : ORANGE, msg: `Attended ${rate}% of ${n} sessions this month` },
    ...(best > 2 ? [{ icon: TrendingUp, color: BLUE, msg: `Longest streak: ${best} sessions in a row` }] : []),
    ...(absent.length ? [{ icon: UserX, color: RED, msg: `${absent.length} absence${absent.length > 1 ? "s" : ""}, last on ${new Date(absent[absent.length - 1].date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniLine className="md:col-span-2" title="Weekly Attendance" subtitle="% of sessions attended" data={Object.entries(weeks).map(([k, v]) => ({ label: k, rate: Math.round((v.p / v.n) * 100) }))} series={[{ key: "rate", name: "% attended", color: GREEN }]} />
    </PageInsights>
  );
}
