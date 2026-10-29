import { Shield } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heatmap } from '../components/Heatmap';
import { WeightCard } from '../components/WeightCard';
import { Card, cn, Delta, EmptyState, PageHeader, Stat } from '../components/ui';
import { useData } from '../hooks/useAppData';
import { disciplineCell } from '../lib/cells';
import { slotLabel, TIME_SLOTS } from '../lib/constants';
import { addDaysISO, fmt, formatMinutes, isoWeekday, lastNDays, WEEKDAY_SHORT } from '../lib/date';
import { avg, disciplineStats, habitStats, overallScreen, pctChange, screenOn } from '../lib/metrics';

export function DisciplinePage() {
  const data = useData();
  const navigate = useNavigate();
  const st = useMemo(() => disciplineStats(data), [data]);
  const habits = useMemo(
    () => ({
      last30: habitStats(data, lastNDays(30, data.today)),
      last7: habitStats(data, lastNDays(7, data.today)),
      prev7: habitStats(data, lastNDays(7, addDaysISO(data.today, -7))),
    }),
    [data],
  );
  const getCell = useMemo(() => disciplineCell(data), [data]);

  const analysis = useMemo(() => {
    const entered = [...data.days.values()].filter((d) => d.clean != null);
    const broken = entered.filter((d) => d.clean === false).sort((a, b) => (a.date < b.date ? 1 : -1));
    const causes = new Map<string, number>();
    const places = new Map<string, number>();
    const slots = new Map<string, number>();
    for (const d of broken) {
      for (const c of d.trigger?.causes ?? []) causes.set(c, (causes.get(c) ?? 0) + 1);
      if (d.trigger?.place) places.set(d.trigger.place, (places.get(d.trigger.place) ?? 0) + 1);
      if (d.trigger?.slot) slots.set(d.trigger.slot, (slots.get(d.trigger.slot) ?? 0) + 1);
    }
    const weekdays = Array.from({ length: 7 }, () => ({ broken: 0, entered: 0 }));
    for (const d of entered) {
      const w = weekdays[isoWeekday(d.date) - 1];
      w.entered++;
      if (!d.clean) w.broken++;
    }
    const screenOf = (list: typeof entered) => avg(list.map((d) => overallScreen(data, d.date)).filter((x): x is number => x != null));
    return {
      broken,
      causes: [...causes.entries()].sort((a, b) => b[1] - a[1]),
      places: [...places.entries()].sort((a, b) => b[1] - a[1]),
      slots: TIME_SLOTS.map((s) => ({ key: s.key, label: `${s.label}`, range: s.range, count: slots.get(s.key) ?? 0 })),
      weekdays,
      screenBroken: screenOf(broken),
      screenClean: screenOf(entered.filter((d) => d.clean)),
    };
  }, [data]);

  if (st.totalEntered === 0) {
    return (
      <>
        <PageHeader title="Disiplin" />
        <EmptyState
          icon={<Shield size={28} />}
          title="Henüz kayıt yok"
          text="Her akşam check-in’de “Bugün temiz miyim?” sorusunu yanıtla. Seriler, temiz gün oranı ve tetikleyici analizi burada belirecek."
          action={
            <Link to="/checkin" className="btn-primary">
              Check-in yap
            </Link>
          }
        />
      </>
    );
  }

  const rate30 = st.last30Entered ? Math.round((st.last30Clean / st.last30Entered) * 100) : null;
  const maxSlot = Math.max(1, ...analysis.slots.map((s) => s.count));
  const maxCause = Math.max(1, ...analysis.causes.map((c) => c[1]));
  const riskiestDay = analysis.weekdays
    .map((w, i) => ({ i, rate: w.entered ? w.broken / w.entered : 0, ...w }))
    .sort((a, b) => b.rate - a.rate)[0];

  return (
    <>
      <PageHeader title="Disiplin" />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-card border border-line bg-card p-6 md:row-span-2">
          <div className="label">Mevcut seri</div>
          <div className={cn('mt-2 text-6xl font-semibold tabular-nums tracking-tight', st.current > 0 ? 'text-accent' : 'text-fg')}>
            {st.current}
          </div>
          <div className="text-sm text-muted">gün temiz</div>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-sm">
            <span className="text-muted">En uzun seri</span>
            <span className="font-semibold tabular-nums">{st.longest} gün</span>
          </div>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <div className="label">Son 30 gün</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {st.last30Clean} <span className="text-base font-normal text-muted">temiz gün</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${rate30 ?? 0}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted">%{rate30 ?? '—'}</span>
          </div>
        </div>
        <div className="rounded-card border border-line bg-card p-4">
          <div className="label">Toplam temiz gün</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{st.totalClean}</div>
          <div className="mt-1 text-xs text-muted">
            {st.totalEntered} kayıtlı günün %{Math.round((st.totalClean / st.totalEntered) * 100)}’i · seri bozulsa da ilerleme sayılır
          </div>
        </div>
        {screenOn(data) && (
        <div className="rounded-card border border-line bg-card p-4 md:col-span-2">
          <div className="label">Ekran süresi ile ilişki</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted">Temiz günlerde ort.</div>
              <div className="text-xl font-semibold tabular-nums text-accent">{formatMinutes(analysis.screenClean)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Bozulan günlerde ort.</div>
              <div className="text-xl font-semibold tabular-nums text-danger">{formatMinutes(analysis.screenBroken)}</div>
            </div>
          </div>
          {analysis.screenBroken != null && analysis.screenClean != null && analysis.screenClean > 0 && (
            <p className="mt-2 text-xs text-muted">
              Bozulan günlerde ekran süresi temiz günlere göre{' '}
              <span className="text-fg">
                %{Math.abs(Math.round(((analysis.screenBroken - analysis.screenClean) / analysis.screenClean) * 100))}{' '}
                {analysis.screenBroken >= analysis.screenClean ? 'daha fazla' : 'daha az'}
              </span>
              .
            </p>
          )}
        </div>
        )}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Stat
          label="Tetikleyici içerik · son 30 gün"
          value={
            habits.last30.pornEntered ? (
              <>
                {habits.last30.pornFree}
                <span className="text-base font-normal text-muted">/{habits.last30.pornEntered} gün içeriksiz</span>
              </>
            ) : (
              '—'
            )
          }
          tone={habits.last30.pornEntered ? 'good' : undefined}
          sub={`İçeriksiz gün serisi: ${st.pornFreeCurrent} gün`}
        />
        <Stat
          label="Dürtü · son 7 gün"
          value={habits.last7.urgesAvg != null ? `${habits.last7.urgesAvg.toFixed(1)} / gün` : '—'}
          sub={
            <span className="flex flex-wrap items-center gap-1">
              toplam {habits.last7.urgesTotal} · önceki 7 güne göre{' '}
              <Delta value={pctChange(habits.last7.urgesAvg, habits.prev7.urgesAvg)} lowerIsBetter />
            </span>
          }
        />
        <Stat
          label="Erteleme · son 7 gün"
          value={habits.last7.procrastAvg != null ? `${habits.last7.procrastAvg.toFixed(1)} / gün` : '—'}
          sub={
            <span className="flex flex-wrap items-center gap-1">
              {habits.last7.movedTasks} iş yarına taşındı · önceki 7 güne göre{' '}
              <Delta value={pctChange(habits.last7.procrastAvg, habits.prev7.procrastAvg)} lowerIsBetter />
            </span>
          }
        />
      </div>

      <WeightCard />

      <Card title="Takvim" action={<span className="text-xs text-muted">Güne tıkla, düzenle</span>} className="mb-5">
        <Heatmap
          getCell={getCell}
          onSelect={(d) => navigate(`/checkin/${d}?step=3`)}
          emptyLabel="Girilmedi"
          legend={{ low: 'Kısa seri / içerik vardı', high: 'Uzun seri', extra: [{ tone: 'bad', level: 4, label: 'Bozuldu' }] }}
        />
      </Card>

      {analysis.broken.length === 0 ? (
        <EmptyState title="Hiç bozulma kaydı yok" text="Harika gidiyorsun. Bozulma olursa tetikleyici notları burada analiz edilir." />
      ) : (
        <>
          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Card title="En sık tetikleyiciler">
              {analysis.causes.length === 0 ? (
                <p className="text-sm text-muted">Tetikleyici notu girilmemiş.</p>
              ) : (
                <BarList items={analysis.causes.slice(0, 6).map(([k, v]) => ({ label: k, value: v }))} max={maxCause} />
              )}
              {analysis.places.length > 0 && (
                <p className="mt-4 text-xs text-muted">
                  En sık ortam: <span className="text-fg">{analysis.places[0][0]}</span> ({analysis.places[0][1]} kez)
                </p>
              )}
            </Card>
            <Card title="Riskli saat aralıkları">
              <BarList items={analysis.slots.map((s) => ({ label: s.label, hint: s.range, value: s.count }))} max={maxSlot} />
            </Card>
            <Card title="Haftanın günleri">
              <div className="flex h-36 items-end gap-2">
                {analysis.weekdays.map((w, i) => {
                  const rate = w.entered ? w.broken / w.entered : 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5" title={`${w.broken}/${w.entered} gün bozuldu`}>
                      <span className="text-[10px] tabular-nums text-muted">%{Math.round(rate * 100)}</span>
                      <div className="flex h-24 w-full items-end overflow-hidden rounded-md bg-card-2">
                        <div className="w-full rounded-md bg-danger" style={{ height: `${rate * 100}%`, opacity: 0.35 + rate * 0.65 }} />
                      </div>
                      <span className="text-[11px] text-muted">{WEEKDAY_SHORT[i]}</span>
                    </div>
                  );
                })}
              </div>
              {riskiestDay && riskiestDay.broken > 0 && (
                <p className="mt-3 text-xs text-muted">
                  En riskli gün: <span className="text-fg">{WEEKDAY_SHORT[riskiestDay.i]}</span> (bozulma oranı %{Math.round(riskiestDay.rate * 100)})
                </p>
              )}
            </Card>
          </div>

          <Card title="Tetikleyici notları">
            <ul className="divide-y divide-line">
              {analysis.broken.slice(0, 30).map((d) => (
                <li key={d.date}>
                  <button
                    className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left text-sm hover:text-accent"
                    onClick={() => navigate(`/checkin/${d.date}?step=3`)}
                  >
                    <span className="w-24 shrink-0 tabular-nums text-muted">{fmt(d.date, 'd MMM EEE')}</span>
                    {d.trigger?.slot && <span className="chip cursor-pointer">{slotLabel(d.trigger.slot)}</span>}
                    {d.trigger?.place && <span className="chip cursor-pointer">{d.trigger.place}</span>}
                    {d.trigger?.causes.map((c) => (
                      <span key={c} className="chip cursor-pointer border-danger/40 text-danger">
                        {c}
                      </span>
                    ))}
                    {d.trigger?.note && <span className="text-muted">“{d.trigger.note}”</span>}
                    {!d.trigger && <span className="text-xs text-muted">Not yok</span>}
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

function BarList({ items, max }: { items: { label: string; value: number; hint?: string }[]; max: number }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>
              {it.label} {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
            </span>
            <span className="tabular-nums text-muted">{it.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full bg-danger" style={{ width: `${(it.value / max) * 100}%`, opacity: it.value ? 0.4 + (it.value / max) * 0.6 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
