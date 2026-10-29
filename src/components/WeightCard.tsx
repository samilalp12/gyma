import { Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { setWeight } from '../db/actions';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { fmt, fmtLong } from '../lib/date';
import { cn, Delta } from './ui';

export function formatKg(v: number) {
  return v.toFixed(1).replace('.', ',');
}

function parseKg(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 20 && n < 400 ? Math.round(n * 10) / 10 : null;
}

/** Satır içi kg kutusu: Enter / odaktan çıkınca kaydeder; sürükle-bırakı tetiklemez. */
export function WeightInput({ date, className }: { date: string; className?: string }) {
  const { days } = useData();
  const saved = days.get(date)?.weight ?? null;
  const [text, setText] = useState(saved != null ? formatKg(saved) : '');
  useEffect(() => setText(saved != null ? formatKg(saved) : ''), [saved]);

  const commit = () => {
    const kg = parseKg(text);
    if (!text.trim()) {
      if (saved != null) void setWeight(date, null);
      return;
    }
    if (kg == null) return setText(saved != null ? formatKg(saved) : '');
    if (kg !== saved) void setWeight(date, kg);
  };

  return (
    <span
      className={cn('flex shrink-0 items-center gap-1', className)}
      // Satırın sürükle-bırak dinleyicilerine ulaşmasın
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <input
        inputMode="decimal"
        placeholder="—"
        aria-label="Kilo (kg)"
        className="input w-20 py-1 text-right tabular-nums"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-xs text-muted">kg</span>
    </span>
  );
}

/** Haftalık tartı grafiği: tek seri, son ölçüm etiketli; değişim başlıkta. */
export function WeightCard() {
  const data = useData();
  const ct = useChartTheme();

  const points = useMemo(
    () =>
      [...data.days.values()]
        .filter((d) => d.weight != null)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(-26)
        .map((d) => ({ date: d.date, label: fmt(d.date, 'd MMM'), kg: d.weight as number })),
    [data.days],
  );

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const first = points[0];
  const min = Math.min(...points.map((p) => p.kg));
  const max = Math.max(...points.map((p) => p.kg));
  // Eşit aralıklı, tam sayı tikler
  const lo = Math.floor(min - 1);
  const step = Math.max(1, Math.ceil((Math.ceil(max + 1) - lo) / 4));
  const yTicks = Array.from({ length: Math.ceil((Math.ceil(max + 1) - lo) / step) + 1 }, (_, i) => lo + i * step);

  return (
    <section className="mb-5 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Scale size={15} className="text-accent" /> Kilo · haftalık
          </h2>
          {last ? (
            <p className="mt-1 text-xs text-muted">
              Son ölçüm {fmt(last.date, 'd MMM')}: <span className="font-semibold text-fg">{formatKg(last.kg)} kg</span>
              {prev && (
                <>
                  {' '}
                  · önceki haftaya göre <Delta value={Math.round((last.kg - prev.kg) * 10) / 10} lowerIsBetter suffix=" kg" />
                </>
              )}
              {first && first !== last && (
                <>
                  {' '}
                  · başlangıçtan beri <Delta value={Math.round((last.kg - first.kg) * 10) / 10} lowerIsBetter suffix=" kg" />
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Her pazartesi tartıl; ölçümler burada çizgi grafik olur.</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          Bugün
          <WeightInput date={data.today} />
        </div>
      </div>

      {points.length >= 2 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: ct.grid }} interval="preserveStartEnd" />
              <YAxis
                domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                ticks={yTicks}
                tick={{ fill: ct.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                {...ct.tooltip}
                cursor={{ stroke: ct.grid }}
                labelFormatter={(_, p) => (p?.[0] ? fmtLong(p[0].payload.date) : '')}
                formatter={(v: number) => [`${formatKg(v)} kg`, 'Kilo']}
              />
              <Line
                dataKey="kg"
                stroke={ct.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{ r: 4, fill: ct.accent, stroke: ct.card, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: ct.accent, stroke: ct.card, strokeWidth: 2 }}
                isAnimationActive={false}
              >
                {/* Seçici etiket: yalnızca son ölçüm */}
                <LabelList
                  dataKey="kg"
                  content={(lp: unknown) => {
                    const { x, y, index } = lp as { x: number; y: number; index: number };
                    if (index !== points.length - 1) return null;
                    return (
                      <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight={600} fill={ct.text}>
                        {formatKg(points[index].kg)}
                      </text>
                    );
                  }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {points.length === 1 ? 'Grafik için en az iki ölçüm gerekli — gelecek pazartesi görüşürüz.' : 'Henüz ölçüm yok.'}
        </p>
      )}
    </section>
  );
}
