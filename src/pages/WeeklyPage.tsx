import { CalendarRange, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { InsightsCard } from '../components/InsightsCard';
import { Card, cn, Delta, EmptyState, PageHeader } from '../components/ui';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { moodEmoji } from '../lib/constants';
import { addDaysISO, dateRange, fmt, fmtShortDay, formatHours, formatMinutes, lastNDays, weekStartISO } from '../lib/date';
import { avg, dayScore, habitStats, overallScreen, pctChange, periodStats, screenOn } from '../lib/metrics';

export function WeeklyPage() {
  const data = useData();
  const navigate = useNavigate();
  const ct = useChartTheme();
  const { today } = data;
  const [params, setParams] = useSearchParams();
  const currentWeek = weekStartISO(today);
  const wParam = params.get('w');
  const ws = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) ? weekStartISO(wParam) : currentWeek;
  const we = addDaysISO(ws, 6);
  const go = (w: string) => setParams(w === currentWeek ? {} : { w }, { replace: true });

  const s = useMemo(() => {
    const days = dateRange(ws, we);
    const cur = periodStats(data, days);
    const prev = periodStats(data, dateRange(addDaysISO(ws, -7), addDaysISO(ws, -1)));
    const hCur = habitStats(data, days);
    const hPrev = habitStats(data, dateRange(addDaysISO(ws, -7), addDaysISO(ws, -1)));
    const scored = days
      .filter((d) => d <= today)
      .map((d) => ({ date: d, score: dayScore(data, d).score }))
      .filter((x): x is { date: string; score: number } => x.score != null);
    const best = scored.length ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    const worst = scored.length > 1 ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;

    const daily = days.map((d) => {
      const day = data.days.get(d);
      return {
        date: d,
        label: fmt(d, 'EEE'),
        screen: overallScreen(data, d),
        mood: day?.mood ?? null,
        sleep: day?.sleep ?? null,
        score: dayScore(data, d).score,
        clean: day?.clean ?? null,
        note: day?.note ?? '',
      };
    });

    // Mood – ekran süresi ilişkisi (seçili haftanın sonuna kadar son 8 hafta)
    const end = we < today ? we : today;
    const points = lastNDays(56, end)
      .map((d) => ({ date: d, screen: overallScreen(data, d), mood: data.days.get(d)?.mood ?? null }))
      .filter((p): p is { date: string; screen: number; mood: number } => p.screen != null && p.mood != null);
    const sortedScreens = points.map((p) => p.screen).sort((a, b) => a - b);
    const median = sortedScreens.length ? sortedScreens[Math.floor(sortedScreens.length / 2)] : 0;
    const lowMood = avg(points.filter((p) => p.screen <= median).map((p) => p.mood));
    const highMood = avg(points.filter((p) => p.screen > median).map((p) => p.mood));

    // Uyku – mood ilişkisi
    const sleepPoints = lastNDays(56, end)
      .map((d) => data.days.get(d))
      .filter((d) => d?.sleep != null && d.mood != null);
    const moodGoodSleep = avg(sleepPoints.filter((d) => d!.sleep! >= 7).map((d) => d!.mood!));
    const moodPoorSleep = avg(sleepPoints.filter((d) => d!.sleep! < 7).map((d) => d!.mood!));

    const goalsCur = data.goals.filter((g) => g.period === 'week' && g.start === ws);
    const goalsPrev = data.goals.filter((g) => g.period === 'week' && g.start === addDaysISO(ws, -7));
    return { cur, prev, hCur, hPrev, goalsCur, goalsPrev, best, worst, daily, points, median, lowMood, highMood, moodGoodSleep, moodPoorSleep };
  }, [data, ws, we, today]);

  const hasData = s.daily.some((d) => d.score != null || d.screen != null || d.mood != null || d.sleep != null);
  const { cur, prev } = s;

  const showScreen = screenOn(data);
  const allRows: { label: string; cur: string; prev: string; delta: number | null; lowerIsBetter?: boolean; suffix?: string; screen?: boolean }[] = [
    {
      label: 'Takip edilen uyg. (günlük ort.)',
      cur: formatMinutes(cur.screenAvg),
      prev: formatMinutes(prev.screenAvg),
      delta: pctChange(cur.screenAvg, prev.screenAvg),
      lowerIsBetter: true,
      screen: true,
    },
    {
      label: 'Telefon toplamı (günlük ort.)',
      cur: formatMinutes(cur.phoneAvg),
      prev: formatMinutes(prev.phoneAvg),
      delta: pctChange(cur.phoneAvg, prev.phoneAvg),
      lowerIsBetter: true,
      screen: true,
    },
    {
      label: 'Haftalık hedefler',
      cur: s.goalsCur.length ? `${s.goalsCur.filter((g) => g.done).length}/${s.goalsCur.length}` : '—',
      prev: s.goalsPrev.length ? `${s.goalsPrev.filter((g) => g.done).length}/${s.goalsPrev.length}` : '—',
      delta: null,
    },
    {
      label: 'Rutin tamamlanma',
      cur: cur.completionRate != null ? `%${Math.round(cur.completionRate * 100)}` : '—',
      prev: prev.completionRate != null ? `%${Math.round(prev.completionRate * 100)}` : '—',
      delta: cur.completionRate != null && prev.completionRate != null ? (cur.completionRate - prev.completionRate) * 100 : null,
      suffix: ' puan',
    },
    {
      label: 'Temiz gün',
      cur: `${cur.cleanDays}/${cur.cleanDays + cur.dirtyDays || '—'}`,
      prev: `${prev.cleanDays}/${prev.cleanDays + prev.dirtyDays || '—'}`,
      delta: cur.cleanDays + cur.dirtyDays && prev.cleanDays + prev.dirtyDays ? cur.cleanDays - prev.cleanDays : null,
      suffix: ' gün',
    },
    {
      label: 'Mood ort.',
      cur: cur.moodAvg?.toFixed(1) ?? '—',
      prev: prev.moodAvg?.toFixed(1) ?? '—',
      delta: cur.moodAvg != null && prev.moodAvg != null ? cur.moodAvg - prev.moodAvg : null,
      suffix: '',
    },
    {
      label: 'Enerji ort.',
      cur: cur.energyAvg?.toFixed(1) ?? '—',
      prev: prev.energyAvg?.toFixed(1) ?? '—',
      delta: cur.energyAvg != null && prev.energyAvg != null ? cur.energyAvg - prev.energyAvg : null,
      suffix: '',
    },
    {
      label: 'Uyku ort.',
      cur: formatHours(cur.sleepAvg),
      prev: formatHours(prev.sleepAvg),
      delta: cur.sleepAvg != null && prev.sleepAvg != null ? cur.sleepAvg - prev.sleepAvg : null,
      suffix: ' sa',
    },
    {
      label: 'İçeriksiz gün',
      cur: s.hCur.pornEntered ? `${s.hCur.pornFree}/${s.hCur.pornEntered}` : '—',
      prev: s.hPrev.pornEntered ? `${s.hPrev.pornFree}/${s.hPrev.pornEntered}` : '—',
      delta: s.hCur.pornEntered && s.hPrev.pornEntered ? s.hCur.pornFree - s.hPrev.pornFree : null,
      suffix: ' gün',
    },
    {
      label: 'Dürtü (günlük ort.)',
      cur: s.hCur.urgesAvg?.toFixed(1) ?? '—',
      prev: s.hPrev.urgesAvg?.toFixed(1) ?? '—',
      delta: pctChange(s.hCur.urgesAvg, s.hPrev.urgesAvg),
      lowerIsBetter: true,
    },
    {
      label: 'Erteleme (günlük ort.)',
      cur: s.hCur.procrastAvg?.toFixed(1) ?? '—',
      prev: s.hPrev.procrastAvg?.toFixed(1) ?? '—',
      delta: pctChange(s.hCur.procrastAvg, s.hPrev.procrastAvg),
      lowerIsBetter: true,
    },
    {
      label: 'Gün skoru ort.',
      cur: cur.scoreAvg != null ? Math.round(cur.scoreAvg).toString() : '—',
      prev: prev.scoreAvg != null ? Math.round(prev.scoreAvg).toString() : '—',
      delta: cur.scoreAvg != null && prev.scoreAvg != null ? cur.scoreAvg - prev.scoreAvg : null,
      suffix: ' puan',
    },
  ];
  const rows = allRows.filter((r) => showScreen || !r.screen);

  return (
    <>
      <PageHeader
        title="Haftalık Özet"
        subtitle={`${fmt(ws, 'd MMMM')} – ${fmt(we, 'd MMMM yyyy')}${ws === currentWeek ? ' · bu hafta' : ''}`}
        action={
          <div className="flex items-center gap-1">
            <button className="btn-icon" onClick={() => go(addDaysISO(ws, -7))} title="Önceki hafta">
              <ChevronLeft size={18} />
            </button>
            {ws !== currentWeek && (
              <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => go(currentWeek)}>
                Bu hafta
              </button>
            )}
            <button className="btn-icon" onClick={() => go(addDaysISO(ws, 7))} disabled={ws >= currentWeek} title="Sonraki hafta">
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />

      <InsightsCard />

      {!hasData ? (
        <EmptyState
          icon={<CalendarRange size={28} />}
          title="Bu hafta için veri yok"
          text="Check-in yaptıkça haftalık özetin otomatik oluşur. Önceki haftalara oklarla bakabilirsin."
          action={
            <Link to="/checkin" className="btn-primary">
              Check-in yap
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Card title="Bu hafta vs geçen hafta" className="lg:col-span-2">
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="pb-2 font-medium" />
                      <th className="pb-2 text-right font-medium">Bu hafta</th>
                      <th className="pb-2 text-right font-medium">Geçen hafta</th>
                      <th className="pb-2 text-right font-medium">Değişim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} className="border-t border-line">
                        <td className="py-2.5 text-muted">{r.label}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">{r.cur}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted">{r.prev}</td>
                        <td className="py-2.5 text-right text-xs">
                          <Delta value={r.delta} lowerIsBetter={r.lowerIsBetter} suffix={r.suffix} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid gap-3">
              <DayHighlight kind="best" date={s.best?.date} score={s.best?.score} onClick={(d) => navigate(`/checkin/${d}?step=1`)} />
              <DayHighlight kind="worst" date={s.worst?.date} score={s.worst?.score} onClick={(d) => navigate(`/checkin/${d}?step=1`)} />
            </div>
          </div>

          {showScreen && (
          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card title="Hafta boyunca: ekran süresi ve mood">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={s.daily} margin={{ top: 8, right: -10, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="s" tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="m" orientation="right" domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...ct.tooltip}
                      labelFormatter={(_, p) => (p?.[0] ? fmtShortDay(p[0].payload.date) : '')}
                      formatter={(v: number, name: string) => (name === 'screen' ? [formatMinutes(v), 'Ekran'] : [`${moodEmoji(v)} ${v}/10`, 'Mood'])}
                    />
                    <Bar yAxisId="s" dataKey="screen" fill={ct.muted} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="m" dataKey="mood" stroke={ct.accent} strokeWidth={2} dot={{ r: 3, fill: ct.accent }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted">Gri çubuk: telefon toplamı (girilmediyse takip edilen uygulamalar) · yeşil çizgi: mood (1–10)</p>
            </Card>

            <Card title="Mood ↔ ekran süresi · son 8 hafta">
              {s.points.length < 3 ? (
                <p className="text-sm text-muted">İlişkiyi görmek için en az birkaç gün ekran süresi ve mood girişi gerekli.</p>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke={ct.grid} />
                        <XAxis type="number" dataKey="screen" name="Ekran" unit=" dk" tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis type="number" dataKey="mood" name="Mood" domain={[0.5, 10.5]} ticks={[1, 4, 7, 10]} tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                        <ZAxis range={[40, 40]} />
                        <Tooltip
                          {...ct.tooltip}
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(v: number, name: string) => (name === 'Ekran' ? [formatMinutes(v), name] : [v, name])}
                        />
                        <Scatter data={s.points} fill={ct.accent} fillOpacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  {s.lowMood != null && s.highMood != null && (
                    <p className="mt-2 text-xs text-muted">
                      Ekran süresi {formatMinutes(s.median)} altındaki günlerde mood ort.{' '}
                      <span className="text-fg">{s.lowMood.toFixed(1)}</span>, üstündeki günlerde{' '}
                      <span className="text-fg">{s.highMood.toFixed(1)}</span>.
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
          )}

          <Card title="Uyku" className="mb-5">
            {s.daily.every((d) => d.sleep == null) ? (
              <p className="text-sm text-muted">Bu hafta uyku girilmemiş. Check-in’in 4. adımında “kaç saat uyudun” sorusunu doldur.</p>
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                <div className="h-48 md:col-span-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={s.daily} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke={ct.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 10]} ticks={[0, 4, 6, 8, 10]} tick={{ fill: ct.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        {...ct.tooltip}
                        labelFormatter={(_, p) => (p?.[0] ? fmtShortDay(p[0].payload.date) : '')}
                        formatter={(v: number) => [formatHours(v), 'Uyku']}
                      />
                      <ReferenceLine y={7} stroke={ct.accent} strokeDasharray="4 4" />
                      <Bar dataKey="sleep" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {s.daily.map((d) => (
                          <Cell key={d.date} fill={d.sleep == null ? ct.muted : d.sleep < 6 ? ct.danger : d.sleep < 7 ? ct.muted : ct.accent} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="label">Bu hafta ort.</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums">{formatHours(cur.sleepAvg)}</div>
                  </div>
                  <div className="text-xs text-muted">
                    7 saatin altı: <span className="text-fg">{s.daily.filter((d) => d.sleep != null && d.sleep < 7).length} gece</span>
                  </div>
                  {s.moodGoodSleep != null && s.moodPoorSleep != null && (
                    <p className="text-xs text-muted">
                      Son 8 haftada 7+ saat uyuduğun günlerde mood ort. <span className="text-fg">{s.moodGoodSleep.toFixed(1)}</span>, daha az
                      uyuduğun günlerde <span className="text-fg">{s.moodPoorSleep.toFixed(1)}</span>.
                    </p>
                  )}
                  <p className="text-xs text-muted">Kesikli çizgi: 7 saat hedefi</p>
                </div>
              </div>
            )}
          </Card>

          <Card title="Günler">
            <ul className="divide-y divide-line">
              {s.daily.map((d) => (
                <li key={d.date}>
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 py-2.5 text-left text-sm disabled:cursor-default disabled:opacity-40 sm:gap-3"
                    disabled={d.date > today}
                    onClick={() => navigate(`/checkin/${d.date}?step=1`)}
                  >
                    <span className="w-20 shrink-0 truncate text-muted sm:w-24">{fmt(d.date, 'EEEE')}</span>
                    <span
                      className={cn(
                        'w-10 shrink-0 rounded-md py-0.5 text-center text-xs font-semibold tabular-nums',
                        d.score == null ? 'text-muted' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {d.score ?? '—'}
                    </span>
                    <span className="w-6 shrink-0 text-center">{moodEmoji(d.mood)}</span>
                    {showScreen && <span className="w-20 shrink-0 tabular-nums text-muted">{d.screen != null ? formatMinutes(d.screen) : ''}</span>}
                    <span
                      className={cn('w-14 shrink-0 tabular-nums', d.sleep != null && d.sleep < 6 ? 'text-danger' : 'text-muted')}
                      title="Uyku"
                    >
                      {d.sleep != null ? `${String(d.sleep).replace('.', ',')} sa` : ''}
                    </span>
                    <span className={cn('w-3 shrink-0', d.clean === true && 'text-accent', d.clean === false && 'text-danger')}>
                      {d.clean === true ? '●' : d.clean === false ? '●' : ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted">{d.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function DayHighlight({ kind, date, score, onClick }: { kind: 'best' | 'worst'; date?: string; score?: number; onClick: (d: string) => void }) {
  const best = kind === 'best';
  const Icon = best ? TrendingUp : TrendingDown;
  return (
    <button
      disabled={!date}
      onClick={() => date && onClick(date)}
      className="flex cursor-pointer items-center gap-4 rounded-card border border-line bg-card p-4 text-left hover:border-muted/50 disabled:cursor-default"
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', best ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger')}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="label">{best ? 'En iyi gün' : 'En zor gün'}</div>
        <div className="mt-0.5 text-sm font-medium">{date ? fmt(date, 'd MMMM EEEE') : '—'}</div>
      </div>
      {score != null && <div className={cn('text-2xl font-semibold tabular-nums', best ? 'text-accent' : 'text-danger')}>{score}</div>}
    </button>
  );
}
