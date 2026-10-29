import { Flame, MoonStar, Pencil } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Stat } from '../../components/ui';
import { useData } from '../../hooks/useAppData';
import { moodEmoji } from '../../lib/constants';
import { fmtLong, formatHours, formatMinutes } from '../../lib/date';
import { completion, dayScore, disciplineStats, routineStats, screenStatus } from '../../lib/metrics';

export function DoneView({ date, onEdit }: { date: string; onEdit: () => void }) {
  const data = useData();
  const day = data.days.get(date);
  const s = useMemo(() => {
    const active = data.routines.filter((r) => !r.archived);
    return {
      score: dayScore(data, date).score,
      comp: completion(data, date),
      screen: screenStatus(data, day),
      disc: disciplineStats(data),
      routines: active.map((r) => ({ r, st: routineStats(data, r) })).sort((a, b) => b.st.current - a.st.current),
    };
  }, [data, date, day]);

  return (
    <div>
      <div className="mb-5 rounded-card border border-accent/30 bg-accent-soft px-6 py-8 text-center">
        <MoonStar className="mx-auto text-accent" size={32} />
        <div className="mt-3 text-2xl font-semibold">Gün kapandı ✓</div>
        <div className="mt-1 text-sm text-muted">{fmtLong(date)}</div>
        {s.score != null && (
          <div className="mt-4 text-sm">
            Gün skoru <span className="text-xl font-semibold tabular-nums text-accent">{s.score}</span>
            <span className="text-muted">/100</span>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Disiplin serisi" value={`${s.disc.current} gün`} tone={s.disc.current > 0 ? 'good' : undefined} sub={`En uzun ${s.disc.longest}`} />
        <Stat
          label="Tamamlanan"
          value={s.comp.total ? `${s.comp.done}/${s.comp.total}` : '—'}
          sub={s.comp.total ? `%${Math.round((s.comp.done / s.comp.total) * 100)}` : 'Madde yok'}
        />
        <Stat
          label="Ekran süresi"
          value={s.screen.hasData ? formatMinutes(s.screen.total) : '—'}
          tone={s.screen.over ? 'bad' : s.screen.hasData ? 'good' : undefined}
          sub={s.screen.over ? `${s.screen.overApps.length} uygulamada limit aşıldı` : s.screen.hasData ? 'Limitler içinde' : undefined}
        />
        <Stat
          label="Mood / enerji"
          value={day?.mood ? `${moodEmoji(day.mood)} ${day.mood}/10` : '—'}
          sub={[day?.energy ? `Enerji ${day.energy}/5` : '', day?.sleep != null ? `Uyku ${formatHours(day.sleep)}` : ''].filter(Boolean).join(' · ') || undefined}
        />
      </div>

      {s.routines.length > 0 && (
        <div className="mb-5 rounded-card border border-line bg-card p-4">
          <div className="label mb-3">Rutin serileri</div>
          <ul className="space-y-2">
            {s.routines.map(({ r, st }) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{r.title}</span>
                <span className="flex items-center gap-1 tabular-nums text-muted">
                  <Flame size={14} className={st.current > 0 ? 'text-accent' : ''} /> {st.current} gün
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-primary">
          Özete dön
        </Link>
        <button className="btn-ghost" onClick={onEdit}>
          <Pencil size={14} /> Düzenle
        </button>
      </div>
    </div>
  );
}
