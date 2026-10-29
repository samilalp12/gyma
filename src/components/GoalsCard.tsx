import { CornerDownRight, Gauge, Minus, Plus, SquareCheck, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { addGoal, carryOverGoals, deleteGoal, reorderGoals, setGoalProgress, updateGoal } from '../db/actions';
import type { Goal, GoalPeriod } from '../db/types';
import { useData } from '../hooks/useAppData';
import { getDaysInMonth } from 'date-fns';
import { addDaysISO, fmt, fromISO, isoWeekday, weekStartISO } from '../lib/date';
import { DragHandle, SortableItem, SortableList } from './SortableList';
import { Checkbox, cn } from './ui';

function monthStart(d: string) {
  return `${d.slice(0, 8)}01`;
}

function prevMonthStart(d: string) {
  return monthStart(addDaysISO(monthStart(d), -1));
}

/** Dönemin ne kadarı geçti (0–1) — hedef ilerlemesiyle kıyas için */
function elapsed(period: GoalPeriod, today: string) {
  if (period === 'week') return isoWeekday(today) / 7;
  return Number(today.slice(8, 10)) / getDaysInMonth(fromISO(today));
}

/** Haftalık ve aylık hedefler — Özet'te yan yana. */
export function GoalsCard() {
  return (
    <section className="mb-5 grid gap-5 md:grid-cols-2">
      <GoalColumn period="week" />
      <GoalColumn period="month" />
    </section>
  );
}

function GoalColumn({ period }: { period: GoalPeriod }) {
  const { goals, today } = useData();
  const start = period === 'week' ? weekStartISO(today) : monthStart(today);
  const prevStart = period === 'week' ? addDaysISO(start, -7) : prevMonthStart(today);
  const list = goals.filter((g) => g.period === period && g.start === start);
  const leftovers = goals.filter((g) => g.period === period && g.start < start && g.start >= prevStart && !g.done);

  const [text, setText] = useState('');
  const [kind, setKind] = useState<Goal['kind']>('bar');

  const doneCount = list.filter((g) => g.done).length;
  // Genel ilerleme: bar hedeflerinde yüzde, tek işlerde 0/100
  const overall = list.length ? list.reduce((s, g) => s + (g.kind === 'bar' ? g.progress : g.done ? 100 : 0), 0) / list.length : 0;
  const timePassed = elapsed(period, today);

  const title = period === 'week' ? 'Bu haftanın hedefleri' : 'Bu ayın hedefleri';
  const range = period === 'week' ? `${fmt(start, 'd MMM')} – ${fmt(addDaysISO(start, 6), 'd MMM')}` : fmt(start, 'MMMM yyyy');

  return (
    <div className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Target size={15} className="text-accent" /> {title}
          </h2>
          <div className="mt-0.5 text-xs text-muted">{range}</div>
        </div>
        {list.length > 0 && (
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">%{Math.round(overall)}</div>
            <div className="text-[11px] text-muted">
              {doneCount}/{list.length} tamam
            </div>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="mb-4">
          {/* Genel ilerleme + dönemin geçen kısmı (dikey çizgi) */}
          <div className="relative h-2 overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${overall}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-fg/60" style={{ left: `${timePassed * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {period === 'week' ? 'Haftanın' : 'Ayın'} %{Math.round(timePassed * 100)}’i geçti
            {overall + 5 < timePassed * 100 ? ' · tempo geride' : overall >= timePassed * 100 ? ' · tempo iyi' : ''}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          {period === 'week' ? 'Bu hafta neye odaklanacaksın?' : 'Bu ay neyi bitirmek istiyorsun?'} 1–3 hedef yeter.
        </p>
      ) : (
        <SortableList items={list} onReorder={(ids) => void reorderGoals(ids)} className="mb-3 space-y-1.5">
          {(g) => <GoalRow key={g.id} goal={g} />}
        </SortableList>
      )}

      {leftovers.length > 0 && (
        <button
          className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-muted hover:text-fg"
          onClick={() => void carryOverGoals(leftovers.map((g) => g.id), start)}
        >
          <CornerDownRight size={13} />
          {period === 'week' ? 'Geçen haftadan' : 'Geçen aydan'} {leftovers.length} hedef kaldı · buraya taşı
        </button>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void addGoal(text, period, start, kind);
          setText('');
        }}
      >
        <div className="flex shrink-0 rounded-[10px] border border-line p-0.5" role="group" aria-label="Hedef türü">
          {(
            [
              ['bar', 'İlerleme'],
              ['check', 'Tek iş'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              title={k === 'bar' ? '0’dan 100’e ilerleyen hedef' : 'Tek seferde biten hedef'}
              className={cn('cursor-pointer rounded-lg px-2.5 py-1.5 text-xs', kind === k ? 'bg-card-2 text-fg' : 'text-muted')}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          className="input min-w-0 flex-1 basis-40"
          placeholder={period === 'week' ? 'Haftalık hedef… (Enter)' : 'Aylık hedef… (Enter)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
    </div>
  );
}

function GoalRow({ goal: g }: { goal: Goal }) {
  const step = (d: number) => void setGoalProgress(g.id, g.progress + d);

  return (
    <SortableItem id={g.id} handle className="group rounded-xl border border-line bg-bg py-2 pl-1.5 pr-2">
      <div className="flex items-center gap-2">
        <DragHandle />
        {g.kind === 'check' && <Checkbox checked={g.done} onChange={(v) => void setGoalProgress(g.id, v ? 100 : 0)} label={g.title} />}
        <span className={cn('min-w-0 flex-1 truncate text-sm', g.done && 'text-muted line-through')}>{g.title}</span>
        {g.kind === 'bar' && <span className={cn('text-xs font-semibold tabular-nums', g.done ? 'text-accent' : 'text-muted')}>%{g.progress}</span>}
        <button
          className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100"
          title={g.kind === 'bar' ? 'Tek işe çevir' : 'İlerleme çubuğuna çevir'}
          onClick={() => void updateGoal(g.id, { kind: g.kind === 'bar' ? 'check' : 'bar' })}
        >
          {g.kind === 'bar' ? <SquareCheck size={13} /> : <Gauge size={13} />}
        </button>
        <button className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void deleteGoal(g.id)} title="Sil">
          <Trash2 size={13} />
        </button>
      </div>
      {g.kind === 'bar' && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <button className="btn-icon h-6 w-6" onClick={() => step(-10)} aria-label="%10 azalt" disabled={g.progress <= 0}>
            <Minus size={12} />
          </button>
          {/* Çubuğa tıklayınca o noktaya ayarla (5'lik adım) */}
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={g.progress}
            aria-label={`${g.title} ilerlemesi`}
            tabIndex={0}
            className="relative h-2.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-card-2"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              void setGoalProgress(g.id, Math.round(((e.clientX - r.left) / r.width) * 20) * 5);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') step(5);
              if (e.key === 'ArrowLeft') step(-5);
            }}
          >
            <div className={cn('h-full rounded-full transition-[width] duration-300', g.done ? 'bg-accent' : 'bg-accent/70')} style={{ width: `${g.progress}%` }} />
          </div>
          <button className="btn-icon h-6 w-6" onClick={() => step(10)} aria-label="%10 artır" disabled={g.progress >= 100}>
            <Plus size={12} />
          </button>
        </div>
      )}
    </SortableItem>
  );
}
