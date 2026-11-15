import React from "react";

export interface ChartSlice {
  label: string;
  value: number;
  displayValue?: string;
  color: string;
}

interface DonutChartProps {
  slices: ChartSlice[];
  centerLabel: string;
  centerValue: string;
  emptyText?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  slices,
  centerLabel,
  centerValue,
  emptyText = "No data available yet.",
}) => {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <svg viewBox="0 0 140 140" className="h-32 w-32 text-muted">
          <circle
            cx="70"
            cy="70"
            r="52"
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            className="opacity-30"
          />
          <text
            x="70"
            y="66"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-semibold"
          >
            {centerLabel}
          </text>
          <text x="70" y="84" textAnchor="middle" className="fill-foreground text-[14px] font-bold">
            {centerValue}
          </text>
        </svg>
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<
    Array<{ label: string; color: string; dashArray: string; dashOffset: number }>
  >((acc, slice) => {
    const val = Math.max(0, slice.value);
    if (val === 0) return acc;
    const pct = val / total;
    const prevPct = acc.reduce(
      (sum, item) => sum + parseFloat(item.dashArray.split(" ")[0]) / circumference,
      0
    );
    return [
      ...acc,
      {
        label: slice.label,
        color: slice.color,
        dashArray: `${pct * circumference} ${circumference}`,
        dashOffset: -prevPct * circumference,
      },
    ];
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {centerLabel}
          </span>
          <span className="text-sm font-black font-heading text-foreground leading-tight mt-0.5 truncate max-w-[90px]">
            {centerValue}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((Math.max(0, slice.value) / total) * 100) : 0;
          return (
            <div key={slice.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-semibold text-foreground truncate">{slice.label}</span>
              </div>
              <span className="font-bold text-foreground shrink-0">
                {slice.displayValue ?? slice.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface BarItem {
  label: string;
  value: number;
  displayValue?: string;
  subLabel?: string;
  color?: string;
}

interface HorizontalBarChartProps {
  items: BarItem[];
  emptyText?: string;
  defaultColor?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  items,
  emptyText = "No data available yet.",
  defaultColor = "#FF6A00",
}) => {
  const maxVal = Math.max(...items.map((i) => i.value), 0);

  if (items.length === 0 || maxVal <= 0) {
    return <div className="py-8 text-center text-xs text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = maxVal > 0 ? Math.max(4, Math.round((item.value / maxVal) * 100)) : 0;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-foreground truncate block">{item.label}</span>
                {item.subLabel && (
                  <span className="text-[11px] text-muted-foreground">{item.subLabel}</span>
                )}
              </div>
              <span className="font-bold text-foreground shrink-0">
                {item.displayValue ?? item.value}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || defaultColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
