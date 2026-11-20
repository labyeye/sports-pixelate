import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard, NbTooltip } from "@/components/ui/ChartCard";

export interface Insight {
  icon: LucideIcon;
  color: string;
  msg: string;
  time?: string;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
}

const AXIS = { fontSize: 11, fontWeight: 700, fill: "#0A0A0A" } as const;
const yDomain: [number, (max: number) => number] = [
  0,
  (max) => Math.max(4, Math.ceil(max * 1.15)),
];

/** Line chart in the dashboard style: black-outlined dots, value labels. */
export function MiniLine({
  title,
  subtitle,
  data,
  series,
  height = 170,
  className,
  empty = "No data yet",
}: {
  title: string;
  subtitle?: string;
  data: Record<string, any>[];
  series: ChartSeries[];
  height?: number;
  className?: string;
  empty?: string;
}) {
  const has = data.some((d) => series.some((s) => d[s.key]));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={has ? undefined : empty}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} domain={yDomain} />
          <Tooltip content={<NbTooltip />} />
          {series.length > 1 && <Legend iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={3}
              dot={{ r: 4, fill: s.color, stroke: "#0A0A0A", strokeWidth: 1.5 }}
              activeDot={{ r: 6, stroke: "#0A0A0A", strokeWidth: 1.5 }}
              animationDuration={900}
            >
              <LabelList dataKey={s.key} position="top" offset={8} style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }} />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Bar chart in the dashboard style (grouped when several series). */
export function MiniBars({
  title,
  subtitle,
  data,
  series,
  height = 170,
  className,
  empty = "No data yet",
}: {
  title: string;
  subtitle?: string;
  data: Record<string, any>[];
  series: ChartSeries[];
  height?: number;
  className?: string;
  empty?: string;
}) {
  const has = data.some((d) => series.some((s) => d[s.key]));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={has ? undefined : empty}
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<NbTooltip />} cursor={{ fill: "#024BAB11" }} />
          {series.length > 1 && <Legend iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stroke="#0A0A0A" strokeWidth={2} animationDuration={900}>
              <LabelList dataKey={s.key} position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#0A0A0A" }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Plain-language findings, one line each. */
export function InsightList({
  title = "Insights",
  items,
  className = "",
}: {
  title?: string;
  items: Insight[];
  className?: string;
}) {
  return (
    <div className={`nb-rise border-2 border-black bg-white p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-black" />
        <h3 className="font-display font-bold text-base text-black">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs font-bold text-muted-foreground">Nothing to flag yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={i} className="flex items-start gap-3 border-b border-black/5 pb-3 last:border-0 last:pb-0">
                <div className="w-7 h-7 border-2 border-black flex items-center justify-center shrink-0" style={{ background: n.color }}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-black leading-snug">{n.msg}</p>
                  {n.time && <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Row that sits above a list: charts on the left, insights on the right. */
export function PageInsights({ children, insights }: { children: ReactNode; insights: Insight[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
      <InsightList items={insights} />
    </div>
  );
}
