import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { dashboardAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  Clock,
  CalendarDays,
  IndianRupee,
  Briefcase,
  Building2,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Bell,
  UserCheck,
  UserX,
  Coffee,
  GraduationCap,
  BookOpen,
  Wallet,
} from "lucide-react";
import nesthrlogo from "../../assets/nesthr.png";
function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  bg,
  iconColor = "text-white",
  trend,
  to,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  iconColor?: string;
  trend?: "up" | "down";
  to?: string;
}) {
  const inner = (
    <div className="border-2 p-4 flex flex-col gap-3 bg-white">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
            bg,
          )}
        >
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 border-2 border-black bg-[#A3E635] text-black">
            <ArrowUpRight className="w-3 h-3" />
          </span>
        )}
      </div>
      <div>
        <p className="font-display font-bold text-3xl text-black">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
          {title}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
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
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex h-[80vh] items-center justify-center">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  const {
    stats,
    recentHires,
    pendingLeaveList,
    deptHeadcounts,
    attTrend = [],
    payTrend = [],
    subscriptionAlerts = [],
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

  const attChartData = attTrend.map((t: any) => ({
    label: MONTH_LABELS[t.month - 1],
    count: t.count,
  }));

  const payChartData = payTrend.map((t: any) => ({
    label: MONTH_LABELS[t.month - 1],
    total: Math.round(t.total / 1000),
  }));

  const todayDonut = [
    { name: "Present", value: stats.todayPresent || 0, color: "#00C48C" },
    { name: "Late", value: stats.todayLate || 0, color: "#FA731C" },
    { name: "Absent", value: stats.todayAbsent || 0, color: "#EF4444" },
    { name: "On Leave", value: stats.todayOnLeave || 0, color: "#024BAB" },
  ].filter((d) => d.value > 0);

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
            Here's your HR overview for today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/employees">
            <button className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Employees
            </button>
          </Link>
          <Link to="/leave">
            <button className="border-2 bg-[#FA731C] text-white px-4 py-2 text-sm flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Leave Requests
            </button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {stats.pendingLeaves > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 p-3 border-2 border-[#FA731C] bg-[#FA731C]/5">
          <span className="text-xs font-bold text-[#FA731C] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Action needed
          </span>
          <Link to="/leave">
            <span className="border-2 p-1 flex items-center gap-1 text-[11px]">
              <CalendarDays className="w-3 h-3" /> {stats.pendingLeaves} leave
              requests pending
            </span>
          </Link>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          title="Total Employees"
          value={stats.totalEmployees}
          sub={`${stats.activeEmployees} active`}
          icon={Users}
          bg="bg-[#024BAB]"
          to="/employees"
        />
        <KpiCard
          title="Today's Attendance"
          value={`${stats.attendanceRate}%`}
          sub={`${stats.todayPresent} present`}
          icon={Clock}
          bg="bg-[#FA731C]"
          to="/attendance"
        />
        <KpiCard
          title="Pending Leaves"
          value={stats.pendingLeaves}
          sub="Awaiting approval"
          icon={CalendarDays}
          bg="bg-[#024BAB]"
          to="/leave"
        />
        <KpiCard
          title="New Hires"
          value={stats.newHires}
          sub="This month"
          icon={TrendingUp}
          bg="bg-[#A3E635]"
          iconColor="text-black"
          to="/employees"
          trend="up"
        />
        <KpiCard
          title="Monthly Payroll"
          value={formatCurrency(stats.monthlyPayroll)}
          sub="Paid this month"
          icon={IndianRupee}
          bg="bg-[#FA731C]"
          to="/payroll"
        />
        <KpiCard
          title="Departments"
          value={stats.departments}
          sub="Active teams"
          icon={Building2}
          bg="bg-[#00C48C]"
          to="/departments"
        />
        <KpiCard
          title="Attendance Rate"
          value={`${stats.attendanceRate}%`}
          sub="Team health"
          icon={CheckCircle2}
          bg="bg-[#024BAB]"
          to="/attendance"
        />
        <KpiCard
          title="Students"
          value={stats.totalStudents}
          sub="Active enrollments"
          icon={GraduationCap}
          bg="bg-[#A855F7]"
          to="/students"
        />
        <KpiCard
          title="Bookings"
          value={stats.totalBookings}
          sub={`${stats.todayBookings} today`}
          icon={BookOpen}
          bg="bg-[#FA731C]"
          to="/bookings"
        />
        <KpiCard
          title="Subscription Income"
          value={formatCurrency(stats.subscriptionIncome)}
          sub="Collected this month"
          icon={Wallet}
          bg="bg-[#00C48C]"
          to="/subscriptions"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Today's Attendance Donut */}
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Today's Attendance
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Live breakdown</p>
          {todayDonut.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie
                    data={todayDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {todayDonut.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {[
                  {
                    label: "Present",
                    value: stats.todayPresent || 0,
                    icon: UserCheck,
                    color: "#00C48C",
                  },
                  {
                    label: "Late",
                    value: stats.todayLate || 0,
                    icon: Clock,
                    color: "#FA731C",
                  },
                  {
                    label: "Absent",
                    value: stats.todayAbsent || 0,
                    icon: UserX,
                    color: "#EF4444",
                  },
                  {
                    label: "On Leave",
                    value: stats.todayOnLeave || 0,
                    icon: Coffee,
                    color: "#024BAB",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 border border-black"
                        style={{ background: color }}
                      />
                      <span className="text-xs font-bold text-black">
                        {label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-black">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-bold">No attendance data today</p>
            </div>
          )}
        </div>

        {/* 6-month Attendance Trend */}
        <div className="border-2 bg-white p-5">
          <h3 className="font-display font-bold text-base text-black mb-1">
            Attendance Trend
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Present days — last 6 months
          </p>
          {attChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={attChartData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#024BAB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#024BAB" stopOpacity={0} />
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
                  cursor={{ fill: "#024BAB11" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Present"
                  stroke="#024BAB"
                  strokeWidth={2}
                  fill="url(#attGrad)"
                  dot={{ fill: "#024BAB", strokeWidth: 2, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
              No trend data yet
            </div>
          )}
        </div>

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
                <BarChart data={deptHeadcounts} barCategoryGap="35%">
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
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip
                    content={<NbTooltip />}
                    cursor={{ fill: "#024BAB11" }}
                  />
                  <Bar
                    dataKey="count"
                    name="Employees"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                  >
                    {deptHeadcounts.map((_: any, i: number) => (
                      <Cell
                        key={i}
                        fill={DEPT_COLORS[i % DEPT_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
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
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Student
                  </th>
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Plan
                  </th>
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Renewal Date
                  </th>
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="py-2 pr-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptionAlerts.map((sub: any) => {
                  const isPastDue = new Date(sub.renewalDate) < new Date();
                  return (
                    <tr
                      key={sub._id}
                      className="border-b border-black/10 last:border-0"
                    >
                      <td className="py-2 pr-3 font-bold text-black">
                        {sub.student?.firstName} {sub.student?.lastName}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {sub.student?.sport}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{sub.planName}</td>
                      <td className="py-2 pr-3">
                        {new Date(sub.renewalDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-3 font-bold">
                        {formatCurrency(sub.amount)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 border-2 border-black uppercase",
                            isPastDue
                              ? "bg-[#EF4444] text-white"
                              : "bg-[#FA731C] text-white",
                          )}
                        >
                          {isPastDue ? "Ended" : "Ending Soon"}
                        </span>
                      </td>
                    </tr>
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
        {/* Recent hires */}
        <div className="border-2 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-bold text-base text-black">
                Recent Hires
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.newHires} new this month
              </p>
            </div>
            <Link to="/employees">
              <button className="text-xs font-bold text-black border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors">
                View all →
              </button>
            </Link>
          </div>
          {recentHires?.length > 0 ? (
            <div className="space-y-2">
              {recentHires.slice(0, 5).map((emp: any) => (
                <Link key={emp._id} to="/employees">
                  <div className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-black hover: transition-all">
                    {emp.avatar ? (
                      <img
                        src={emp.avatar}
                        alt={emp.firstName}
                        className="w-8 h-8 border-2 border-black object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {emp.firstName?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.designation} · {emp.department?.name}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-center text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-bold">No new hires this month</p>
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
