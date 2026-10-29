import { Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heatmap } from '../components/Heatmap';
import { DailyScreenChart, OTHER, ScreenBreakdown } from '../components/ScreenCharts';
import { Card, cn, Delta, EmptyState, PageHeader, Stat } from '../components/ui';
import { useData } from '../hooks/useAppData';
import { useChartTheme } from '../hooks/useChartTheme';
import { screenCell } from '../lib/cells';
import { addDaysISO, dateRange, formatMinutes, lastNDays, weekStartISO } from '../lib/date';
import { avg, pctChange, phoneTotal, screenOn, screenStatus, screenTotal, type AppData } from '../lib/metrics';


/** Veri girilen (check-in'de ekran adımı doldurulan) günler */
function enteredDates(data: AppData, dates: string[]): string[] {
  return dates.filter((d) => {
    const day = data.days.get(d);
    return !!day && Object.keys(day.screen).length > 0;
  });
}

function minutesOn(data: AppData, date: string, appId: string | null): number {
  return appId ? (data.days.get(date)?.screen[appId] ?? 0) : (screenTotal(data, date) ?? 0);
}

/** Dönemdeki toplam dakika (yalnızca girilen günler) */
function sumFor(data: AppData, dates: string[], appId: string | null): number | null {
  const ds = enteredDates(data, dates);
  return ds.length ? ds.reduce((s, d) => s + minutesOn(data, d, appId), 0) : null;
}

/** Dönemde, veri girilen günler üzerinden günlük ortalama */
function dailyAvg(data: AppData, dates: string[], appId: string | null): number | null {
  return avg(enteredDates(data, dates).map((d) => minutesOn(data, d, appId)));
}

/** Telefon toplamı girilen günler */
function phoneDates(data: AppData, dates: string[]): string[] {
  return dates.filter((d) => data.days.get(d)?.phoneTotal != null);
}

/** Telefon toplamı / listede olmayanlar ("diğer") için toplam ve ortalamalar */
function phoneAgg(data: AppData, dates: string[], kind: 'phone' | 'other') {
  const ds = phoneDates(data, dates);
  const val = (d: string) => {
    const p = data.days.get(d)!.phoneTotal!;
    return kind === 'phone' ? p : Math.max(0, p - (screenTotal(data, d) ?? 0));
  };
  return { sum: ds.length ? ds.reduce((s, d) => s + val(d), 0) : null, avg: avg(ds.map(val)) };
}

type Range = 7 | 30;

export function ScreenTimePage() {
  const data = useData();
  const navigate = useNavigate();
  const ct = useChartTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(7);
  const { today } = data;

  const hasAnyScreen = useMemo(() => [...data.days.values()].some((d) => Object.keys(d.screen).length > 0 || d.phoneTotal != null), [data.days]);
  const apps = data.apps;
  const getCell = useMemo(() => screenCell(data), [data]);

  const summary = useMemo(() => {
    const last7 = lastNDays(7, today);
    const prev7 = lastNDays(7, addDaysISO(today, -7));
    const last30 = lastNDays(30, today);
    const rangeDates = lastNDays(range, today);
    const ws = weekStartISO(today);
    const thisWeek = dateRange(ws, today);
    const lastWeek = dateRange(addDaysISO(ws, -7), addDaysISO(ws, -1));
    const thisMonth = dateRange(`${today.slice(0, 8)}01`, today);

    const rows = [null, ...apps.map((a) => a.id)].map((id) => {
      const app = id ? data.appById.get(id)! : null;
      return {
        id,
        name: app?.name ?? 'Takip edilenler toplamı',
        color: app?.color ?? ct.text,
        limit: app ? app.limit : data.activeApps.reduce((s, a) => s + a.limit, 0),
        archived: app?.archived ?? false,
        today: sumFor(data, [today], id),
        week: sumFor(data, thisWeek, id),
        month: sumFor(data, thisMonth, id),
        avg7: dailyAvg(data, last7, id),
        avg30: dailyAvg(data, last30, id),
        rangeTotal: sumFor(data, rangeDates, id) ?? 0,
        last30Total: sumFor(data, last30, id) ?? 0,
      };
    });

    let withinDays = 0;
    let enteredDays = 0;
    for (const d of last30) {
      const st = screenStatus(data, data.days.get(d));
      if (!st.hasData) continue;
      enteredDays++;
      if (!st.over) withinDays++;
    }

    const avg7 = dailyAvg(data, last7, null);
    const extraRow = (kind: 'phone' | 'other') => ({
      kind,
      name: kind === 'phone' ? 'Telefon toplamı' : 'Diğer (listede olmayan)',
      today: phoneAgg(data, [today], kind).sum,
      week: phoneAgg(data, thisWeek, kind).sum,
      month: phoneAgg(data, thisMonth, kind).sum,
      avg7: phoneAgg(data, last7, kind).avg,
      avg30: phoneAgg(data, last30, kind).avg,
    });
    const phone7 = phoneAgg(data, last7, 'phone').avg;
    return {
      phoneRows: phoneDates(data, last30).length ? [extraRow('other'), extraRow('phone')] : [],
      phoneToday: phoneTotal(data, today),
      phone7,
      phoneDelta7: pctChange(phone7, phoneAgg(data, prev7, 'phone').avg),
      otherRange: phoneAgg(data, rangeDates, 'other').sum ?? 0,
      rangeDays: rangeDates.filter((d) => {
        const day = data.days.get(d);
        return !!day && (Object.keys(day.screen).length > 0 || day.phoneTotal != null);
      }).length,
      rows: rows.filter((r) => r.id == null || !r.archived || r.last30Total > 0),
      today: screenTotal(data, today),
      avg7,
      days7: enteredDates(data, last7).length,
      delta7: pctChange(avg7, dailyAvg(data, prev7, null)),
      withinDays,
      enteredDays,
      weekTotal: sumFor(data, thisWeek, null),
      weekDays: enteredDates(data, thisWeek).length,
      weekDelta: pctChange(dailyAvg(data, thisWeek, null), dailyAvg(data, lastWeek, null)),
    };
  }, [data, apps, today, range, ct.text]);

  // Grafikte: aktif uygulamalar + verisi olan arşivlenmişler
  const chartApps = apps.filter((a) => !a.archived || summary.rows.some((r) => r.id === a.id));
  if (!screenOn(data)) {
    return (
      <>
        <PageHeader title="Ekran Süresi" />
        <EmptyState
          icon={<Smartphone size={28} />}
          title="Ekran süresi takibi kapalı"
          text="Ayarlar’dan açtığında check-in adımı, grafikler ve gün skorundaki payı geri gelir. Önceki verilerin duruyor."
          action={
            <Link to="/ayarlar" className="btn-primary">
              Ayarlara git
            </Link>
          }
        />
      </>
    );
  }

  if (data.activeApps.length === 0 && !hasAnyScreen) {
    return (
      <>
        <PageHeader title="Ekran Süresi" />
        <EmptyState
          icon={<Smartphone size={28} />}
          title="Takip edilen uygulama yok"
          text="Ayarlar’dan takip etmek istediğin uygulamaları günlük limitleriyle ekle. Sonra her akşam check-in’de dakikaları gir."
          action={
            <Link to="/ayarlar" className="btn-primary">
              Uygulama ekle
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ekran Süresi" subtitle="Limitler içinde kalınan günler yeşil; ne kadar altındaysan o kadar güçlü yeşil." />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Telefon toplamı · bugün"
          value={formatMinutes(summary.phoneToday)}
          sub={
            summary.phone7 != null ? (
              <span className="flex flex-wrap items-center gap-1">
                7 gün ort. {formatMinutes(summary.phone7)} <Delta value={summary.phoneDelta7} lowerIsBetter />
              </span>
            ) : (
              'Check-in’de telefon toplamını gir'
            )
          }
        />
        <Stat
          label="Takip edilenler · bugün"
          value={formatMinutes(summary.today)}
          tone={summary.today != null && summary.rows[0].limit > 0 ? (summary.today > summary.rows[0].limit ? 'bad' : 'good') : undefined}
          sub={summary.rows[0].limit ? `Toplam limit ${formatMinutes(summary.rows[0].limit)}` : undefined}
        />
        <Stat
          label="Takip edilenler · 7 gün ort."
          value={formatMinutes(summary.avg7)}
          sub={
            summary.days7 ? (
              <span className="flex flex-wrap items-center gap-1">
                {summary.days7} günlük veriden · önceki 7 güne göre <Delta value={summary.delta7} lowerIsBetter />
              </span>
            ) : (
              'Henüz giriş yok'
            )
          }
        />
        <Stat
          label="Takip edilenler · bu hafta"
          value={formatMinutes(summary.weekTotal)}
          sub={
            summary.weekDays ? (
              <span className="flex flex-wrap items-center gap-1">
                {summary.weekDays} gün · günlük ort. geçen haftaya göre <Delta value={summary.weekDelta} lowerIsBetter />
              </span>
            ) : (
              'Bu hafta giriş yok'
            )
          }
        />
        <Stat
          label="Limit içinde · 30 gün"
          value={summary.enteredDays ? `${summary.withinDays}/${summary.enteredDays}` : '—'}
          sub={summary.enteredDays ? `girilen günlerin %${Math.round((summary.withinDays / summary.enteredDays) * 100)}’i` : 'Henüz giriş yok'}
          tone={summary.enteredDays ? 'good' : undefined}
        />
      </div>


      <DailyScreenChart
        dates={lastNDays(range, today)}
        apps={chartApps}
        filter={filter}
        onFilter={setFilter}
        range={range}
        onRange={setRange}
      />

      <ScreenBreakdown
        range={range}
        days={summary.rangeDays}
        items={[
          ...summary.rows.filter((r) => r.id).map((r) => ({ id: r.id!, name: r.name, color: r.color, total: r.rangeTotal, limit: r.limit })),
          ...(summary.otherRange > 0 ? [{ id: OTHER, name: 'Diğer uygulamalar', color: ct.muted, total: summary.otherRange, limit: 0 }] : []),
        ]}
      />

      <Card title="Limit uyumu" action={<span className="text-xs text-muted">Güne tıkla, düzenle</span>} className="mb-5">
        <Heatmap
          getCell={getCell}
          onSelect={(d) => navigate(`/checkin/${d}?step=1`)}
          legend={{ low: 'Limite yakın', high: 'Çok altında', extra: [{ tone: 'bad', level: 3, label: 'Limit aşıldı' }] }}
        />
      </Card>

      <Card title="Toplamlar ve ortalamalar">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 font-medium">Uygulama</th>
                <th className="pb-2 text-right font-medium">Limit / gün</th>
                <th className="pb-2 text-right font-medium">Bugün</th>
                <th className="pb-2 text-right font-medium">Bu hafta</th>
                <th className="pb-2 text-right font-medium">Bu ay</th>
                <th className="pb-2 text-right font-medium">Günlük ort. · 7 gün</th>
                <th className="pb-2 text-right font-medium">Günlük ort. · 30 gün</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.rows.slice(1), summary.rows[0]].map((r) => {
                const overClass = (v: number | null) => (r.limit > 0 && v != null && v > r.limit ? 'text-danger' : '');
                return (
                  <tr key={r.id ?? 'total'} className={cn('border-t border-line', r.id == null && 'font-semibold')}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        {r.id && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
                        {r.name}
                        {r.archived && <span className="text-xs font-normal text-muted">(silindi)</span>}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted">{r.limit ? formatMinutes(r.limit) : '—'}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', overClass(r.today))}>{formatMinutes(r.today)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.week)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.month)}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', overClass(r.avg7))}>{formatMinutes(r.avg7)}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', overClass(r.avg30))}>{formatMinutes(r.avg30)}</td>
                  </tr>
                );
              })}
              {summary.phoneRows.map((r) => (
                <tr key={r.kind} className={cn('border-t border-line', r.kind === 'phone' && 'font-semibold')}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      {r.kind === 'phone' ? <Smartphone size={13} className="text-muted" /> : <span className="h-2 w-2 rounded-full" style={{ background: ct.muted }} />}
                      {r.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-muted">—</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.today)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.week)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.month)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.avg7)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatMinutes(r.avg30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          “Bu hafta” Pazartesi’den, “Bu ay” ayın 1’inden bugüne girilen dakikaların toplamıdır. Ortalamalar yalnızca veri girilen günler
          üzerinden hesaplanır; girilmeyen günler 0 sayılmaz. “Diğer” = telefon toplamı − takip edilen uygulamalar.
        </p>
      </Card>
    </>
  );
}
