import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  IndianRupee,
  Package,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { insightsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
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

const pretty = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const useOwner = () => {
  const { user } = useAuth();
  return user?.role === "super_admin" || user?.role === "hr_manager";
};

/** Fetches once; stays silent (renders nothing) if the call fails. */
function useInsight<T>(load: () => Promise<any>, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((r) => alive && r?.success && setData(r.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return data;
}

export function StudentsInsights() {
  const d = useInsight<any>(insightsAPI.students, useOwner());
  if (!d || !d.total) return null;
  const top = d.bySport?.[0];
  const insights: Insight[] = [
    { icon: GraduationCap, color: BLUE, msg: `${d.active} active of ${d.total} students` },
    ...(d.newThisMonth > 0
      ? [{ icon: TrendingUp, color: GREEN, msg: `${d.newThisMonth} new student${d.newThisMonth > 1 ? "s" : ""} joined this month`, time: "This month" }]
      : []),
    ...(d.withoutSubscription > 0
      ? [{ icon: Wallet, color: ORANGE, msg: `${d.withoutSubscription} active student${d.withoutSubscription > 1 ? "s have" : " has"} no running subscription` }]
      : []),
    ...(d.inactive + d.onHold > 0
      ? [{ icon: UserX, color: RED, msg: `${d.inactive} inactive, ${d.onHold} on hold` }]
      : []),
    ...(top ? [{ icon: Users, color: PURPLE, msg: `${top.name} is the biggest sport with ${top.value} students` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniLine title="New Students" subtitle="Joined per month, last 6 months" data={d.joins.map((j: any) => ({ label: j.label, joined: j.value }))} series={[{ key: "joined", name: "Joined", color: PURPLE }]} />
      <MiniBars title="Students by Sport" subtitle="Active students" data={d.bySport.map((s: any) => ({ label: s.name, students: s.value }))} series={[{ key: "students", name: "Students", color: BLUE }]} />
    </PageInsights>
  );
}

export function PlansInsights() {
  const d = useInsight<any>(insightsAPI.plans, useOwner());
  if (!d || !d.plans?.length) return null;
  const top = d.plans[0];
  const totalRev = d.plans.reduce((s: number, p: any) => s + p.revenue, 0);
  const insights: Insight[] = [
    { icon: Users, color: BLUE, msg: `${d.totalSubscribers} running subscriptions across ${d.plans.length} plans` },
    { icon: TrendingUp, color: GREEN, msg: `${top.name} is most popular with ${top.subscribers} subscribers` },
    { icon: IndianRupee, color: PURPLE, msg: `${formatCurrency(totalRev)} billed on running subscriptions` },
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Subscribers per Plan" subtitle="Running subscriptions" data={d.plans.map((p: any) => ({ label: p.name, subscribers: p.subscribers }))} series={[{ key: "subscribers", name: "Subscribers", color: BLUE }]} />
      <MiniBars title="Revenue per Plan" subtitle="Billed amount (₹K)" data={d.plans.map((p: any) => ({ label: p.name, revenue: Math.round(p.revenue / 1000) }))} series={[{ key: "revenue", name: "₹K", color: GREEN }]} />
    </PageInsights>
  );
}

export function ExpensesInsights() {
  const d = useInsight<any>(insightsAPI.expenses, useOwner());
  if (!d || !d.trend?.some((t: any) => t.value)) return null;
  const cur = d.trend[d.trend.length - 1].value;
  const prev = d.trend[d.trend.length - 2]?.value || 0;
  const change = prev ? Math.round(((cur - prev) / prev) * 100) : null;
  const top = d.categories?.[0];
  const insights: Insight[] = [
    { icon: IndianRupee, color: BLUE, msg: `₹${cur}K spent this month` },
    ...(change !== null
      ? [{ icon: change > 0 ? TrendingUp : TrendingDown, color: change > 0 ? RED : GREEN, msg: `${Math.abs(change)}% ${change > 0 ? "more" : "less"} than last month (₹${prev}K)` }]
      : []),
    ...(top ? [{ icon: Package, color: ORANGE, msg: `${pretty(top.name)} is the biggest cost: ₹${top.value}K` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniLine title="Spend Trend" subtitle="₹K per month, last 6 months" data={d.trend.map((t: any) => ({ label: t.label, spend: t.value }))} series={[{ key: "spend", name: "₹K", color: RED }]} />
      <MiniBars title="By Category" subtitle="This month (₹K)" data={d.categories.map((c: any) => ({ label: pretty(c.name).split(" ")[0], spend: c.value }))} series={[{ key: "spend", name: "₹K", color: ORANGE }]} />
    </PageInsights>
  );
}

export function StudentAttendanceInsights() {
  const d = useInsight<any>(insightsAPI.studentAttendance, useOwner());
  if (!d || !d.trend?.length) return null;
  const avg = Math.round(d.trend.reduce((s: number, t: any) => s + t.value, 0) / d.trend.length);
  const insights: Insight[] = [
    { icon: CheckCircle2, color: avg >= 75 ? GREEN : ORANGE, msg: `${avg}% average attendance over the last ${d.trend.length} marked days` },
    ...d.lowAttendance.slice(0, 4).map((s: any) => ({
      icon: AlertTriangle,
      color: s.rate < 50 ? RED : ORANGE,
      msg: `${s.name} (${s.sport}) attended only ${s.rate}% in the last 30 days`,
    })),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniLine className="md:col-span-2" title="Attendance Rate" subtitle="% of marked students present, recent days" data={d.trend.map((t: any) => ({ label: t.label, rate: t.value }))} series={[{ key: "rate", name: "% present", color: GREEN }]} />
    </PageInsights>
  );
}

export function SubscriptionsInsights({ subscriptions }: { subscriptions: any[] }) {
  if (!subscriptions.length) return null;
  const now = Date.now();
  const DAY = 86400000;
  const live = subscriptions.filter((s) => s.status === "active" || s.status === "pending_renewal");
  const paid = live.reduce((s, x) => s + (x.amountPaid || 0), 0);
  const billed = live.reduce((s, x) => s + (x.amount || 0), 0);
  const overdue = live.filter((s) => new Date(s.renewalDate).getTime() < now && s.paymentStatus !== "completed");
  const dueWeek = live.filter((s) => {
    const t = new Date(s.renewalDate).getTime();
    return t >= now && t < now + 7 * DAY;
  });
  const payBuckets = ["completed", "partial", "pending"].map((k) => ({
    label: pretty(k === "completed" ? "paid" : k),
    count: subscriptions.filter((s) => s.paymentStatus === k).length,
  }));
  const weeks = [0, 1, 2, 3].map((w) => ({
    label: w === 0 ? "This wk" : `+${w} wk`,
    due: live.filter((s) => {
      const t = new Date(s.renewalDate).getTime();
      return t >= now + w * 7 * DAY && t < now + (w + 1) * 7 * DAY;
    }).length,
  }));
  const insights: Insight[] = [
    { icon: Wallet, color: GREEN, msg: `${formatCurrency(paid)} paid of ${formatCurrency(billed)} billed (${billed ? Math.round((paid / billed) * 100) : 0}%)` },
    ...(billed - paid > 0 ? [{ icon: IndianRupee, color: ORANGE, msg: `${formatCurrency(billed - paid)} still to collect` }] : []),
    ...(overdue.length ? [{ icon: AlertTriangle, color: RED, msg: `${overdue.length} subscription${overdue.length > 1 ? "s are" : " is"} past renewal and unpaid` }] : []),
    ...(dueWeek.length ? [{ icon: CalendarClock, color: BLUE, msg: `${dueWeek.length} renewal${dueWeek.length > 1 ? "s" : ""} due in the next 7 days` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Payment Status" subtitle="All subscriptions" data={payBuckets} series={[{ key: "count", name: "Subscriptions", color: BLUE }]} />
      <MiniBars title="Renewals Ahead" subtitle="Due in the next 4 weeks" data={weeks} series={[{ key: "due", name: "Renewals", color: ORANGE }]} />
    </PageInsights>
  );
}

export function BookingsInsights({ bookings }: { bookings: any[] }) {
  const active = bookings.filter((b) => b.status !== "cancelled");
  if (!active.length) return null;
  const byFacility: Record<string, { n: number; fee: number }> = {};
  active.forEach((b) => {
    const k = b.facility?.name || "Other";
    byFacility[k] = byFacility[k] || { n: 0, fee: 0 };
    byFacility[k].n++;
    byFacility[k].fee += b.fee || 0;
  });
  const facRows = Object.entries(byFacility).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  const hours: Record<string, number> = {};
  active.forEach((b) => {
    const h = (b.startTime || "").slice(0, 2);
    if (h) hours[h] = (hours[h] || 0) + 1;
  });
  const peak = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
  const unpaid = active.filter((b) => b.paymentStatus !== "paid" && b.fee > 0);
  const revenue = active.reduce((s, b) => s + (b.fee || 0), 0);
  const insights: Insight[] = [
    { icon: CalendarClock, color: BLUE, msg: `${active.length} bookings, ${formatCurrency(revenue)} total` },
    ...(facRows[0] ? [{ icon: TrendingUp, color: GREEN, msg: `${facRows[0][0]} is booked most (${facRows[0][1].n})` }] : []),
    ...(peak ? [{ icon: Users, color: PURPLE, msg: `Busiest start hour is ${peak[0]}:00 (${peak[1]} bookings)` }] : []),
    ...(unpaid.length ? [{ icon: AlertTriangle, color: ORANGE, msg: `${unpaid.length} booking${unpaid.length > 1 ? "s" : ""} not paid yet` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Bookings by Facility" subtitle="Excludes cancelled" data={facRows.map(([n, v]) => ({ label: n, bookings: v.n }))} series={[{ key: "bookings", name: "Bookings", color: BLUE }]} />
      <MiniBars title="Revenue by Facility" subtitle="₹K" data={facRows.map(([n, v]) => ({ label: n, revenue: Math.round(v.fee / 1000) }))} series={[{ key: "revenue", name: "₹K", color: GREEN }]} />
    </PageInsights>
  );
}

export function InventoryInsights({ items }: { items: any[] }) {
  if (!items.length) return null;
  const low = items.filter((i) => i.availableQuantity <= i.reorderThreshold);
  const out = items.filter((i) => i.availableQuantity === 0);
  const value = items.reduce((s, i) => s + (i.unitCost || 0) * (i.totalQuantity || 0), 0);
  const cat: Record<string, number> = {};
  items.forEach((i) => (cat[i.category || "Other"] = (cat[i.category || "Other"] || 0) + (i.totalQuantity || 0)));
  const catRows = Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const lowRows = [...low].sort((a, b) => a.availableQuantity - b.availableQuantity).slice(0, 6);
  const insights: Insight[] = [
    { icon: Package, color: BLUE, msg: `${items.length} items, ${items.reduce((s, i) => s + i.availableQuantity, 0)} units available` },
    ...(out.length ? [{ icon: AlertTriangle, color: RED, msg: `${out.length} item${out.length > 1 ? "s are" : " is"} out of stock` }] : []),
    ...(low.length ? [{ icon: TrendingDown, color: ORANGE, msg: `${low.length} item${low.length > 1 ? "s" : ""} at or below reorder level: ${lowRows.slice(0, 3).map((i) => i.name).join(", ")}` }] : []),
    ...(value > 0 ? [{ icon: IndianRupee, color: GREEN, msg: `${formatCurrency(value)} of stock at cost` }] : []),
  ];
  return (
    <PageInsights insights={insights}>
      <MiniBars title="Stock by Category" subtitle="Total units" data={catRows.map(([n, v]) => ({ label: n, units: v }))} series={[{ key: "units", name: "Units", color: BLUE }]} />
      <MiniBars title="Running Low" subtitle="Available vs reorder level" data={lowRows.map((i) => ({ label: i.name, available: i.availableQuantity, reorder: i.reorderThreshold }))} series={[{ key: "available", name: "Available", color: RED }, { key: "reorder", name: "Reorder at", color: ORANGE }]} empty="Nothing running low" />
    </PageInsights>
  );
}
