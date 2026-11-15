import type { ReactNode } from "react";

/** Same neo-brutal tooltip the dashboard charts use. */
export function NbTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-black px-3 py-2 text-xs">
      {label != null && <p className="font-bold text-black mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={`${p.dataKey ?? p.name}-${i}`} className="flex items-center gap-2">
          <span
            className="w-2 h-2 border border-black shrink-0"
            style={{ background: p.color || p.payload?.fill }}
          />
          <span className="font-bold text-black capitalize">
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  empty,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: string;
  className?: string;
}) {
  return (
    <div className={`nb-rise border-2 border-black bg-white p-5 ${className}`}>
      <h3 className="font-display font-bold text-base text-black mb-1">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      )}
      {empty ? (
        <div className="flex items-center justify-center h-28 text-muted-foreground text-xs font-bold">
          {empty}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
