import { Pause, Play, Square, Timer, X } from 'lucide-react';
import { useState } from 'react';
import { cancelFocus, pauseFocus, resumeFocus, startFocus, stopFocus } from '../db/actions';
import { useData } from '../hooks/useAppData';
import { categoryOf, FOCUS_SUGGESTIONS, focusTotal, formatClock, loadLastFocus, parseTarget, saveLastFocus, useFocusClock } from '../lib/focus';
import { formatMinutes } from '../lib/date';
import { cn } from './ui';

/**
 * Tek tıkla başlatılan odak zamanlayıcısı. Seans ayarlarda tutulduğu için
 * sayfa yenilense, widget'tan ya da başka sekmeden bakılsa da kesintisiz sürer.
 */
export function FocusTimer({ compact = false }: { compact?: boolean }) {
  const data = useData();
  const f = data.settings.activeFocus ?? null;
  const cats = data.settings.focusCategories ?? [];
  const cat = f ? categoryOf(data, f.categoryId) : null;
  const clock = useFocusClock(f, cat?.name ?? '');
  const [minutes, setMinutes] = useState(() => loadLastFocus().minutes);
  const target = parseTarget(minutes);
  const start = (id: string) => {
    saveLastFocus({ ...loadLastFocus(), minutes });
    void startFocus(id, target);
  };
  const [saved, setSaved] = useState<string | null>(null);
  const today = focusTotal(data, data.today);

  const stop = async () => {
    const name = cat?.name;
    const min = await stopFocus();
    setSaved(min >= 1 ? `${formatMinutes(min)} ${name} kaydedildi` : '1 dakikadan kısa, kaydedilmedi');
    setTimeout(() => setSaved(null), 3500);
  };

  if (f && cat) {
    const running = f.runningSince != null;
    return (
      <div className={cn('relative overflow-hidden rounded-xl border', compact ? 'p-3' : 'p-5')} style={{ borderColor: `${cat.color}66`, background: `linear-gradient(135deg, ${cat.color}26, transparent 70%)` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: cat.color }}>
            <span className={cn('h-2 w-2 rounded-full', running && 'animate-pulse')} style={{ background: cat.color }} />
            {cat.name} {!running && <span className="text-muted normal-case">· duraklatıldı</span>}
          </span>
          {f.targetMin && <span className="text-[11px] text-muted">hedef {f.targetMin} dk</span>}
        </div>
        <div className={cn('mt-1 font-semibold tabular-nums tracking-tight', compact ? 'text-3xl' : 'text-6xl', clock.reached && 'text-accent')}>{formatClock(clock.ms)}</div>
        {clock.progress != null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${clock.progress * 100}%`, background: cat.color }} />
          </div>
        )}
        {clock.reached && <div className="mt-1 text-xs text-accent">Hedef tamam 🎉 Mola verebilir ya da devam edebilirsin.</div>}
        <div className={cn('flex items-center gap-2', compact ? 'mt-2' : 'mt-4')}>
          {running ? (
            <button className="btn-ghost" onClick={() => void pauseFocus()}>
              <Pause size={15} /> {compact ? '' : 'Duraklat'}
            </button>
          ) : (
            <button className="btn-ghost" onClick={() => void resumeFocus()}>
              <Play size={15} /> Devam
            </button>
          )}
          <button className="btn-primary" onClick={() => void stop()}>
            <Square size={14} /> {compact ? 'Bitir' : 'Bitir & kaydet'}
          </button>
          <button className="btn-icon ml-auto" title="Kaydetmeden iptal et" onClick={() => void cancelFocus()}>
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-line bg-bg', compact ? 'p-3' : 'p-5')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Timer size={15} className="text-accent" /> Odak seansı başlat
        </span>
        <span className="text-xs text-muted">bugün {formatMinutes(today)}</span>
      </div>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            className="input w-24 text-right tabular-nums"
            placeholder="serbest"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))}
            aria-label="Süre (dakika)"
          />
          <span className="text-sm text-muted">dakika {target == null && <span className="text-xs">· boş = serbest</span>}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FOCUS_SUGGESTIONS.map((m) => (
            <button key={m} className={cn('chip', target === m && 'chip-on')} onClick={() => setMinutes(target === m ? '' : String(m))}>
              {m} dk
            </button>
          ))}
        </div>
      </div>
      {cats.length === 0 ? (
        <p className="text-sm text-muted">Odak sayfasından kategori ekle.</p>
      ) : (
        <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => start(c.id)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-sm font-medium hover:brightness-110"
              style={{ boxShadow: `inset 3px 0 0 ${c.color}` }}
            >
              <Play size={14} style={{ color: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
      {saved && <div className="mt-3 text-xs text-accent">✓ {saved}</div>}
    </div>
  );
}
