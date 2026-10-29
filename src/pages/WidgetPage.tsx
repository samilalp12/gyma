import { BrickWall, Flame, Gauge, ListChecks, Pause, Play, Square, StickyNote, Target, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Checkbox, cn } from '../components/ui';
import { addTask, pauseFocus, resumeFocus, setRoutineDone, setTaskDone, startFocusByName, stopFocus } from '../db/actions';
import { useData } from '../hooks/useAppData';
import { checkinTarget } from '../lib/checkin';
import { weekStartISO } from '../lib/date';
import { openMainWindow } from '../lib/desktop';
import { brickOf } from '../lib/eisenhower';
import { categoryOf, FOCUS_SUGGESTIONS, focusTotal, formatClock, loadLastFocus, parseTarget, saveLastFocus, useFocusClock } from '../lib/focus';
import { completion, dayScore, disciplineStats, dueRoutines, isRoutineDone } from '../lib/metrics';

type Page = 'odak' | 'bugun' | 'not' | 'hedef' | 'ozet';

const PAGES: { key: Page; label: string; icon: typeof Timer }[] = [
  { key: 'odak', label: 'Odak', icon: Timer },
  { key: 'bugun', label: 'Bugün', icon: ListChecks },
  { key: 'not', label: 'Not', icon: StickyNote },
  { key: 'hedef', label: 'Hedef', icon: Target },
  { key: 'ozet', label: 'Özet', icon: Gauge },
];

const PAGE_KEY = 'gyma:widgetPage';

/**
 * Masaüstü widget'ı — hava durumu widget'ı boyutunda (≈170×170), tek renk.
 * Sağ üstteki ikonlarla sayfa değişir; seçilen sayfa hatırlanır.
 */
export function WidgetPage() {
  const [page, setPage] = useState<Page>(() => {
    try {
      return (localStorage.getItem(PAGE_KEY) as Page) || 'odak';
    } catch {
      return 'odak';
    }
  });

  useEffect(() => {
    document.documentElement.classList.add('widget-mode');
    return () => document.documentElement.classList.remove('widget-mode');
  }, []);

  const select = (p: Page) => {
    setPage(p);
    try {
      localStorage.setItem(PAGE_KEY, p);
    } catch {
      /* yoksay */
    }
  };

  return (
    <div className="widget-shell flex h-[170px] w-[170px] flex-col overflow-hidden rounded-[22px] px-3 pb-2.5 pt-2.5 text-fg">
      {/* Başlıktan tutup sürükleyerek taşınır */}
      <div data-tauri-drag-region className="mb-1.5 flex h-[18px] shrink-0 cursor-grab items-center justify-between">
        <span data-tauri-drag-region className="text-[11px] font-semibold text-muted">
          {PAGES.find((p) => p.key === page)!.label}
        </span>
        <span className="flex items-center gap-0.5">
          {PAGES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => select(key)}
              title={label}
              className={cn('flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-md', page === key ? 'bg-card-2 text-accent' : 'text-muted hover:text-fg')}
            >
              <Icon size={11} strokeWidth={2.2} />
            </button>
          ))}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {page === 'odak' && <FocusPage />}
        {page === 'bugun' && <TodayPage />}
        {page === 'not' && <NotePage />}
        {page === 'hedef' && <GoalsPage />}
        {page === 'ozet' && <SummaryPage />}
      </div>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto truncate pt-1 text-[10px] text-muted">{children}</div>;
}

/* ---------------- Odak ---------------- */

function FocusPage() {
  const data = useData();
  const f = data.settings.activeFocus ?? null;
  const cat = f ? categoryOf(data, f.categoryId) : null;
  const clock = useFocusClock(f, cat?.name ?? '');
  const last = loadLastFocus();
  const [name, setName] = useState(last.category || data.settings.focusCategories?.[0]?.name || '');
  const [minutes, setMinutes] = useState(last.minutes);
  const todaySessions = data.sessions.filter((s) => s.date === data.today).length;
  const footer = (
    <Footer>
      bugün {Math.round(focusTotal(data, data.today))} dk · {todaySessions} seans
    </Footer>
  );

  if (f && cat) {
    const running = f.runningSince != null;
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: cat.color }}>
          <span className={cn('h-1.5 w-1.5 rounded-full', running && 'animate-pulse')} style={{ background: cat.color }} />
          <span className="truncate">{cat.name}</span>
          {f.targetMin && <span className="ml-auto font-normal text-muted">/{f.targetMin} dk</span>}
        </div>
        <div className={cn('mt-0.5 text-[30px] font-semibold leading-none tabular-nums tracking-tight', clock.reached && 'text-accent')}>{formatClock(clock.ms)}</div>
        {clock.progress != null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full" style={{ width: `${clock.progress * 100}%`, background: cat.color }} />
          </div>
        )}
        <div className="mt-2 flex gap-1.5">
          <button
            className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-card-2 text-[11px]"
            onClick={() => void (running ? pauseFocus() : resumeFocus())}
          >
            {running ? <Pause size={12} /> : <Play size={12} />} {running ? 'Duraklat' : 'Devam'}
          </button>
          <button className="flex h-7 flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-accent text-[11px] font-semibold text-accent-ink" onClick={() => void stopFocus()}>
            <Square size={11} /> Bitir
          </button>
        </div>
        {footer}
      </div>
    );
  }

  const target = parseTarget(minutes);
  const start = () => {
    if (!name.trim()) return;
    saveLastFocus({ category: name.trim(), minutes });
    void startFocusByName(name, target);
  };

  return (
    <form
      className="flex h-full flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start();
      }}
    >
      {/* Kategori: listeden seç ya da yeni bir şey yaz */}
      <input
        list="gyma-focus-cats"
        className="h-7 w-full rounded-lg border border-line bg-bg px-2 text-[12px] outline-none focus:border-accent"
        placeholder="Ne çalışıyorsun?"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <datalist id="gyma-focus-cats">
        {(data.settings.focusCategories ?? []).map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <div className="flex items-center gap-1">
        <input
          inputMode="numeric"
          className="h-6 w-10 rounded-md border border-line bg-bg px-1 text-right text-[11px] tabular-nums outline-none focus:border-accent"
          placeholder="dk"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ''))}
          aria-label="Süre (dakika), boş = serbest"
        />
        {FOCUS_SUGGESTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={cn('h-6 flex-1 cursor-pointer rounded-md border text-[10px]', target === m ? 'border-accent text-accent' : 'border-line text-muted hover:text-fg')}
            onClick={() => setMinutes(target === m ? '' : String(m))}
          >
            {m}
          </button>
        ))}
      </div>
      <button type="submit" disabled={!name.trim()} className="flex h-7 cursor-pointer items-center justify-center gap-1 rounded-lg bg-accent text-[11px] font-semibold text-accent-ink disabled:opacity-40">
        <Play size={12} /> Başlat {target ? `· ${target} dk` : '· serbest'}
      </button>
      {footer}
    </form>
  );
}

/* ---------------- Bugün ---------------- */

function TodayPage() {
  const data = useData();
  const { today } = data;
  const brick = brickOf(data, today);
  const items = useMemo(
    () => [
      ...dueRoutines(data, today)
        .filter((r) => !isRoutineDone(data, r.id, today))
        .map((r) => ({ id: r.id, title: r.title, toggle: () => setRoutineDone(r.id, today, true) })),
      ...(data.tasksByDate.get(today) ?? []).filter((t) => !t.done && !t.brick).map((t) => ({ id: t.id, title: t.title, toggle: () => setTaskDone(t.id, true) })),
    ],
    [data, today],
  );
  const comp = completion(data, today);
  const shown = items.slice(0, brick && !brick.done ? 3 : 4);

  return (
    <div className="flex h-full flex-col">
      {brick && !brick.done && (
        <button onClick={() => void setTaskDone(brick.id, true)} className="mb-1 flex cursor-pointer items-center gap-1.5 truncate text-left text-[12px] font-medium text-accent" title="Günün Tuğlası · tamamla">
          <BrickWall size={11} className="shrink-0" />
          <span className="truncate">{brick.title}</span>
        </button>
      )}
      {shown.length === 0 && !(brick && !brick.done) ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-muted">Liste boş 🎉</div>
      ) : (
        <ul className="space-y-1">
          {shown.map((it) => (
            <li key={it.id} className="flex items-center gap-1.5 text-[12px]">
              <span className="origin-left scale-[0.8]">
                <Checkbox checked={false} onChange={() => void it.toggle()} label={it.title} />
              </span>
              <span className="-ml-1 truncate">{it.title}</span>
            </li>
          ))}
        </ul>
      )}
      <Footer>
        {comp.done}/{comp.total} tamam{items.length > shown.length ? ` · +${items.length - shown.length} daha` : ''}
      </Footer>
    </div>
  );
}

/* ---------------- Not ---------------- */

function NotePage() {
  const data = useData();
  const [text, setText] = useState('');
  const recent = data.backlog.filter((t) => !t.done).slice(-3).reverse();
  return (
    <div className="flex h-full flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void addTask(text, null);
          setText('');
        }}
      >
        <input
          className="h-7 w-full rounded-lg border border-line bg-bg px-2 text-[12px] outline-none focus:border-accent"
          placeholder="Not al… (Enter)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
      <ul className="mt-1.5 space-y-1">
        {recent.map((t) => (
          <li key={t.id} className="truncate text-[11px] text-muted">
            · {t.title}
          </li>
        ))}
      </ul>
      <Footer>Bekleyen işlere eklenir</Footer>
    </div>
  );
}

/* ---------------- Hedef ---------------- */

function GoalsPage() {
  const data = useData();
  const goals = data.goals.filter((g) => g.period === 'week' && g.start === weekStartISO(data.today));
  const pct = (g: (typeof goals)[number]) => (g.kind === 'bar' ? g.progress : g.done ? 100 : 0);
  return (
    <div className="flex h-full flex-col">
      {goals.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-[11px] text-muted">Bu hafta için hedef yok</div>
      ) : (
        <ul className="space-y-1.5">
          {goals.slice(0, 4).map((g) => (
            <li key={g.id} className="text-[11px]">
              <div className="flex justify-between gap-1">
                <span className={cn('truncate', g.done && 'text-muted line-through')}>{g.title}</span>
                <span className="tabular-nums text-muted">%{pct(g)}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-card-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct(g)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Footer>
        bu hafta · {goals.filter((g) => g.done).length}/{goals.length} tamam
      </Footer>
    </div>
  );
}

/* ---------------- Özet ---------------- */

function SummaryPage() {
  const data = useData();
  const ds = disciplineStats(data);
  const score = dayScore(data, data.today).score;
  const target = checkinTarget(data);
  const closed = data.days.get(target)?.closed;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end gap-1.5">
        <Flame size={16} className={cn('mb-1', ds.current > 0 ? 'text-accent' : 'text-muted')} />
        <span className="text-[30px] font-semibold leading-none tabular-nums">{ds.current}</span>
        <span className="mb-0.5 text-[11px] text-muted">gün temiz</span>
      </div>
      <div className="mt-1.5 text-[11px] text-muted">
        Gün skoru <span className="font-semibold text-fg">{score ?? '—'}</span> · odak {Math.round(focusTotal(data, data.today))} dk
      </div>
      <button
        className={cn('mt-auto h-7 cursor-pointer rounded-lg text-[11px] font-semibold', closed ? 'bg-card-2 text-muted' : 'bg-accent text-accent-ink')}
        onClick={() => void openMainWindow(closed ? '/' : `/checkin/${target}`)}
      >
        {closed ? 'Uygulamayı aç' : target !== data.today ? 'Dünün check-in’i' : 'Check-in yap'}
      </button>
    </div>
  );
}
