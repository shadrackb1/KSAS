import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  PieChart, Pie, Cell, RadialBarChart, RadialBar, LineChart, Line, ResponsiveContainer,
} from 'recharts';

// ─── Tooltip style shared across all charts ─────────────────────────
export const chartTooltipStyle = {
  background: 'var(--bg-void)',
  border: '0.5px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '13px',
  fontFamily: 'Outfit, sans-serif',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
};

// ─── Premium chart tooltip (renders inside recharts <Tooltip>) ──────
interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (value: number, name: string) => string;
}

export function ChartTooltip({ active, payload, label, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-void)',
      border: '0.5px solid var(--bg-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      fontFamily: 'Outfit, sans-serif',
      minWidth: '100px',
    }}>
      {label && (
        <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2" style={{ marginTop: i > 0 ? '4px' : 0 }}>
          {p.color && (
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: p.color, flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {valueFormatter ? valueFormatter(p.value, p.name) : `${p.value}`}
          </span>
          {p.name && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Bar label for horizontal bars (shows % at end of bar) ─────────
export function HorizontalBarLabel(props: any) {
  const { x, y, width, value, fill } = props;
  if (!value && value !== 0) return null;
  return (
    <text
      x={x + width + 8}
      y={y + 14}
      textAnchor="start"
      style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500, fill: fill || 'var(--text-secondary)' }}
    >
      {value}%
    </text>
  );
}

// ─── Bar label for vertical bars (shows count above bar) ────────────
export function VerticalBarLabel(props: any) {
  const { x, y, width, value, fill } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, fill: fill || 'var(--text-secondary)' }}
    >
      {value}
    </text>
  );
}

// ─── Color helpers ──────────────────────────────────────────────────
export const ATTENDANCE_COLORS = ['var(--success)', 'var(--warning)', 'var(--danger)'];
export const XP_TIER_COLORS = ['#CD7F32', '#C0C0C0', '#FFD700', '#B9F2FF'];
export const RISK_COLORS = ['var(--danger)', 'var(--warning)', 'var(--success)'];

export const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
};

export function getRateColor(rate: number) {
  if (rate >= 75) return 'var(--success)';
  if (rate >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

// ─── 1. DONUT CHART WITH CENTER LABEL ───────────────────────────────
interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  showPercentLabels?: boolean;
}

export function DonutChart({
  data, size = 240, innerRadius = 70, outerRadius = 100,
  centerLabel, centerSubLabel, showPercentLabels = true,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const dominant = data.reduce((best, d) => d.value > (best?.value || -1) ? d : best, data[0]);
  const dominantPct = total > 0 ? Math.round((dominant?.value || 0) / total * 100) : 0;
  const defaultLabel = total > 0 ? `${total}` : '0';
  const defaultSub = dominant && total > 0 ? `${dominant.name} ${dominantPct}%` : '';

  const renderCustomLabel = (props: any) => {
    const { cx, cy } = props;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x={cx} dy="-8" style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '32px', fontWeight: 800, fill: 'var(--text-primary)' }}>
          {centerLabel ?? defaultLabel}
        </tspan>
        <tspan x={cx} dy="22" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, fill: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          {centerSubLabel ?? defaultSub}
        </tspan>
      </text>
    );
  };

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={showPercentLabels ? ({ name, value, percent, x, y }) => {
              if (total === 0 || value === 0) return null;
              const pct = Math.round(percent * 100);
              if (pct < 5) return null;
              return (
                <text x={x} y={y} textAnchor={x > 200 ? 'start' : 'end'} dominantBaseline="middle"
                  style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 500, fill: 'var(--text-secondary)' }}>
                  {pct}%
                </text>
              );
            } : false}
            labelLine={showPercentLabels}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          {total > 0 && renderCustomLabel({ cx: size / 2, cy: size / 2 })}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 2. RADIAL PROGRESS RING ────────────────────────────────────────
interface RadialRingProps {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  bgTrack?: string;
}

export function RadialRing({
  value, max = 100, size = 100, thickness = 12,
  color = 'var(--gold-primary)', label, sublabel, bgTrack = 'var(--bg-elevated)',
}: RadialRingProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bgTrack} strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: Math.round(size * 0.24), fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {label ?? value}
        </span>
        {sublabel && (
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: Math.round(size * 0.1), fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 3. SPARKLINE ───────────────────────────────────────────────────
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 60, height = 24, color = 'var(--gold-primary)' }: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ width, height, display: 'inline-block', verticalAlign: 'middle' }} />;
  }

  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ width, height, display: 'inline-block', verticalAlign: 'middle' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 4. CALENDAR HEATMAP ────────────────────────────────────────────
interface CalendarHeatmapProps {
  data: Record<string, 'present' | 'late' | 'absent' | 'none'>;
  months?: number;
}

export function CalendarHeatmap({ data, months = 3 }: CalendarHeatmapProps) {
  const today = new Date();
  const cells: { date: string; status: string }[] = [];

  for (let i = months * 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const status = data[key] || 'none';
    cells.push({ date: key, status });
  }

  const getColor = (status: string) => {
    switch (status) {
      case 'present': return 'var(--success)';
      case 'late': return 'var(--warning)';
      case 'absent': return 'var(--danger)';
      default: return 'var(--bg-elevated)';
    }
  };

  const getOpacity = (status: string) => {
    if (status === 'present') return 1;
    if (status === 'late') return 0.8;
    if (status === 'absent') return 0.6;
    return 0.3;
  };

  const weeks: typeof cells[] = [];
  let currentWeek: typeof cells = [];
  for (const cell of cells) {
    const day = new Date(cell.date).getDay();
    if (day === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(cell);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="flex gap-1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginRight: '4px' }}>
          {dayLabels.map((l, i) => (
            <div key={i} style={{ height: '14px', display: 'flex', alignItems: 'center', fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)' }}>
              {l}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = week[di];
                if (!cell) return <div key={di} style={{ width: '14px', height: '14px' }} />;
                return (
                  <div
                    key={di}
                    title={`${cell.date}: ${cell.status}`}
                    style={{
                      width: '14px', height: '14px', borderRadius: '3px',
                      background: getColor(cell.status), opacity: getOpacity(cell.status),
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)' }}>Less</span>
        {['var(--bg-elevated)', 'var(--danger)', 'var(--warning)', 'var(--success)'].map((c, i) => (
          <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: c, opacity: i === 0 ? 0.3 : i === 1 ? 0.6 : i === 2 ? 0.8 : 1 }} />
        ))}
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)' }}>More</span>
      </div>
    </div>
  );
}

// ─── 5. ANIMATED COUNT-UP ───────────────────────────────────────────
interface CountUpProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}

export function CountUp({ value, duration = 800, suffix = '', prefix = '', decimals = 0, style }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setDisplay(value); return; }

    startTime.current = null;
    const startVal = display;

    const animate = (now: number) => {
      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (value - startVal) * eased;
      setDisplay(current);
      if (progress < 1) rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [value]);

  return (
    <span style={style}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── 6. SMALL MULTIPLES GRID ────────────────────────────────────────
interface SmallMultiplesProps {
  items: { id: string; label: string; data: { name: string; value: number; color: string }[] }[];
  type?: 'donut' | 'bar';
}

export function SmallMultiples({ items }: SmallMultiplesProps) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const total = item.data.reduce((s, d) => s + d.value, 0);
        return (
          <div key={item.id} style={{
            background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)', padding: '12px', textAlign: 'center',
          }}>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.label}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DonutChart
                data={item.data}
                size={120}
                innerRadius={35}
                outerRadius={52}
                centerLabel={`${total}`}
                centerSubLabel="total"
                showPercentLabels={false}
              />
            </div>
            <div className="mt-2 space-y-1">
              {item.data.filter(d => d.value > 0).map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-primary)', flexShrink: 0 }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
