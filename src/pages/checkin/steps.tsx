import { ArrowRightToLine, Minus, Plus, Settings2, Smartphone, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { addTask, deleteTask, moveTaskToNextDay, setRoutineDone, setTaskDone } from '../../db/actions';
import { QuadrantBadge } from '../../components/Eisenhower';
import { Checkbox, cn, Kbd, ProgressBar } from '../../components/ui';
import { useData } from '../../hooks/useAppData';
import { CAUSES, ENERGY_LABELS, MOOD_MAX, moodEmoji, moodLabel, PLACES, TIME_SLOTS } from '../../lib/constants';
import { addDaysISO, fmt, formatHours, formatMinutes } from '../../lib/date';
import { dueRoutines, isRoutineDone } from '../../lib/metrics';
import { type CheckinForm, parseMinutes, parsePhoneTotal, parseSleep } from './form';

type StepProps = { form: CheckinForm; update: (p: Partial<CheckinForm>) => void };

/** Input/textarea dışındayken tek tuş kısayolları için */
function useHotkeys(handler: (key: string, e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      ref.current(e.key.toLowerCase(), e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

/* ---------------- 1. Ekran süresi ---------------- */

export function StepScreen({ form, update }: StepProps) {
  const { activeApps } = useData();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Sıra: uygulamalar, sonra telefon toplamı (saat, dakika)
  const fieldCount = activeApps.length + 2;

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const total = activeApps.reduce((s, a) => s + (parseMinutes(form.screen[a.id]) ?? 0), 0);
  const totalLimit = activeApps.reduce((s, a) => s + a.limit, 0);
  const phone = parsePhoneTotal(form.phoneH, form.phoneM);
  const untracked = phone != null ? phone - total : null;

  const setRef = (i: number) => (el: HTMLInputElement | null) => {
    refs.current[i] = el;
  };
  // Enter → sonraki kutu; son kutuda Enter sonraki adıma geçer
  const onKey = (i: number) => (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && i < fieldCount - 1) {
      e.preventDefault();
      e.stopPropagation();
      refs.current[i + 1]?.focus();
      refs.current[i + 1]?.select();
    }
  };

  return (
    <div>
      {activeApps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
          Henüz takip ettiğin bir uygulama yok.
          <div className="mt-3">
            <Link to="/ayarlar" className="btn-ghost">
              <Settings2 size={15} /> Ayarlar’dan uygulama ekle
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">Her uygulama için dakikayı yaz. Boş bırakılanlar 0 sayılır.</p>
          <div className="space-y-2">
            {activeApps.map((a, i) => {
              const m = parseMinutes(form.screen[a.id]);
              const over = a.limit > 0 && m != null && m > a.limit;
              return (
                <div
                  key={a.id}
                  className={cn('flex items-center gap-3 rounded-xl border px-3 py-2', over ? 'border-danger/50 bg-danger-soft' : 'border-line bg-bg')}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    {a.limit > 0 && (
                      <div className="mt-1.5 max-w-48">
                        <ProgressBar value={(m ?? 0) / a.limit} tone={over ? 'bad' : 'good'} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={setRef(i)}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      className={cn('input w-20 text-right tabular-nums', over && 'border-danger text-danger')}
                      value={form.screen[a.id] ?? ''}
                      onChange={(e) => update({ screen: { ...form.screen, [a.id]: e.target.value } })}
                      onKeyDown={onKey(i)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className={cn('w-16 text-xs', over ? 'text-danger' : 'text-muted')}>{a.limit > 0 ? `/ ${a.limit} dk` : 'dk'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-sm">
            <span className="text-muted">Takip edilenler toplamı</span>
            <span className={cn('font-semibold tabular-nums', totalLimit > 0 && total > totalLimit && 'text-danger')}>
              {formatMinutes(total)}
              {totalLimit > 0 && <span className="font-normal text-muted"> / {formatMinutes(totalLimit)}</span>}
            </span>
          </div>
        </>
      )}

      <div className="mt-4 rounded-xl border border-line bg-bg px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Smartphone size={16} className="shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Telefonun toplam ekran süresi</div>
            <div className="text-xs text-muted">Ekran Süresi / Dijital Denge’deki günlük toplam (opsiyonel)</div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={setRef(activeApps.length)}
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              placeholder="0"
              className="input w-14 text-right tabular-nums"
              value={form.phoneH}
              onChange={(e) => update({ phoneH: e.target.value })}
              onKeyDown={onKey(activeApps.length)}
              onFocus={(e) => e.target.select()}
              aria-label="Saat"
            />
            <span className="text-xs text-muted">sa</span>
            <input
              ref={setRef(activeApps.length + 1)}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              placeholder="0"
              className="input w-14 text-right tabular-nums"
              value={form.phoneM}
              onChange={(e) => update({ phoneM: e.target.value })}
              onKeyDown={onKey(activeApps.length + 1)}
              onFocus={(e) => e.target.select()}
              aria-label="Dakika"
            />
            <span className="text-xs text-muted">dk</span>
          </div>
        </div>
        {untracked != null && activeApps.length > 0 && (
          <div className="mt-2 text-xs text-muted">
            {untracked > 0 ? (
              <>
                Listede olmayan uygulamalar: <span className="text-fg">{formatMinutes(untracked)}</span>
              </>
            ) : untracked < 0 ? (
              <span className="text-danger">Toplam, uygulamaların toplamından az görünüyor — kontrol et.</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 2. Rutinler ve işler ---------------- */

export function StepTasks({ date, form, update }: StepProps & { date: string }) {
  const data = useData();
  const routines = dueRoutines(data, date);
  const tasks = data.tasksByDate.get(date) ?? [];
  const [title, setTitle] = useState('');

  const items = [
    ...routines.map((r) => ({
      key: r.id,
      title: r.title,
      done: isRoutineDone(data, r.id, date),
      toggle: (v: boolean) => setRoutineDone(r.id, date, v),
      task: null as null | (typeof tasks)[number],
    })),
    ...tasks.map((t) => ({ key: t.id, title: t.title, done: t.done, toggle: (v: boolean) => setTaskDone(t.id, v), task: t })),
  ];

  useHotkeys((key) => {
    const n = Number(key);
    if (n >= 1 && n <= 9 && items[n - 1]) void items[n - 1].toggle(!items[n - 1].done);
    else if (key === '+' || key === '=') update({ procrastination: (form.procrastination ?? 0) + 1 });
    else if (key === '-') update({ procrastination: Math.max(0, (form.procrastination ?? 0) - 1) });
  });

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted">Yaptıklarını tikle (kısayol: 1–9)</span>
        {items.length > 0 && (
          <span className="tabular-nums text-muted">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
          Bu gün için rutin ya da iş yok. Aşağıdan hızlıca ekleyebilir veya{' '}
          <Link to="/ayarlar" className="text-accent hover:underline">
            Ayarlar’dan rutin
          </Link>{' '}
          tanımlayabilirsin.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={it.key} className="group flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
              <span className="w-3 text-[10px] text-muted tabular-nums">{i < 9 ? i + 1 : ''}</span>
              <Checkbox checked={it.done} onChange={(v) => void it.toggle(v)} label={it.title} />
              <button
                className={cn('min-w-0 flex-1 cursor-pointer truncate text-left text-sm', it.done && 'text-muted line-through')}
                onClick={() => void it.toggle(!it.done)}
                tabIndex={-1}
              >
                {it.title}
              </button>
              {it.task ? (
                <>
                  <QuadrantBadge task={it.task} />
                  {!it.done && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void moveTaskToNextDay(it.task!.id)} title="Yarına taşı">
                      <ArrowRightToLine size={13} /> Yarına taşı
                    </button>
                  )}
                  <button className="btn-icon h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => void deleteTask(it.task!.id)} title="Sil">
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted">rutin</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Plus size={16} className="text-muted" />
        <input
          className="input"
          placeholder="Bu güne iş ekle… (Enter)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault();
              e.stopPropagation();
              void addTask(title, date);
              setTitle('');
            }
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Bugün kaç kez erteledim?</div>
          <div className="text-xs text-muted">Aklına geleni yapmayıp sonraya attığın ya da yarım bıraktığın her şey (+/− tuşları)</div>
        </div>
        <Counter value={form.procrastination} onChange={(v) => update({ procrastination: v })} />
      </div>
    </div>
  );
}

/* ---------------- 3. Disiplin ---------------- */

export function Counter({ value, onChange, max = 99 }: { value: number | null; onChange: (v: number) => void; max?: number }) {
  const v = value ?? 0;
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-bg">
      <button type="button" className="btn-icon h-9 w-9" onClick={() => onChange(Math.max(0, v - 1))} aria-label="Azalt">
        <Minus size={15} />
      </button>
      <span className={cn('w-10 text-center text-lg font-semibold tabular-nums', value == null && 'text-muted')}>{v}</span>
      <button type="button" className="btn-icon h-9 w-9" onClick={() => onChange(Math.min(max, v + 1))} aria-label="Artır">
        <Plus size={15} />
      </button>
    </div>
  );
}

function YesNo({
  question,
  hint,
  value,
  goodWhen,
  active,
  onChange,
  onFocus,
}: {
  question: string;
  hint?: string;
  value: boolean | null;
  /** Hangi cevap "iyi" (yeşil) */
  goodWhen: boolean;
  active: boolean;
  onChange: (v: boolean) => void;
  onFocus: () => void;
}) {
  const btn = (v: boolean) => {
    const on = value === v;
    const good = v === goodWhen;
    return (
      <button
        type="button"
        onClick={() => onChange(v)}
        className={cn(
          'w-20 cursor-pointer rounded-lg border py-2 text-sm font-medium',
          on && good && 'border-accent bg-accent-soft text-accent',
          on && !good && 'border-danger bg-danger-soft text-danger',
          !on && 'border-line bg-card text-muted hover:text-fg',
        )}
      >
        {v ? 'Evet' : 'Hayır'}
      </button>
    );
  };
  return (
    <div
      onClick={onFocus}
      className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3', active ? 'border-muted/60 bg-bg' : 'border-line bg-bg/50')}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{question}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="flex gap-2">
        {btn(true)}
        {btn(false)}
      </div>
    </div>
  );
}

export function StepDiscipline({ form, update }: StepProps) {
  // Klavye: E/H aktif soruyu yanıtlar ve sonrakine geçer; rakamlar yeltenme sayısını girer
  const [row, setRow] = useState<0 | 1>(form.clean == null ? 0 : 1);

  const answer = (v: boolean) => {
    if (row === 0) {
      update({ clean: v });
      setRow(1);
    } else update({ porn: v });
  };
  useHotkeys((key) => {
    if (key === 'e' || key === 'y') answer(true);
    else if (key === 'h' || key === 'n') answer(false);
    else if (/^[0-9]$/.test(key)) update({ urges: Number(key) });
    else if (key === '+' || key === '=') update({ urges: (form.urges ?? 0) + 1 });
    else if (key === '-') update({ urges: Math.max(0, (form.urges ?? 0) - 1) });
  });

  const t = form.trigger;
  const setT = (p: Partial<typeof t>) => update({ trigger: { ...t, ...p } });
  const slipped = form.clean === false || form.porn === true;

  return (
    <div>
      <div className="space-y-2">
        <YesNo
          question="Bugün temiz miyim?"
          hint="Mastürbasyon / boşalma olmadı"
          value={form.clean}
          goodWhen
          active={row === 0}
          onFocus={() => setRow(0)}
          onChange={(v) => {
            update({ clean: v });
            setRow(1);
          }}
        />
        <YesNo
          question="Porno izledim mi?"
          hint="Kısa süreli bakmak da sayılır"
          value={form.porn}
          goodWhen={false}
          active={row === 1}
          onFocus={() => setRow(1)}
          onChange={(v) => update({ porn: v })}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Kaç kez yeltendim?</div>
            <div className="text-xs text-muted">Başlayıp bıraktıysan ya da dürtüye kapılıp durduysan — boşalmasan da say</div>
          </div>
          <Counter value={form.urges} onChange={(v) => update({ urges: v })} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        <Kbd>E</Kbd>/<Kbd>H</Kbd> sırayla soruları yanıtlar · <Kbd>0</Kbd>–<Kbd>9</Kbd> yeltenme sayısı
      </p>

      {slipped && (
        <div className="mt-5 space-y-4 rounded-xl border border-line bg-bg p-4">
          <div className="text-sm text-muted">Sorun değil — kayıt tutmak da ilerleme. Ne oldu? (opsiyonel)</div>
          <ChipGroup
            label="Saat"
            options={TIME_SLOTS.map((s) => ({ value: s.key, label: `${s.label} ${s.range}` }))}
            value={t.slot ? [t.slot] : []}
            onToggle={(v) => setT({ slot: t.slot === v ? undefined : v })}
          />
          <ChipGroup
            label="Ortam"
            options={PLACES.map((p) => ({ value: p, label: p }))}
            value={t.place ? [t.place] : []}
            onToggle={(v) => setT({ place: t.place === v ? undefined : v })}
          />
          <ChipGroup
            label="Ne tetikledi?"
            options={CAUSES.map((c) => ({ value: c, label: c }))}
            value={t.causes}
            onToggle={(v) => setT({ causes: t.causes.includes(v) ? t.causes.filter((x) => x !== v) : [...t.causes, v] })}
          />
          <input className="input" placeholder="Serbest not…" value={t.note ?? ''} onChange={(e) => setT({ note: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="label mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" className={cn('chip', value.includes(o.value) && 'chip-on')} onClick={() => onToggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 4. Uyku ---------------- */

const SLEEP_PRESETS = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export function StepSleep({ date, form, update, onDone }: StepProps & { date: string; onDone: () => void }) {
  const { today } = useData();
  const question =
    date === today
      ? 'Dün gece kaç saat uyudun?'
      : date === addDaysISO(today, -1)
        ? 'Dün sabah uyandığında kaç saat uyumuştun? (önceki gece)'
        : `${fmt(date, 'd MMMM')} sabahı uyandığında kaç saat uyumuştun?`;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const parsed = parseSleep(form.sleep);
  const invalid = form.sleep.trim() !== '' && parsed == null;

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{question} (ör. 7,5 ya da 7:30 — opsiyonel)</p>
      <div className="flex items-center gap-3">
        <input
          ref={ref}
          inputMode="decimal"
          placeholder="7,5"
          className={cn('input w-28 py-3 text-center text-lg tabular-nums', invalid && 'border-danger text-danger')}
          value={form.sleep}
          onChange={(e) => update({ sleep: e.target.value })}
        />
        <span className="text-sm text-muted">saat</span>
        {parsed != null && (
          <span className={cn('text-sm', parsed < 6 ? 'text-danger' : parsed >= 7 ? 'text-accent' : 'text-fg')}>{formatHours(parsed)}</span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {SLEEP_PRESETS.map((h) => (
          <button
            key={h}
            type="button"
            className={cn('chip', parsed === h && 'chip-on')}
            onClick={() => {
              update({ sleep: String(h).replace('.', ',') });
              setTimeout(onDone, 180);
            }}
          >
            {String(h).replace('.', ',')} sa
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Yetişkinler için önerilen aralık 7–9 saat.</p>
    </div>
  );
}

/* ---------------- 5. Mood ve enerji ---------------- */

export function StepMood({ form, update, onDone }: StepProps & { onDone: () => void }) {
  const [row, setRow] = useState<0 | 1>(form.mood == null ? 0 : 1);

  const setMood = (v: number) => {
    update({ mood: v });
    setRow(1);
  };
  const setEnergy = (v: number) => {
    update({ energy: v });
    if (form.mood != null) setTimeout(onDone, 220);
  };

  // Mood: 1–9, 0 = 10 · Enerji: 1–5
  useHotkeys((key) => {
    if (!/^[0-9]$/.test(key)) return;
    const n = Number(key);
    if (row === 0) setMood(n === 0 ? 10 : n);
    else if (n >= 1 && n <= 5) setEnergy(n);
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <div className={cn('label', row === 0 && 'text-fg')}>
            Mood {row === 0 && <span className="normal-case">· 1–10 (0 = 10)</span>}
          </div>
          <div className="text-sm">
            {form.mood != null ? (
              <>
                <span className="text-xl">{moodEmoji(form.mood)}</span>{' '}
                <span className="font-semibold tabular-nums">{form.mood}</span>
                <span className="text-muted">/10 · {moodLabel(form.mood)}</span>
              </>
            ) : (
              <span className="text-muted">seçilmedi</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: MOOD_MAX }, (_, i) => i + 1).map((v) => {
            const on = form.mood === v;
            return (
              <button
                key={v}
                onClick={() => setMood(v)}
                title={`${v} · ${moodLabel(v)}`}
                className={cn(
                  'flex h-12 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold tabular-nums',
                  on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-bg text-muted hover:border-muted hover:text-fg',
                )}
                // Düşükten yükseğe hafif renk geçişi
                style={on ? undefined : { boxShadow: `inset 0 -3px 0 color-mix(in srgb, var(--danger) ${100 - v * 10}%, var(--accent))` }}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>Çok kötü</span>
          <span>Harika</span>
        </div>
      </div>
      <div>
        <div className={cn('label mb-2', row === 1 && 'text-fg')}>Enerji {row === 1 && <span className="normal-case">· 1–5</span>}</div>
        <div className="grid grid-cols-5 gap-2">
          {ENERGY_LABELS.map((label, i) => {
            const v = i + 1;
            const active = form.energy != null && v <= form.energy;
            return (
              <button
                key={v}
                onClick={() => setEnergy(v)}
                title={label}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-xl border py-3',
                  form.energy === v ? 'border-accent bg-accent-soft' : 'border-line bg-bg hover:border-muted',
                )}
              >
                <span className="flex gap-1">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span key={j} className={cn('h-2 w-2 rounded-full', j < v ? (active ? 'bg-accent' : 'bg-muted') : 'bg-line')} />
                  ))}
                </span>
                <span className="text-[11px] text-muted">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 6. Not ---------------- */

export function StepNote({ form, update }: StepProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Günü tek cümleyle özetle (opsiyonel).</p>
      <input
        ref={ref}
        className="input py-3 text-base"
        maxLength={200}
        placeholder="Bugün…"
        value={form.note}
        onChange={(e) => update({ note: e.target.value })}
      />
      <p className="mt-2 text-xs text-muted">
        <Kbd>Enter</Kbd> ile günü kapat.
      </p>
    </div>
  );
}
