import { Sunrise } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { fmt, fmtLong, lastNDays } from '../lib/date';
import { avg, morningLimit, morningOkOf } from '../lib/metrics';

/** Uyandıktan sonra telefona ilk bakış dakikası — son 30 gün, sınır çizgisiyle. */
export function MorningPhoneCard() {
  const data = useData();
  const ct = useChartTheme();
  const limit = morningLimit(data);

  const rows = useMemo(
    () =>
      lastNDays(30, data.today).map((d) => {
        const day = data.days.get(d);
        return { date: d, label: fmt(d, 'd'), min: day?.morningPhoneMin ?? null, ok: morningOkOf(data, day) };
      }),
    [data],
  );
  const withMin = rows.filter((r) => r.min != null);
  if (withMin.length === 0) return null;

  const average = avg(withMin.map((r) => r.min!))!;
  const best = withMin.reduce((a, b) => (b.min! > a.min! ? b : a));
  const top = Math.max(limit * 1.5, ...withMin.map((r) => r.min!));

  return (
    <section className="mb-5 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sunrise size={15} className="text-[#c98500]" /> Uyanınca telefona ilk bakış
        </h2>
        <p className="text-xs text-muted">
          ort. <span className="font-semibold text-fg">{Math.round(average)} dk</span> · en iyi {fmt(best.date, 'd MMM')}{' '}
          <span className="text-fg">{best.min} dk</span> · sınır {limit} dk
        </p>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 56, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={ct.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={{ stroke: ct.grid }} interval={2} />
            <YAxis domain={[0, Math.ceil(top / 10) * 10]} tick={{ fill: ct.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={32} unit="" />
            <Tooltip
              {...ct.tooltip}
              labelFormatter={(_, p) => (p?.[0] ? fmtLong(p[0].payload.date) : '')}
              formatter={(v: number) => [`${v} dk sonra`, 'İlk bakış']}
            />
            <ReferenceLine
              y={limit}
              stroke={ct.text}
              strokeOpacity={0.5}
              strokeDasharray="4 4"
              label={{ value: `sınır ${limit} dk`, position: 'right', fill: ct.axis, fontSize: 10 }}
            />
            <Bar dataKey="min" maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.date} fill={r.min != null && r.min >= limit ? ct.accent : ct.danger} />
              ))}
              {/* Seçici etiket: yalnızca en iyi gün */}
              <LabelList
                dataKey="min"
                content={(lp: unknown) => {
                  const { x, y, width, index } = lp as { x: number; y: number; width: number; index: number };
                  if (rows[index]?.date !== best.date) return null;
                  return (
                    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={600} fill={ct.text}>
                      {best.min}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">Yeşil: sınırı tuttun · kırmızı: erken baktın · boş: girilmedi. Sınırı Ayarlar’dan değiştirebilirsin.</p>
    </section>
  );
}
