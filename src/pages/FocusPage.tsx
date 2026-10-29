import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FocusTimer } from '../components/FocusTimer';
import { Heatmap, type HeatCell } from '../components/Heatmap';
import { compactMinutes, niceTicks } from '../components/ScreenCharts';
import { Card, PageHeader, Stat } from '../components/ui';
import { APP_COLORS, deleteSession, saveFocusCategories } from '../db/actions';
import { uid } from '../db/db';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { addDaysISO, dateRange, fmt, fmtLong, formatMinutes, lastNDays, weekStartISO } from '../lib/date';
import { categoryOf, focusMinutes, focusTotal } from '../lib/focus';

export function FocusPage() {
  const data = useData();
  const ct = useChartTheme();
  const { today } = data;
  const cats = data.settings.focusCategories ?? [];

  const s = useMemo(() => {
    const week = dateRange(weekStartISO(today), today);
    const lastWeek = dateRange(addDaysISO(weekStartISO(today), -7), addDaysISO(weekStartISO(today), -1));
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    // Seri: art arda en az 1 seans yapılan günler (bugün henüz yoksa dünden say)
    let streak = 0;
    let d = focusTotal(data, today) > 0 ? today : addDaysISO(today, -1);
    while (focusTotal(data, d) > 0) {
      streak++;
      d = addDaysISO(d, -1);
    }
    const days14 = lastNDays(14, today);
    const rows = days14.map((date) => {
      const m = focusMinutes(data, [date]);
      const row: Record<string, number | string> = { date, label: fmt(date, 'EEE d'), total: sum(m) };
      for (const c of cats) row[c.id] = m.get(c.id) ?? 0;
      return row;
    });
    return { today: focusTotal(data, today), week: sum(focusMinutes(data, week)), lastWeek: sum(focusMinutes(data, lastWeek)), weekBy: focusMinutes(data, week), streak, rows };
  }, [data, today, cats]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of data.sessions) m.set(x.date, (m.get(x.date) ?? 0) + x.minutes);
    return m;
  }, [data.sessions]);
  const getCell = (date: string): HeatCell | null => {
    const v = byDay.get(date);
    if (!v) return null;
    return { level: v >= 180 ? 4 : v >= 90 ? 3 : v >= 45 ? 2 : 1, label: `${formatMinutes(v)} odak` };
  };

  const yTicks = niceTicks(Math.max(30, ...s.rows.map((r) => Number(r.total))));
  const recent = [...data.sessions].reverse().slice(0, 15);
  const maxWeekCat = Math.max(1, ...s.weekBy.values());

  return (
    <>
      <PageHeader title="Odak" subtitle="Tek tıkla başlat, bitince kaydolsun. Küçük seanslar da birikir." />

      <div className="mb-5 grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FocusTimer />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Stat label="Bugün" value={formatMinutes(s.today)} tone={s.today >= 60 ? 'good' : undefined} />
          <Stat label="Bu hafta" value={formatMinutes(s.week)} sub={s.lastWeek ? `geçen hafta ${formatMinutes(s.lastWeek)}` : undefined} />
          <Stat label="Odak serisi" value={`${s.streak} gün`} tone={s.streak > 0 ? 'good' : undefined} sub="her gün en az bir seans" />
          <Stat label="Seans sayısı" value={data.sessions.filter((x) => x.date === today).length} sub="bugün" />
        </div>
      </div>

      <Card title="Son 14 gün" className="mb-5">
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
          {cats.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={ct.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={{ stroke: ct.grid }} interval={1} />
              <YAxis ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tickFormatter={(v: number) => (v ? compactMinutes(v) : '0')} tick={{ fill: ct.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                {...ct.tooltip}
                labelFormatter={(_, p) => (p?.[0] ? fmtLong(p[0].payload.date) : '')}
                formatter={(v: number, k: string) => [formatMinutes(v), categoryOf(data, k).name]}
              />
              {cats.map((c, i) => (
                <Bar key={c.id} dataKey={c.id} stackId="f" fill={c.color} stroke={ct.card} strokeWidth={2} maxBarSize={22} radius={i === cats.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false}>
                  {i === cats.length - 1 && (
                    <LabelList
                      dataKey="total"
                      content={(lp: unknown) => {
                        const { x, y, width, index } = lp as { x: number; y: number; width: number; index: number };
                        const t = Number(s.rows[index]?.total ?? 0);
                        return t ? (
                          <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={ct.text}>
                            {compactMinutes(t)}
                          </text>
                        ) : null;
                      }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Bu hafta nereye gitti?">
          {s.week === 0 ? (
            <p className="text-sm text-muted">Bu hafta henüz seans yok. İlk 25 dakikayla başla.</p>
          ) : (
            <ul className="space-y-3">
              {[...s.weekBy.entries()].sort((a, b) => b[1] - a[1]).map(([id, m]) => {
                const c = categoryOf(data, id);
                return (
                  <li key={id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="tabular-nums text-muted">{formatMinutes(m)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-card-2">
                      <div className="h-full rounded-full" style={{ width: `${(m / maxWeekCat) * 100}%`, background: c.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Son seanslar">
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Henüz kayıtlı seans yok.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((x) => {
                const c = categoryOf(data, x.categoryId);
                return (
                  <li key={x.id} className="group flex items-center gap-3 py-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted">
                      {fmt(x.date, 'd MMM')} · {new Date(x.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{formatMinutes(x.minutes)}</span>
                    <button className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void deleteSession(x.id)} title="Sil">
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Odak takvimi" className="mb-5">
        <Heatmap getCell={getCell} emptyLabel="Seans yok" legend={{ low: 'Az', high: '3 sa+' }} />
      </Card>

      <CategoryManager />
    </>
  );
}

function CategoryManager() {
  const data = useData();
  const cats = data.settings.focusCategories ?? [];
  const [name, setName] = useState('');
  return (
    <Card title="Kategoriler">
      <ul className="mb-3 flex flex-wrap gap-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-2 pr-1 text-sm">
            <button
              className="h-3.5 w-3.5 cursor-pointer rounded-full"
              style={{ background: c.color }}
              title="Rengi değiştir"
              onClick={() => {
                const next = APP_COLORS[(APP_COLORS.indexOf(c.color) + 1) % APP_COLORS.length];
                void saveFocusCategories(cats.map((x) => (x.id === c.id ? { ...x, color: next } : x)));
              }}
            />
            {c.name}
            <button className="btn-icon h-6 w-6" title="Sil (geçmiş seanslar kalır)" onClick={() => void saveFocusCategories(cats.filter((x) => x.id !== c.id))}>
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void saveFocusCategories([...cats, { id: uid(), name: name.trim(), color: APP_COLORS[cats.length % APP_COLORS.length] }]);
          setName('');
        }}
      >
        <input className="input" placeholder="Yeni kategori (ör. İngilizce, Spor)… (Enter)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-ghost shrink-0 px-2.5" type="submit" disabled={!name.trim()} aria-label="Ekle">
          <Plus size={16} />
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">Renk noktasına tıklayınca renk değişir. Silinen kategorinin geçmiş seansları korunur.</p>
    </Card>
  );
}
