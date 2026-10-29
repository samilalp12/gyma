import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveDay } from '../../db/actions';
import { cn, Kbd } from '../../components/ui';
import { useData } from '../../hooks/useAppData';
import { checkinTarget } from '../../lib/checkin';
import { screenOn } from '../../lib/metrics';
import { addDaysISO, fmtLong, relativeLabel } from '../../lib/date';
import { DoneView } from './DoneView';
import { type CheckinForm, formFromDay, formToPatch } from './form';
import { StepDiscipline, StepMood, StepNote, StepScreen, StepSleep, StepTasks } from './steps';

type StepKey = 'screen' | 'tasks' | 'discipline' | 'sleep' | 'mood' | 'note';

/** Tüm adımlar; ?step=N bu listeye göre (1 = ekran süresi, 3 = disiplin…) */
const ALL_STEPS: { key: StepKey; label: string }[] = [
  { key: 'screen', label: 'Ekran süresi' },
  { key: 'tasks', label: 'Rutinler & işler' },
  { key: 'discipline', label: 'Disiplin' },
  { key: 'sleep', label: 'Uyku' },
  { key: 'mood', label: 'Mood & enerji' },
  { key: 'note', label: 'Not' },
];

export function CheckinPage() {
  const { date: param } = useParams();
  const [search] = useSearchParams();
  const data = useData();
  const { today } = data;
  // Tarih verilmediyse: sabah erken saatte ve dün kapanmadıysa dünü aç
  const date = param ?? checkinTarget(data);
  const autoYesterday = !param && date !== today;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return <Navigate to="/checkin" replace />;
  const stepParam = Number(search.get('step'));
  const steps = screenOn(data) ? ALL_STEPS : ALL_STEPS.filter((x) => x.key !== 'screen');
  const wanted = ALL_STEPS[stepParam - 1]?.key;
  const initialStep = wanted ? Math.max(0, steps.findIndex((x) => x.key === wanted)) : null;
  return <Wizard key={`${date}-${initialStep}-${steps.length}`} date={date} initialStep={initialStep} autoYesterday={autoYesterday} steps={steps} />;
}

function Wizard({
  date,
  initialStep,
  autoYesterday,
  steps: STEPS,
}: {
  date: string;
  initialStep: number | null;
  autoYesterday: boolean;
  steps: { key: StepKey; label: string }[];
}) {
  const data = useData();
  const navigate = useNavigate();
  const prevDay = data.days.get(date);
  const [form, setForm] = useState<CheckinForm>(() => formFromDay(prevDay));
  // Kapanmış bir güne adım belirtilmeden gelindiyse önce özet görünsün
  const [step, setStep] = useState<number>(initialStep ?? (prevDay?.closed ? STEPS.length : 0));
  const dirty = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  const dataRef = useRef(data);
  dataRef.current = data;

  const update = useCallback((patch: Partial<CheckinForm>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const persist = useCallback(
    async (extra: Partial<Parameters<typeof saveDay>[1]> = {}) => {
      const d = dataRef.current;
      await saveDay(date, { ...formToPatch(formRef.current, d.days.get(date), d.activeApps), ...extra });
      dirty.current = false;
    },
    [date],
  );

  // Otomatik kayıt (yarıda bırakılırsa veri kaybolmasın)
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void persist(), 400);
    return () => clearTimeout(t);
  }, [form, persist]);

  // Hızlı art arda Enter'larda adım kaçmasın diye güncel adım ref'te de tutulur
  const stepRef = useRef(step);

  const goTo = useCallback(
    async (target: number) => {
      const from = stepRef.current;
      const to = Math.max(0, Math.min(STEPS.length, target));
      if (to === from) return;
      if (STEPS[from]?.key === 'screen' && to > from) {
        // Ekran adımı geçildiyse boş bırakılan uygulamalar 0 dk sayılır
        const filled = { ...formRef.current.screen };
        let changed = false;
        for (const a of dataRef.current.activeApps) {
          if (!filled[a.id]?.trim()) {
            filled[a.id] = '0';
            changed = true;
          }
        }
        if (changed) {
          formRef.current = { ...formRef.current, screen: filled };
          setForm(formRef.current);
          dirty.current = true;
        }
      }
      stepRef.current = to;
      if (to >= STEPS.length) {
        await persist({ closed: true });
        setStep(to);
        return;
      }
      setStep(to);
      if (dirty.current) await persist();
    },
    [persist],
  );

  const next = useCallback(() => void goTo(stepRef.current + 1), [goTo]);
  const back = useCallback(() => void goTo(stepRef.current - 1), [goTo]);

  // Enter = sonraki, Shift+Enter = önceki
  useEffect(() => {
    if (step >= STEPS.length) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (e.shiftKey) back();
      else next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [step, next, back]);

  const done = step >= STEPS.length;
  const isPast = date < data.today;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Gece check-in’i</h1>
          <p className="mt-0.5 text-sm text-muted">
            {relativeLabel(date, data.today)} · {fmtLong(date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-icon" title="Önceki gün" onClick={() => navigate(`/checkin/${addDaysISO(date, -1)}?step=1`)}>
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            className="input w-auto py-1.5"
            value={date}
            max={data.today}
            onChange={(e) => e.target.value && navigate(`/checkin/${e.target.value}?step=1`)}
          />
          <button
            className="btn-icon"
            title="Sonraki gün"
            disabled={!isPast}
            onClick={() => navigate(`/checkin/${addDaysISO(date, 1)}?step=1`)}
          >
            <ChevronRight size={18} />
          </button>
          {isPast && (
            <Link to={`/checkin/${data.today}`} className="btn-ghost ml-1 py-1.5">
              Bugün
            </Link>
          )}
        </div>
      </header>

      {autoYesterday && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
          <span>
            Henüz saat {data.settings.lateCheckinUntil} olmadığı ve dün kapanmadığı için <b>dünün</b> check-in’i açıldı.
          </span>
          <Link to={`/checkin/${data.today}`} className="text-xs text-muted hover:text-fg">
            Bugünü doldur →
          </Link>
        </div>
      )}

      {!done && (
        <div className="mb-5">
          <div className="flex gap-1.5">
            {STEPS.map(({ label: s }, i) => (
              <button key={s} onClick={() => void goTo(i)} className="group flex-1 cursor-pointer text-left" title={s}>
                <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-accent' : 'bg-card-2 group-hover:bg-line')} />
                <div className={cn('mt-1.5 hidden text-[11px] sm:block', i === step ? 'text-fg' : 'text-muted')}>{s}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {done ? (
        <DoneView date={date} onEdit={() => void goTo(0)} />
      ) : (
        <div className="rounded-card border border-line bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              <span className="mr-2 text-muted">{step + 1}/{STEPS.length}</span>
              {STEPS[step].label}
            </h2>
          </div>

          {STEPS[step].key === 'screen' && <StepScreen form={form} update={update} />}
          {STEPS[step].key === 'tasks' && <StepTasks date={date} form={form} update={update} />}
          {STEPS[step].key === 'discipline' && <StepDiscipline form={form} update={update} />}
          {STEPS[step].key === 'sleep' && <StepSleep date={date} form={form} update={update} onDone={next} />}
          {STEPS[step].key === 'mood' && <StepMood form={form} update={update} onDone={next} />}
          {STEPS[step].key === 'note' && <StepNote form={form} update={update} />}

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            <button className="btn-ghost" onClick={back} disabled={step === 0}>
              <ChevronLeft size={16} /> Geri
            </button>
            <span className="hidden text-xs text-muted sm:inline">
              <Kbd>Enter</Kbd> sonraki · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> geri
            </span>
            <button className="btn-primary" onClick={next}>
              {step === STEPS.length - 1 ? 'Günü kapat' : 'Sonraki'} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
