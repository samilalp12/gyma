import { ArrowRight, CalendarRange, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BacklogCard } from '../components/BacklogCard';
import { DayTasksCard } from '../components/DayTasksCard';
import { FocusTimer } from '../components/FocusTimer';
import { GoalsCard } from '../components/GoalsCard';
import { InsightsCard } from '../components/InsightsCard';
import { Heatmap } from '../components/Heatmap';
import { Card, Delta, EmptyState, PageHeader, Stat } from '../components/ui';
import { useData } from '../hooks/useAppData';
import { scoreCell } from '../lib/cells';
import { moodEmoji } from '../lib/constants';
import { addDaysISO, dateRange, fmtLong, formatHours, formatMinutes, isoWeekday, lastNDays, nowHHmm, weekStartISO } from '../lib/date';
import { completion, dayScore, disciplineStats, habitStats, pctChange, periodStats, screenOn } from '../lib/metrics';
import { focusTotal } from '../lib/focus';

/** Duruma göre kısa, cesaretlendirici bir cümle */
function motivationLine(data: ReturnType<typeof useData>): string {
  const c = completion(data, data.today);
  const ds = disciplineStats(data);
  const focus = focusTotal(data, data.today);
  if (c.total > 0 && c.done === c.total) return 'Bugünün listesi bitti — harika iş 🎉';
  if (ds.current >= 7) return `${ds.current} gündür temizsin. Bu seri senin eserin 💪`;
  if (focus >= 90) return `Bugün ${Math.round(focus)} dakika odaklandın. Çok iyi gidiyor 🔥`;
  if (c.total > 0 && c.done / c.total >= 0.5) return 'Yarısını geçtin, devam 👊';
  if (ds.current > 0) return `Temiz serin ${ds.current} gün. Bir gün daha ekle ✨`;
  return 'Küçük bir adım yeter: bir iş seç, 25 dakika başlat.';
}

/** "Rutinler %50 · disiplin %50" — ekran süresi kapalıysa onu dışarıda bırakır */
function weightText(data: ReturnType<typeof useData>) {
  const w = data.settings.weights;
  const parts: [string, number][] = [
    ['Rutinler', w.routines],
    ...(screenOn(data) ? ([['ekran süresi uyumu', w.screen]] as [string, number][]) : []),
    ['disiplin', w.discipline],
  ];
  const total = parts.reduce((a, [, v]) => a + v, 0) || 1;
  return parts.map(([k, v]) => `${k} %${Math.round((v / total) * 100)}`).join(' · ');
}

function greeting() {
  const h = Number(nowHHmm().slice(0, 2));
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export function OverviewPage() {
  const data = useData();
  const navigate = useNavigate();
  const { today } = data;
  const motivation = useMemo(() => motivationLine(data), [data]);

  const stats = useMemo(() => {
    const ws = weekStartISO(today);
    const thisWeek = periodStats(data, dateRange(ws, today));
    const lastWeek = periodStats(data, dateRange(addDaysISO(ws, -7), addDaysISO(ws, -1)));
    return {
      discipline: disciplineStats(data),
      thisWeek,
      screenDelta: pctChange(thisWeek.screenAvg, lastWeek.screenAvg),
      phoneDelta: pctChange(thisWeek.phoneAvg, lastWeek.phoneAvg),
      habits7: habitStats(data, lastNDays(7, today)),
      last7: periodStats(data, lastNDays(7, today)),
      todayScore: dayScore(data, today).score,
    };
  }, [data, today]);

  const getCell = useMemo(() => scoreCell(data), [data]);
  const isEmpty = data.days.size === 0 && data.routines.length === 0 && data.apps.length === 0 && data.goals.length === 0;
  const isSunday = isoWeekday(today) === 7;
  const { discipline: ds } = stats;
  const moodAvg = stats.last7.moodAvg;

  return (
    <>
      <PageHeader title={greeting()} subtitle={<>{fmtLong(today)} · <span className="text-fg">{motivation}</span></>} />


      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <DayTasksCard
          className="lg:col-span-2"
          date={today}
          title="Bugün yapılacaklar"
          action={
            <Link to="/gunluk" className="text-xs text-muted hover:text-fg">
              Günlük →
            </Link>
          }
        />
        <BacklogCard target={today} onSelect={(d) => navigate(`/gunluk?d=${d}`)} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FocusTimer />
        </div>
        <div className="lg:col-span-2">
          <GoalsCard />
        </div>
      </div>

      <InsightsCard limit={2} compact />

      {isSunday && (
        <Link to="/haftalik" className="mb-5 flex items-center gap-3 rounded-card border border-line bg-card p-4 hover:border-muted/50">
          <CalendarRange className="text-accent" size={22} />
          <div className="flex-1">
            <div className="text-sm font-semibold">Haftalık özetin hazır</div>
            <div className="text-xs text-muted">Bu haftayı geçen haftayla karşılaştır.</div>
          </div>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Hoş geldin! Henüz veri yok."
          text="Önce Ayarlar’dan takip ettiğin uygulamaları ve rutinlerini ekle (hazır rutin önerileri de var), sonra her akşam check-in yap."
          action={
            <Link to="/ayarlar" className="btn-primary">
              Ayarlara git
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Stat
              label="Disiplin serisi"
              value={
                <>
                  {ds.current} <span className="text-base font-normal text-muted">gün</span>
                </>
              }
              sub={`En uzun ${ds.longest} · içeriksiz seri ${ds.pornFreeCurrent}`}
              tone={ds.current > 0 ? 'good' : undefined}
              to="/disiplin"
            />
            {screenOn(data) &&
              (stats.thisWeek.phoneAvg != null ? (
              <Stat
                label="Telefon · bu hafta"
                value={formatMinutes(stats.thisWeek.phoneAvg)}
                sub={
                  <span className="flex flex-wrap items-center gap-1">
                    günlük ort. · geçen haftaya göre <Delta value={stats.phoneDelta} lowerIsBetter />
                  </span>
                }
                to="/ekran"
              />
            ) : (
              <Stat
                label="Ekran süresi · bu hafta"
                value={stats.thisWeek.screenAvg != null ? formatMinutes(stats.thisWeek.screenAvg) : '—'}
                sub={
                  <span className="flex flex-wrap items-center gap-1">
                    takip edilenler, günlük ort. · <Delta value={stats.screenDelta} lowerIsBetter />
                  </span>
                }
                to="/ekran"
              />
            ))}
            <Stat
              label="Erteleme · son 7 gün"
              value={stats.habits7.procrastAvg != null ? `${stats.habits7.procrastAvg.toFixed(1)}` : '—'}
              sub={stats.habits7.procrastAvg != null ? `günlük ort. · ${stats.habits7.movedTasks} iş yarına taşındı` : 'Check-in’de erteleme sayını gir'}
              to="/disiplin"
            />
            <Stat
              label="Mood · son 7 gün"
              value={moodAvg != null ? `${moodEmoji(moodAvg)} ${moodAvg.toFixed(1)}` : '—'}
              sub={stats.last7.energyAvg != null ? `Enerji ort. ${stats.last7.energyAvg.toFixed(1)}` : 'Henüz giriş yok'}
              to="/haftalik"
            />
            <Stat
              label="Uyku · son 7 gün"
              value={formatHours(stats.last7.sleepAvg)}
              sub={stats.last7.sleepAvg != null ? 'gecelik ortalama' : 'Check-in’de uyku saatini gir'}
              tone={stats.last7.sleepAvg == null ? undefined : stats.last7.sleepAvg >= 7 ? 'good' : stats.last7.sleepAvg < 6 ? 'bad' : undefined}
              to="/haftalik"
            />
          </div>

          <Card
            title="Gün skoru"
            action={<span className="text-xs text-muted">Son 12 ay · güne tıkla, düzenle</span>}
          >
            <Heatmap getCell={getCell} onSelect={(d) => navigate(`/checkin/${d}`)} legend={{ low: '0', high: '100' }} />
            <p className="mt-3 text-xs text-muted">
              {weightText(data)} ağırlıkla hesaplanır. Ağırlıkları Ayarlar’dan değiştirebilirsin.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
