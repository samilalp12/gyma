import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrackedApp } from '../db/types';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { fmt, fmtLong, formatMinutes } from '../lib/date';
import { screenTotal } from '../lib/metrics';
import { cn } from './ui';

export const OTHER = '__other';
const OTHER_LABEL = 'Diğer (listede olmayan)';

/** Grafik etiketleri için kısa süre: 45 dk · 2,1 sa */
export function compactMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} dk`;
  return `${(m / 60).toFixed(1).replace('.', ',').replace(',0', '')} sa`;
}

/** 0'dan başlayan, okunaklı adımlarla 3–5 tik */
export function niceTicks(max: number): number[] {
  const steps = [15, 30, 60, 90, 120, 180, 240, 360];
  const step = steps.find((s) => max / s <= 4) ?? 480;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

type Series = { key: string; name: string; color: string };
type Row = { date: string; label: string; total: number; hasData: boolean; top: string | null } & Record<string, number | string | boolean | null>;

/**
 * Günlük ekran süresi — yığılmış sütunlar. Toplamlar sütunların üstünde yazılı,
 * ortalama ve limit çizgileri etiketli; hover'a gerek kalmadan okunur.
 */
export function DailyScreenChart({
  dates,
  apps,
  filter,
  onFilter,
  range,
  onRange,
}: {
  dates: string[];
  /** Grafikte gösterilebilecek uygulamalar (arşivlenmiş ama verisi olanlar dahil) */
  apps: TrackedApp[];
  filter: string | null;
  onFilter: (id: string | null) => void;
  range: 7 | 30;
  onRange: (r: 7 | 30) => void;
}) {
  const data = useData();
  const ct = useChartTheme();

  const { rows, series, totals, avgTotal, maxRow } = useMemo(() => {
    const visible = filter ? apps.filter((a) => a.id === filter) : apps;
    const series: Series[] = visible.map((a) => ({ key: a.id, name: a.name, color: a.color }));
    const anyOther = !filter && dates.some((d) => data.days.get(d)?.phoneTotal != null);
    if (anyOther) series.push({ key: OTHER, name: OTHER_LABEL, color: ct.muted });

    // Seri başına aralık toplamı (filtre çipleri lejant görevi görür)
    const totals = new Map<string, number>();
    const rows: Row[] = dates.map((d) => {
      const day = data.days.get(d);
      const row = { date: d, label: range === 7 ? fmt(d, 'EEE d') : fmt(d, 'd'), total: 0, hasData: false, top: null } as Row;
      for (const a of apps) {
        const v = day?.screen[a.id] ?? 0;
        totals.set(a.id, (totals.get(a.id) ?? 0) + v);
      }
      const other = day?.phoneTotal != null ? Math.max(0, day.phoneTotal - (screenTotal(data, d) ?? 0)) : 0;
      totals.set(OTHER, (totals.get(OTHER) ?? 0) + other);
      for (const s of series) {
        const v = s.key === OTHER ? other : (day?.screen[s.key] ?? 0);
        row[s.key] = v;
        row.total += v;
        if (v > 0) row.top = s.key; // en üstteki dolu dilim yuvarlatılır
      }
      row.hasData = !!day && (Object.keys(day.screen).length > 0 || day.phoneTotal != null);
      return row;
    });
    const withData = rows.filter((r) => r.hasData);
    const avgTotal = withData.length ? withData.reduce((s, r) => s + r.total, 0) / withData.length : null;
    const maxRow = withData.reduce<Row | null>((m, r) => (!m || r.total > m.total ? r : m), null);
    return { rows, series, totals, avgTotal, maxRow };
  }, [data, apps, dates, filter, range, ct.muted]);

  const limit = filter ? (data.appById.get(filter)?.limit ?? 0) : data.activeApps.reduce((s, a) => s + a.limit, 0);
  const ticks = niceTicks(Math.max(maxRow?.total ?? 0, limit, 30));
  const barSize = range === 7 ? 24 : 12;
  // Ortalama ve limit çizgisi çok yakınsa etiketleri dikeyde ayır
  const domainMax = ticks[ticks.length - 1];
  const labelsClash = limit > 0 && avgTotal != null && Math.abs(limit - avgTotal) / domainMax < 0.06;
  const allTotal = [...apps.map((a) => totals.get(a.id) ?? 0), totals.get(OTHER) ?? 0].reduce((a, b) => a + b, 0);

  // Seçici etiket: 7 günde her toplam; 30 günde sadece en yüksek gün ve bugün
  const showLabel = (r: Row) => r.hasData && r.total > 0 && (range === 7 || r.date === maxRow?.date || r.date === data.today);

  return (
    <section className="mb-5 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Günlük ekran süresi</h2>
          <p className="mt-1 text-xs text-muted">
            {avgTotal != null ? (
              <>
                Ortalama <span className="font-semibold text-fg">{formatMinutes(avgTotal)}</span> / gün
                {maxRow && (
                  <>
                    {' '}
                    · en yüksek {fmt(maxRow.date, 'd MMM EEE')} <span className="text-fg">{formatMinutes(maxRow.total)}</span>
                  </>
                )}
              </>
            ) : (
              'Bu aralıkta veri yok'
            )}
          </p>
        </div>
        <div className="flex rounded-[10px] border border-line p-0.5" role="group" aria-label="Zaman aralığı">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={cn('cursor-pointer rounded-lg px-3 py-1 text-xs', range === r ? 'bg-card-2 text-fg' : 'text-muted')}
            >
              {r} gün
            </button>
          ))}
        </div>
      </div>

      {/* Filtre çipleri = lejant (renk + ad + aralık toplamı) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button className={cn('chip', !filter && 'chip-on')} onClick={() => onFilter(null)}>
          Tümü <span className="tabular-nums opacity-70">{compactMinutes(allTotal)}</span>
        </button>
        {apps.map((a) => (
          <button key={a.id} className={cn('chip', filter === a.id && 'chip-on')} onClick={() => onFilter(filter === a.id ? null : a.id)}>
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: a.color }} />
            {a.name}
            <span className="tabular-nums opacity-70">{compactMinutes(totals.get(a.id) ?? 0)}</span>
          </button>
        ))}
        {!filter && (totals.get(OTHER) ?? 0) > 0 && (
          <span className="chip cursor-default">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: ct.muted }} />
            Diğer <span className="tabular-nums opacity-70">{compactMinutes(totals.get(OTHER) ?? 0)}</span>
          </span>
        )}
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 22, right: 64, left: 0, bottom: 0 }} barCategoryGap={range === 7 ? '30%' : '20%'}>
            <CartesianGrid stroke={ct.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: ct.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: ct.grid }}
              interval={range === 7 ? 0 : 2}
            />
            <YAxis
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={(v: number) => (v === 0 ? '0' : compactMinutes(v))}
              tick={{ fill: ct.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip cursor={{ fill: ct.tooltip.cursor.fill }} content={<ScreenTooltip series={series} />} />
            {limit > 0 && (
              <ReferenceLine
                y={limit}
                stroke={ct.danger}
                strokeDasharray="4 4"
                label={<LineLabel text={`limit ${compactMinutes(limit)}`} color={ct.axis} dy={labelsClash && limit < (avgTotal ?? 0) ? 11 : labelsClash ? -4 : 3} />}
              />
            )}
            {avgTotal != null && (
              <ReferenceLine
                y={avgTotal}
                stroke={ct.text}
                strokeOpacity={0.45}
                label={<LineLabel text={`ort. ${compactMinutes(avgTotal)}`} color={ct.text} dy={labelsClash && avgTotal <= limit ? 11 : labelsClash ? -4 : 3} />}
              />
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="s"
                fill={s.color}
                maxBarSize={barSize}
                isAnimationActive={false}
                // 2px yüzey boşluğu dilimleri ayırır; sadece en üst dolu dilim yuvarlatılır
                shape={(props: unknown) => {
                  const p = props as { payload: Row } & Record<string, unknown>;
                  return <Rectangle {...p} stroke={ct.card} strokeWidth={2} radius={p.payload.top === s.key ? [4, 4, 0, 0] : 0} />;
                }}
              >
                {i === series.length - 1 && (
                  <LabelList
                    dataKey="total"
                    content={(lp: unknown) => {
                      // Son serinin dilimi (0 olsa bile) yığının tepesinde durur → toplam etiketi oraya
                      const { x, y, width, index } = lp as { x: number; y: number; width: number; index: number };
                      const r = rows[index];
                      if (!r || !showLabel(r)) return null;
                      return (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={ct.text}>
                          {compactMinutes(r.total)}
                        </text>
                      );
                    }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">
        Düz çizgi: ortalama · kesikli kırmızı: {filter ? 'uygulamanın' : 'takip edilenlerin'} günlük limiti
        {!filter && (totals.get(OTHER) ?? 0) > 0 && ' · gri dilim: telefon toplamından listede olmayan uygulamalar'}
      </p>
    </section>
  );
}

/** Referans çizgisinin sağ ucuna, çizim alanının dışına yazılan etiket */
function LineLabel(props: { viewBox?: { x: number; y: number; width: number }; text: string; color: string; dy: number }) {
  const { viewBox, text, color, dy } = props;
  if (!viewBox) return null;
  return (
    <text x={viewBox.x + viewBox.width + 6} y={viewBox.y + dy} fontSize={10} fill={color}>
      {text}
    </text>
  );
}

function ScreenTooltip({ active, payload, series }: { active?: boolean; payload?: { payload: Row }[]; series: Series[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const items = series.map((s) => ({ ...s, v: Number(r[s.key] ?? 0) })).filter((s) => s.v > 0).sort((a, b) => b.v - a.v);
  return (
    <div className="min-w-48 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-muted">{fmtLong(r.date)}</div>
      {r.hasData ? (
        <>
          <div className="mb-1.5 text-sm font-semibold">{formatMinutes(r.total)}</div>
          <ul className="space-y-0.5">
            {items.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular-nums text-muted">{formatMinutes(s.v)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-muted">Veri girilmedi</div>
      )}
    </div>
  );
}

/** Uygulamaların payı: tek bir oransal şerit + satırlarda süre, pay ve günlük ortalama/limit. */
export function ScreenBreakdown({
  items,
  days,
  range,
}: {
  items: { id: string; name: string; color: string; total: number; limit: number }[];
  /** Aralıkta veri girilen gün sayısı */
  days: number;
  range: number;
}) {
  const sum = items.reduce((s, i) => s + i.total, 0);
  const sorted = [...items].filter((i) => i.total > 0).sort((a, b) => b.total - a.total);

  return (
    <section className="mb-5 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Nereye gidiyor? · son {range} gün</h2>
        <span className="text-xs text-muted">{days} günlük veri</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">Bu aralıkta veri yok.</p>
      ) : (
        <>
          <div className="mb-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
            {sorted.map((i) => (
              <div key={i.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(i.total / sum) * 100}%`, background: i.color }} title={i.name} />
            ))}
          </div>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {sorted.map((i) => {
              const daily = days ? i.total / days : 0;
              const over = i.limit > 0 && daily > i.limit;
              return (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: i.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{i.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatMinutes(i.total)} <span className="text-muted">· %{Math.round((i.total / sum) * 100)}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      günde ort. <span className={cn(over ? 'text-danger' : 'text-fg')}>{formatMinutes(daily)}</span>
                      {i.limit > 0 && <> / limit {formatMinutes(i.limit)}</>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
