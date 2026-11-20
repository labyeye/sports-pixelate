// Owner/HR dashboard (web): KPI cards (headcount, payroll, subscription income),
// department chart and a subscriptions table with balance due. Currency and
// dates use the lib/utils formatters.

import { useState, useEffect, Fragment } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { dashboardAPI, loanAPI } from "@/services/api";
import { StatCard } from "@/components/ui/StatCard";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { FadeIn } from "@/components/motion/FadeIn";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency, formatDateOrDash } from "@/lib/utils";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  LabelList,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  Clock,
  CalendarDays,
  IndianRupee,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  AlertTriangle,
  ChevronRight,
  GraduationCap,
  Wallet,
  Bell,
} from "lucide-react";
import nesthrlogo from "../../assets/nesthr.png";
import { notifyError } from "@/hooks/use-toast";

function KpiCard({
  title,
  value,
  /** When set, the card counts up to this number instead of rendering `value` as-is. */
  numericValue,
  prefix,
  suffix,
  sub,
  icon: Icon,
  bg,
  iconColor = "text-white",
  trend,
  to,
}: {
  title: string;
  value: string | number;
  numericValue?: number;
  prefix?: string;
  suffix?: string;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  iconColor?: string;
  trend?: "up" | "down";
  to?: string;
}) {
  const color = bg.match(/#[0-9A-Fa-f]{6}/)?.[0] ?? "#024BAB";
  const displayValue =
    numericValue !== undefined ? (
      <AnimatedNumber value={numericValue} prefix={prefix} suffix={suffix} />
    ) : (
      value
    );
  const inner = (
    <StatCard
      label={title}
      value={displayValue}
      icon={Icon as LucideIcon}
      color={color}
      sub={sub}
    />
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

const DEPT_COLORS = [
  "#024BAB",
  "#FA731C",
  "#00C48C",
  "#A855F7",
  "#EF4444",
  "#FFD60A",
];

const NbTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black px-3 py-2 text-xs">
      <p className="font-bold text-black mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color }}
          />
          <span className="font-bold text-black capitalize">
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [expandedRenewal, setExpandedRenewal] = useState<string | null>(null);
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  useEffect(() => {
    loanAPI
      .getAll()
      .then((r: any) => setLoans(r.data || []))
      .catch(() => {});
  }, []);
  const [trendRange, setTrendRange] = useState<"1M" | "3M" | "6M" | "1Y">("6M");
  const [trend, setTrend] = useState<any>(null);
  useEffect(() => {
    dashboardAPI
      .getTrend(trendRange)
      .then((r: any) => r?.success && setTrend(r.data))
      .catch(() => {});
  }, [trendRange]);
  const [attTab, setAttTab] = useState<"students" | "staff">("students");
  const [joinTab, setJoinTab] = useState<"staff" | "students">("staff");
  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex h-[80vh] items-center justify-center">
          <img src={nesthrlogo} alt="NestAcademy" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  const {
    stats,
    recentHires,
    recentStudents = [],
    pendingLeaveList,
    deptHeadcounts,
    payTrend = [],
    feeSummary = { collected: 0, remaining: 0, expected: 0, bySport: {} },
    staffAttDaily = [],
    studentAttDaily = [],
    feeTrend = [],
    subscriptionAlerts = [],
    studentGrowth = [],
  } = data;

  const MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Attendance only makes sense once students or staff have been added.
  const hasStudents = (stats.totalStudents || 0) > 0;
  const hasStaff = (stats.totalEmployees || 0) > 0;
  const showAttendance = hasStudents || hasStaff;
  const activeAttTab =
    attTab === "students"
      ? hasStudents
        ? "students"
        : "staff"
      : hasStaff
        ? "staff"
        : "students";
  const dailyChartData = (
    activeAttTab === "students" ? studentAttDaily : staffAttDaily
  )
    .slice(-7)
    .map((d: any) => ({
      label: d.label,
      Present: d.present || 0,
      Late: d.late || 0,
      "Half day": d.halfDay || 0,
      "On leave": d.onLeave || 0,
      Absent: d.absent || 0,
    }));

  const sportChartData = Object.entries(feeSummary.bySport || {})
    .map(([name, v]: [string, any]) => ({
      name: name || "Other",
      Collected: Math.round((v.collected || 0) / 1000),
      Pending: Math.round((v.remaining || 0) / 1000),
    }))
    .sort((a, b) => b.Collected + b.Pending - (a.Collected + a.Pending))
    .slice(0, 6);

  const payChartData = payTrend.map((t: any) => ({
    label: MONTH_LABELS[t.month - 1],
    total: Math.round(t.total / 1000),
  }));

  const feeChartData = feeTrend.map((t: any) => ({
    label: MONTH_LABELS[t.month - 1],
    paid: t.paidOnTime,
    late: t.notOnTime,
  }));

  const collectionRate = feeSummary.expected
    ? Math.round((feeSummary.collected / feeSummary.expected) * 100)
    : 0;
  const studentAttPct = stats.totalStudents
    ? Math.round(
        ((stats.studentsPresentToday || 0) / stats.totalStudents) * 100,
      )
    : 0;
  const lastFeeMonth = [...feeTrend]
    .reverse()
    .find((t: any) => t.paidOnTime + t.notOnTime > 0);
  const onTimePct = lastFeeMonth
    ? Math.round(
        (lastFeeMonth.paidOnTime /
          (lastFeeMonth.paidOnTime + lastFeeMonth.notOnTime)) *
          100,
      )
    : null;
  const topSport = [...sportChartData].sort(
    (a, b) => b.Collected - a.Collected,
  )[0];
  const insights = [
    {
      icon: Wallet,
      color: collectionRate >= 70 ? "#00C48C" : "#FA731C",
      msg: `${collectionRate}% of this month's fees collected (${formatCurrency(feeSummary.collected)} of ${formatCurrency(feeSummary.expected)})`,
      time: "This month",
    },
    ...(hasStudents
      ? [
          {
            icon: GraduationCap,
            color: studentAttPct >= 75 ? "#00C48C" : "#EF4444",
            msg: `${stats.studentsPresentToday || 0} of ${stats.totalStudents} students present today (${studentAttPct}%)`,
            time: "Today",
          },
        ]
      : []),
    ...(onTimePct !== null
      ? [
          {
            icon: CheckCircle2,
            color: onTimePct >= 70 ? "#00C48C" : "#EF4444",
            msg: `${onTimePct}% of ${MONTH_LABELS[lastFeeMonth.month - 1]} fees were paid on time`,
            time: "Last due month",
          },
        ]
      : []),
    ...(topSport && topSport.Collected > 0
      ? [
          {
            icon: TrendingUp,
            color: "#024BAB",
            msg: `${topSport.name} brings in the most: ₹${topSport.Collected}K collected`,
            time: "This month",
          },
        ]
      : []),
    ...(stats.endingSoon > 0
      ? [
          {
            icon: AlertTriangle,
            color: "#FA731C",
            msg: `${stats.endingSoon} subscription${stats.endingSoon > 1 ? "s" : ""} ending soon or overdue`,
            time: "Next 7 days",
          },
        ]
      : []),
    ...(stats.newStudents > 0
      ? [
          {
            icon: Users,
            color: "#A855F7",
            msg: `${stats.newStudents} new student${stats.newStudents > 1 ? "s" : ""} joined this month`,
            time: "This month",
          },
        ]
      : []),
  ];

  const sysNotifications = [
    ...(stats.pendingLeaves > 0
      ? [
          {
            icon: CalendarDays,
            color: "#FA731C",
            msg: `${stats.pendingLeaves} leave request${stats.pendingLeaves > 1 ? "s" : ""} pending approval`,
            time: "Now",
          },
        ]
      : []),
    ...(stats.newHires > 0
      ? [
          {
            icon: Users,
            color: "#00C48C",
            msg: `${stats.newHires} new hire${stats.newHires > 1 ? "s" : ""} joined this month`,
            time: "This month",
          },
        ]
      : []),
    {
      icon: CheckCircle2,
      color: "#00C48C",
      msg: `Attendance rate: ${stats.attendanceRate}% today`,
      time: "Today",
    },
  ];

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <AppLayout title="Dashboard">
      {}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            {greeting}, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Here's how your academy is doing today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/students">
            <button className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" /> Students
            </button>
          </Link>
          <Link to="/subscriptions">
            <button className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Fees
            </button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(stats.endingSoon > 0 ||
        feeSummary.remaining > 0 ||
        stats.pendingLeaves > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 border-2 border-[#FA731C] bg-[#FA731C]/5">
          <span className="text-xs font-bold text-[#FA731C] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Action needed
          </span>
          {feeSummary.remaining > 0 && (
            <Link to="/subscriptions">
              <span className="border-2 p-1 flex items-center gap-1 text-[11px]">
                <Wallet className="w-3 h-3" />{" "}
                {formatCurrency(feeSummary.remaining)} fees pending
              </span>
            </Link>
          )}
          {stats.endingSoon > 0 && (
            <Link to="/subscriptions">
              <span className="border-2 p-1 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3" /> {stats.endingSoon} renewals due
              </span>
            </Link>
          )}
          {stats.pendingLeaves > 0 && (
            <Link to="/leave">
              <span className="border-2 p-1 flex items-center gap-1 text-[11px]">
                <CalendarDays className="w-3 h-3" /> {stats.pendingLeaves} leave
                requests
              </span>
            </Link>
          )}
        </div>
      )}

      {/* KPI cards: only what matters at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          {
            title: "Students",
            numericValue: stats.totalStudents,
            sub: `${stats.activeSubscriptions || 0} active subscriptions`,
            icon: GraduationCap,
            bg: "bg-[#A855F7]",
            to: "/students",
          },
          {
            title: "Present Today",
            numericValue: stats.studentsPresentToday || 0,
            suffix: ` / ${stats.totalStudents}`,
            sub: `${studentAttPct}% student attendance`,
            icon: Clock,
            bg: "bg-[#FA731C]",
            to: "/student-attendance",
          },
          {
            title: "Collected",
            value: formatCurrency(feeSummary.collected),
            sub: `${collectionRate}% of expected`,
            icon: Wallet,
            bg: "bg-[#00C48C]",
            to: "/subscriptions",
          },
          {
            title: "Fees Pending",
            value: formatCurrency(feeSummary.remaining),
            sub: `${stats.endingSoon || 0} renewals due`,
            icon: IndianRupee,
            bg: "bg-[#EF4444]",
            to: "/subscriptions",
          },
        ].map((card, i) => (
          <FadeIn key={card.title} delay={i * 0.05}>
            <KpiCard value="" {...card} />
          </FadeIn>
        ))}
      </div>
      {/* Income vs expense, one curved line each */}
      <div className="border-2 bg-white p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="font-display font-bold text-base text-black">
              Income vs Expense
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {formatCurrency(trend?.totals?.income || 0)} in ·{" "}
              {formatCurrency(trend?.totals?.expense || 0)} out, last{" "}
              {trendRange}
            </p>
          </div>
          <div className="flex border-2 border-black no-nb">
            {(["1M", "3M", "6M", "1Y"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTrendRange(r)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-bold",
                  trendRange === r
                    ? "bg-black text-white"
                    : "bg-white text-black",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {trend?.points?.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={trend.points}
              margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(n: number) =>
                  n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
                }
              />
              <Tooltip content={<NbTooltip />} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
              />
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#00C48C"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-in-out"
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Expense"
                stroke="#EF4444"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-in-out"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
            No data for this period
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Fees trend: instalments paid on time vs late, last 6 months */}
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Fees Trend
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Paid on time vs late — last 6 months
          </p>
          {feeChartData.some((d: any) => d.paid || d.late) ? (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart
                data={feeChartData}
                margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  allowDecimals={false}
                  domain={[
                    0,
                    (max: number) => Math.max(4, Math.ceil(max * 1.15)),
                  ]}
                />
                <Tooltip content={<NbTooltip />} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
                {[
                  { key: "paid", name: "On time", color: "#00C48C", begin: 0 },
                  { key: "late", name: "Late", color: "#EF4444", begin: 150 },
                ].map(({ key, name, color, begin }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={name}
                    stroke={color}
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: color,
                      stroke: "#0A0A0A",
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                    animationDuration={900}
                  >
                    <LabelList
                      dataKey={key}
                      position="top"
                      offset={8}
                      style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
              No fee data yet
            </div>
          )}
        </div>

        {showAttendance && (
          <>
            {/* Daily attendance, last 7 days (students / staff) */}
            <div className="border-2 bg-white p-5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-display font-bold text-base text-black">
                  Daily Attendance
                </h3>
                <div
                  className={cn(
                    "border-2 border-black",
                    hasStudents && hasStaff ? "flex" : "hidden",
                  )}
                >
                  {(["students", "staff"] as const)
                    .filter((k) => (k === "students" ? hasStudents : hasStaff))
                    .map((k) => (
                      <button
                        key={k}
                        onClick={() => setAttTab(k)}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold capitalize",
                          activeAttTab === k
                            ? "bg-black text-white"
                            : "bg-white text-black",
                        )}
                      >
                        {k}
                      </button>
                    ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Present, late, half day, leave &amp; absent — last 7 days
              </p>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart
                    key={activeAttTab}
                    data={dailyChartData}
                    margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                      domain={[
                        0,
                        (max: number) => Math.max(4, Math.ceil(max * 1.15)),
                      ]}
                    />
                    <Tooltip content={<NbTooltip />} />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                    />
                    {[
                      { key: "Absent", color: "#EF4444", begin: 300 },
                      { key: "Late", color: "#CA8A04", begin: 150 },
                      { key: "Half day", color: "#F59E0B", begin: 200 },
                      { key: "On leave", color: "#3B82F6", begin: 250 },
                      { key: "Present", color: "#00C48C", begin: 0 },
                    ].map(({ key, color, begin }) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={color}
                        strokeWidth={3}
                        dot={{
                          r: 4,
                          fill: color,
                          stroke: "#0A0A0A",
                          strokeWidth: 1.5,
                        }}
                        activeDot={{
                          r: 6,
                          stroke: "#0A0A0A",
                          strokeWidth: 1.5,
                        }}
                        animationDuration={900}
                      >
                        <LabelList
                          dataKey={key}
                          position="top"
                          offset={8}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fill: "#0A0A0A",
                          }}
                        />
                      </Line>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
                  No attendance data yet
                </div>
              )}
            </div>
          </>
        )}

        {/* 6-month Payroll Trend */}
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Payroll Trend
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Net payout (₹K) — last 6 months
          </p>
          {payChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={payChartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C48C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00C48C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                />
                <Tooltip
                  content={<NbTooltip />}
                  cursor={{ fill: "#00C48C11" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="₹K"
                  stroke="#00C48C"
                  strokeWidth={2}
                  fill="url(#payGrad)"
                  dot={{ fill: "#00C48C", strokeWidth: 2, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
              No trend data yet
            </div>
          )}
        </div>
      </div>

      {/* New vs repeat students, last 6 months */}
      <div className="border-2 bg-white p-5 mb-4">
        <h3 className="font-display font-bold text-base text-black mb-1">
          Student Growth
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          New registrations vs students who subscribed again, last 6 months
        </p>
        {studentGrowth.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={studentGrowth}
              margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                tickLine={false}
                axisLine={false}
                width={32}
                domain={[
                  0,
                  (max: number) => Math.max(4, Math.ceil(max * 1.15)),
                ]}
              />
              <Tooltip content={<NbTooltip />} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
              />
              <Line
                type="monotone"
                dataKey="newStudents"
                name="New students"
                stroke="#A855F7"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "#A855F7",
                  stroke: "#0A0A0A",
                  strokeWidth: 1.5,
                }}
                activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                animationDuration={900}
              >
                <LabelList
                  dataKey="newStudents"
                  position="top"
                  offset={8}
                  style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="repeatStudents"
                name="Repeat students"
                stroke="#00C48C"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "#00C48C",
                  stroke: "#0A0A0A",
                  strokeWidth: 1.5,
                }}
                activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                animationDuration={900}
              >
                <LabelList
                  dataKey="repeatStudents"
                  position="top"
                  offset={8}
                  style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No data yet</p>
        )}
      </div>

      {/* Recent loans & advances */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Recent loans & advances */}
        <div className="lg:col-span-5 border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-bold text-base text-black">
              Recent Loans & Advances
            </h3>
            <Link to="/loans" className="text-xs font-bold text-[#024BAB]">
              View all
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Latest given, with balance still to recover
          </p>
          {(() => {
            const rows = loans
              .filter(
                (l) =>
                  l.status === "active" ||
                  l.status === "cleared" ||
                  l.status === "paused",
              )
              .sort(
                (a, b) =>
                  new Date(b.disbursedOn ?? 0).getTime() -
                  new Date(a.disbursedOn ?? 0).getTime(),
              )
              .slice(0, 6);
            if (!rows.length)
              return (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-bold">
                  No loans given yet
                </div>
              );
            return (
              <div className="divide-y divide-black/10">
                {rows.map((l) => (
                  <div
                    key={l._id}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-black">
                        {l.employee?.firstName} {l.employee?.lastName}{" "}
                        <span className="font-normal text-gray-500">
                          · {l.type}
                        </span>
                      </p>
                      <p className="text-gray-500">
                        {l.disbursedOn
                          ? new Date(l.disbursedOn).toLocaleDateString("en-IN")
                          : "—"}
                        {l.monthlyEmi > 0
                          ? ` · EMI ${formatCurrency(l.monthlyEmi)}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-black">
                        {formatCurrency(l.amount)}
                      </p>
                      <p
                        className={
                          l.remainingBalance > 0
                            ? "font-bold text-red-600"
                            : "font-bold text-green-600"
                        }
                      >
                        {l.remainingBalance > 0
                          ? `${formatCurrency(l.remainingBalance)} left`
                          : "Cleared"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Dept chart + Notifications row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        {/* Department headcount */}
        <div className="lg:col-span-3 border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Headcount by Dept
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Active employees per department
          </p>
          {deptHeadcounts?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={deptHeadcounts}
                  margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E5E7EB"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: "#0A0A0A" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    domain={[
                      0,
                      (max: number) => Math.max(4, Math.ceil(max * 1.15)),
                    ]}
                  />
                  <Tooltip content={<NbTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Employees"
                    stroke="#024BAB"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#024BAB",
                      stroke: "#0A0A0A",
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
                    animationDuration={900}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      offset={8}
                      style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {deptHeadcounts.map((d: any, i: number) => (
                  <span
                    key={d.name}
                    className="flex items-center gap-1 text-[11px] font-bold text-black"
                  >
                    <span
                      className="w-2.5 h-2.5 border border-black shrink-0"
                      style={{
                        background: DEPT_COLORS[i % DEPT_COLORS.length],
                      }}
                    />
                    {d.name} ({d.count})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-bold">
              No data yet
            </div>
          )}
        </div>

        {/* Notifications panel */}
        <div className="lg:col-span-2 border-2 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-black" />
            <h3 className="font-display font-bold text-base text-black">
              Notifications
            </h3>
          </div>
          <div className="space-y-3">
            {sysNotifications.map((n, i) => {
              const Icon = n.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 border-b border-black/5 pb-3 last:border-0 last:pb-0"
                >
                  <div
                    className="w-7 h-7 border-2 border-black flex items-center justify-center shrink-0"
                    style={{ background: n.color }}
                  >
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-black leading-snug">
                      {n.msg}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {n.time}
                    </p>
                  </div>
                </div>
              );
            })}
            {sysNotifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mb-1.5 opacity-30" />
                <p className="text-xs font-bold">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscription alerts */}
      <div className="border-2 bg-white p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-base text-black flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FA731C]" />
              Subscription Renewals
            </h3>
            <p className="text-xs text-muted-foreground">
              Ending within 7 days or already past due
            </p>
          </div>
          <Link to="/subscriptions">
            <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors">
              Manage →
            </button>
          </Link>
        </div>
        {subscriptionAlerts?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  {["Student", "Plan", "Days", "Balance", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-2 pr-4 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {subscriptionAlerts.map((sub: any) => {
                  const renewal = new Date(sub.renewalDate);
                  const msPerDay = 86400000;
                  const days = Math.ceil(
                    (renewal.getTime() - Date.now()) / msPerDay,
                  );
                  const isPastDue = days < 0;
                  const balance = Math.max(
                    0,
                    (sub.amount || 0) - (sub.amountPaid || 0),
                  );
                  const guardian = sub.student?.guardians?.[0];
                  const open = expandedRenewal === sub._id;
                  return (
                    <Fragment key={sub._id}>
                      <tr className="border-b border-black/10 last:border-0 align-top">
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {sub.student?.avatar ? (
                              <img
                                src={sub.student.avatar}
                                alt=""
                                className="w-8 h-8 border-2 border-black object-cover rounded-full shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-[#024BAB] border-2 border-black rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {sub.student?.firstName?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-black">
                                {sub.student?.firstName} {sub.student?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sub.student?.studentId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <p className="font-medium text-black">
                            {sub.planName}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {sub.billingCycle || "—"}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span
                            className={cn(
                              "font-bold",
                              isPastDue ? "text-[#EF4444]" : "text-[#FA731C]",
                            )}
                          >
                            {isPastDue
                              ? `${Math.abs(days)}d overdue`
                              : days === 0
                                ? "Today"
                                : `${days}d left`}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "py-2.5 pr-4 whitespace-nowrap font-bold",
                            balance > 0
                              ? "text-[#EF4444]"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(balance)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 border-2 border-black uppercase whitespace-nowrap",
                              isPastDue
                                ? "bg-[#EF4444] text-white"
                                : "bg-[#FA731C] text-white",
                            )}
                          >
                            {isPastDue ? "Ended" : "Ending Soon"}
                          </span>
                        </td>
                        <td className="py-2.5 w-8">
                          <button
                            onClick={() =>
                              setExpandedRenewal(open ? null : sub._id)
                            }
                            title="Details"
                            className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          >
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                open && "rotate-180",
                              )}
                            />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-black/10 bg-[#F8FAFF] animate-in fade-in slide-in-from-top-1 duration-200">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Sport / Batch
                                </p>
                                <p className="font-medium text-black">
                                  {sub.student?.sport || "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {sub.student?.batch || "No batch"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Period
                                </p>
                                <p>{formatDateOrDash(sub.startDate)}</p>
                                <p className="font-bold text-black">
                                  → {formatDateOrDash(sub.renewalDate)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Amount
                                </p>
                                {formatCurrency(sub.amount || 0)}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Paid
                                </p>
                                {formatCurrency(sub.amountPaid || 0)}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Payment
                                </p>
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 border-2 border-black uppercase whitespace-nowrap",
                                    sub.paymentStatus === "completed"
                                      ? "bg-[#00C48C] text-black"
                                      : "bg-[#FFD60A] text-black",
                                  )}
                                >
                                  {sub.paymentStatus === "completed"
                                    ? "Paid"
                                    : sub.paymentStatus || "Pending"}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                  Guardian
                                </p>
                                {guardian ? (
                                  <>
                                    <p className="font-medium text-black">
                                      {guardian.name}
                                    </p>
                                    {guardian.phone ? (
                                      <a
                                        href={`tel:${guardian.phone}`}
                                        className="text-[#024BAB] font-bold hover:underline"
                                      >
                                        {guardian.phone}
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        No phone
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 text-center text-muted-foreground">
            <CheckCircle2 className="w-6 h-6 mb-1.5 opacity-30" />
            <p className="text-xs font-bold">No subscriptions ending soon</p>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent joinings (staff + students) */}
        <div className="border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Recent Joinings
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.newHires} staff · {stats.newStudents ?? 0} students this
                month
              </p>
            </div>
            <Link to={joinTab === "staff" ? "/employees" : "/students"}>
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors">
                View all →
              </button>
            </Link>
          </div>
          <div className="flex border-2 border-black mb-3 no-nb">
            {(
              [
                ["staff", "Staff"],
                ["students", "Students"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setJoinTab(key)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  key === "students" && "border-l-2 border-black",
                  joinTab === key
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#024BAB]/5",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {(joinTab === "staff" ? recentHires : recentStudents)?.length > 0 ? (
            <div className="space-y-2">
              {(joinTab === "staff" ? recentHires : recentStudents)
                .slice(0, 5)
                .map((p: any) => (
                  <Link
                    key={p._id}
                    to={joinTab === "staff" ? "/employees" : "/students"}
                  >
                    <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black transition-all">
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt={p.firstName}
                          className="w-8 h-8 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {p.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-black truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {joinTab === "staff"
                            ? `${p.designation || "Staff"} · ${p.department?.name || "—"}`
                            : `${p.sport || "—"}${p.batch ? ` · ${p.batch}` : ""} · ${p.studentId}`}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                        {new Date(
                          joinTab === "staff" ? p.joinDate : p.enrollmentDate,
                        ).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-bold">
                No new {joinTab === "staff" ? "hires" : "students"} this month
              </p>
            </div>
          )}
        </div>

        {/* Pending leaves */}
        <div className="border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Pending Leave Requests
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.pendingLeaves} awaiting action
              </p>
            </div>
            <Link to="/leave">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors">
                Manage →
              </button>
            </Link>
          </div>
          {pendingLeaveList?.length > 0 ? (
            <div className="space-y-2">
              {pendingLeaveList.slice(0, 5).map((leave: any) => (
                <Link key={leave._id} to="/leave">
                  <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black hover: transition-all">
                    {leave.employee?.avatar ? (
                      <img
                        src={leave.employee.avatar}
                        alt={leave.employee?.firstName}
                        className="w-8 h-8 border-2 border-black object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-[#FA731C] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {leave.employee?.firstName?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {leave.employee?.firstName} {leave.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate capitalize">
                        {leave.leaveType} · {leave.days} day
                        {leave.days > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="border-2 text-[10px]">Pending</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <CheckCircle2 className="w-8 h-8 mb-2 text-[#00C48C]" />
              <p className="text-sm font-bold text-black">All clear!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No pending leave requests
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
