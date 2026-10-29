import { subMonths } from 'date-fns';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../hooks/useAppData';
import { addDaysISO, fmt, fmtLong, fromISO, toISO, weekStartISO } from '../lib/date';

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  level: HeatLevel;
  /** good = yeşil skala, bad = mercan skala */
  tone?: 'good' | 'bad';
  /** Tooltip'te tarih altında görünen satır(lar) */
  label: string;
}

export interface HeatmapLegend {
  low?: string;
  high?: string;
  extra?: { tone: 'good' | 'bad'; level: HeatLevel; label: string }[];
}

interface HeatmapProps {
  getCell: (date: string) => HeatCell | null;
  onSelect?: (date: string) => void;
  months?: number;
  legend?: HeatmapLegend | false;
  compact?: boolean;
  /** Veri olmayan günlerde tooltip metni */
  emptyLabel?: string;
}

export function cellColor(level: HeatLevel, tone: 'good' | 'bad' = 'good'): string {
  if (level === 0) return 'var(--h0)';
  return tone === 'bad' ? `var(--r${level})` : `var(--h${level})`;
}

const LABEL_W = 26;
const MONTH_H = 16;

export function Heatmap({ getCell, onSelect, months = 12, legend = {}, compact = false, emptyLabel = 'Veri yok' }: HeatmapProps) {
  const { today } = useData();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ x: number; y: number; date: string; cell: HeatCell | null } | null>(null);

  const weeks = useMemo(() => {
    const start = weekStartISO(addDaysISO(toISO(subMonths(fromISO(today), months)), 1));
    const cols: (string | null)[][] = [];
    let cur = start;
    while (cur <= today) {
      const col: (string | null)[] = [];
      for (let i = 0; i < 7; i++) {
        col.push(cur <= today ? cur : null);
        cur = addDaysISO(cur, 1);
      }
      cols.push(col);
    }
    return cols;
  }, [today, months]);

  const monthLabels = useMemo(() => {
    const out: { col: number; text: string }[] = [];
    weeks.forEach((col, i) => {
      const first = col.find((d) => d && d.endsWith('-01'));
      const d = first ?? (i === 0 ? col[0] : null);
      if (!d) return;
      const last = out[out.length - 1];
      if (last && i - last.col < 3) {
        if (first) out[out.length - 1] = { col: i, text: fmt(d, 'MMM') };
        return;
      }
      out.push({ col: i, text: fmt(d, 'MMM') });
    });
    return out;
  }, [weeks]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const gap = compact ? 2 : 3;
  const maxCell = compact ? 11 : 14;
  const minCell = compact ? 7 : 9;
  const fit = width ? Math.floor((width - LABEL_W) / weeks.length - gap) : maxCell;
  const cell = Math.max(minCell, Math.min(maxCell, fit));
  const step = cell + gap;
  const svgW = LABEL_W + weeks.length * step;
  const svgH = MONTH_H + 7 * step;

  // Taşma varsa en sağa (bugüne) kaydır
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
  }, [svgW]);

  return (
    <div>
      <div ref={wrapRef} className="scrollbar-thin overflow-x-auto" onMouseLeave={() => setTip(null)}>
        <svg width={svgW} height={svgH} className="block select-none" role="img">
          {monthLabels.map((m) => (
            <text key={m.col} x={LABEL_W + m.col * step} y={11} fontSize={10} style={{ fill: 'var(--muted)' }}>
              {m.text}
            </text>
          ))}
          {['Pzt', 'Çar', 'Cum'].map((l, i) => (
            <text key={l} x={0} y={MONTH_H + i * 2 * step + cell - 1} fontSize={9} style={{ fill: 'var(--muted)' }}>
              {l}
            </text>
          ))}
          {weeks.map((col, wi) =>
            col.map((date, di) => {
              if (!date) return null;
              const c = getCell(date);
              return (
                <rect
                  key={date}
                  x={LABEL_W + wi * step}
                  y={MONTH_H + di * step}
                  width={cell}
                  height={cell}
                  rx={compact ? 2 : 2.5}
                  style={{
                    fill: cellColor(c?.level ?? 0, c?.tone),
                    cursor: onSelect ? 'pointer' : 'default',
                    stroke: date === today ? 'var(--muted)' : undefined,
                    strokeWidth: date === today ? 1 : undefined,
                  }}
                  onMouseEnter={(e) => {
                    const r = (e.target as SVGRectElement).getBoundingClientRect();
                    setTip({ x: r.left + r.width / 2, y: r.top, date, cell: c });
                  }}
                  onClick={() => onSelect?.(date)}
                />
              );
            }),
          )}
        </svg>
      </div>

      {legend !== false && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] text-muted">
          {legend.extra?.map((x) => (
            <span key={x.label} className="flex items-center gap-1.5">
              <Swatch color={cellColor(x.level, x.tone)} />
              {x.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            {legend.low ?? 'Az'}
            {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
              <Swatch key={l} color={cellColor(l)} />
            ))}
            {legend.high ?? 'Çok'}
          </span>
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <div className="font-medium text-fg">{fmtLong(tip.date)}</div>
          <div className="whitespace-pre-line text-muted">{tip.cell?.label ?? emptyLabel}</div>
        </div>
      )}
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />;
}
