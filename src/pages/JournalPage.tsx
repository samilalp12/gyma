import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Flame, ListChecks, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Heatmap } from '../components/Heatmap';
import { BacklogCard } from '../components/BacklogCard';
import { DayTasksCard } from '../components/DayTasksCard';
import { partLabel, RoutineEditor, RoutineSuggestions, weekdaysLabel } from '../components/RoutineEditor';
import { Card, cn, EmptyState, PageHeader } from '../components/ui';
import { archiveRoutine } from '../db/actions';
import type { Routine } from '../db/types';
import { useData } from '../hooks/useAppData';
import { routineCell } from '../lib/cells';
import { importantCell } from '../lib/eisenhower';
import { addDaysISO, dateRange, fmt, fmtLong, relativeLabel } from '../lib/date';
import { completion, routineStats } from '../lib/metrics';

export function JournalPage() {
  const data = useData();
  const { today } = data;
  const [params, setParams] = useSearchParams();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : today;
  const select = (d: string) => setParams(d === today ? {} : { d }, { replace: true });

  const [editing, setEditing] = useState<Routine | null | undefined>(undefined);

  const strip = dateRange(addDaysISO(selected, -3), addDaysISO(selected, 3));
  const active = data.routines.filter((r) => !r.archived);
  const archived = data.routines.filter((r) => r.archived);
  const overallCell = useMemo(() => importantCell(data), [data]);

  return (
    <>
      <PageHeader title="Günlük" subtitle="Rutinler her gün otomatik düşer; tek seferlik işleri istediğin güne ata." />

      {/* Tarih şeridi */}
      <div className="mb-5 flex items-center gap-2">
        <button className="btn-icon shrink-0" onClick={() => select(addDaysISO(selected, -1))} title="Önceki gün">
          <ChevronLeft size={18} />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {strip.map((d) => {
            const c = completion(data, d);
            const isSel = d === selected;
            return (
              <button
                key={d}
                onClick={() => select(d)}
                className={cn(
                  'flex cursor-pointer flex-col items-center rounded-xl border py-2',
                  isSel ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:border-muted/60',
                  d === today && !isSel && 'border-muted/60',
                )}
              >
                <span className={cn('text-[11px]', isSel ? 'text-accent' : 'text-muted')}>{fmt(d, 'EEE')}</span>
                <span className="text-base font-semibold tabular-nums">{fmt(d, 'd')}</span>
                <span className="mt-1 h-1 w-6 overflow-hidden rounded-full bg-card-2">
                  {c.total > 0 && d <= today && <span className="block h-full bg-accent" style={{ width: `${(c.done / c.total) * 100}%` }} />}
                </span>
              </button>
            );
          })}
        </div>
        <button className="btn-icon shrink-0" onClick={() => select(addDaysISO(selected, 1))} title="Sonraki gün">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <DayTasksCard
          className="lg:col-span-2"
          date={selected}
          title={
            <span>
              {relativeLabel(selected, today)}
              <span className="ml-2 font-normal text-muted">{fmtLong(selected)}</span>
            </span>
          }
          action={
            <div className="flex items-center gap-2">
              {selected !== today && (
                <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => select(today)}>
                  Bugün
                </button>
              )}
              <input type="date" className="input w-auto px-2 py-1 text-xs" value={selected} onChange={(e) => e.target.value && select(e.target.value)} />
            </div>
          }
        />

        <BacklogCard target={selected} onSelect={select} />
      </div>

      <Card
        title="Önemli işler"
        action={<span className="text-xs text-muted">Tamamlanan Ç1 + Ç2 işler · güne tıkla, git</span>}
        className="mb-5"
      >
        <Heatmap getCell={overallCell} onSelect={select} emptyLabel="Tamamlanan iş yok" legend={{ low: '0', high: '3+ önemli iş' }} />
        <p className="mt-2 text-xs text-muted">Yalnızca Ç3/Ç4 bitirilen günler boş görünür: meşgul olmak ≠ önemli işi yapmak.</p>
      </Card>

      <Card
        title="Rutinler"
        action={
          <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setEditing(null)}>
            <Plus size={14} /> Yeni rutin
          </button>
        }
      >
        {active.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={24} />}
            title="Henüz rutin yok"
            text="Her gün (ya da seçtiğin günlerde) yapmak istediklerini rutin olarak ekle; serilerini burada görürsün."
            action={
              <div className="text-left">
                <RoutineSuggestions existing={data.routines} />
              </div>
            }
          />
        ) : (
          <div className="space-y-5">
            {active.map((r) => (
              <RoutineRow key={r.id} routine={r} onEdit={() => setEditing(r)} onSelect={select} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm text-muted">Arşivlenmiş rutinler ({archived.length})</summary>
            <ul className="mt-3 space-y-2">
              {archived.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{r.title}</span>
                  <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void archiveRoutine(r.id, false)}>
                    <ArchiveRestore size={13} /> Geri al
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <RoutineEditor open={editing !== undefined} routine={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  );
}

function RoutineRow({ routine, onEdit, onSelect }: { routine: Routine; onEdit: () => void; onSelect: (d: string) => void }) {
  const data = useData();
  const st = useMemo(() => routineStats(data, routine), [data, routine]);
  const getCell = useMemo(() => routineCell(data, routine), [data, routine]);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{routine.title}</div>
          <div className="text-xs text-muted">
            {partLabel(routine.part)} · {weekdaysLabel(routine.weekdays)}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className={cn('flex items-center gap-1 tabular-nums', st.current > 0 && 'text-accent')}>
            <Flame size={13} /> {st.current} gün
          </span>
          <span className="tabular-nums">en uzun {st.longest}</span>
          <span className="tabular-nums">30g %{st.last30Rate != null ? Math.round(st.last30Rate * 100) : '—'}</span>
          <button className="btn-icon h-7 w-7" onClick={onEdit} title="Düzenle">
            <Pencil size={13} />
          </button>
          <button className="btn-icon h-7 w-7" onClick={() => void archiveRoutine(routine.id, true)} title="Arşivle (geçmiş korunur)">
            <Archive size={13} />
          </button>
        </div>
      </div>
      <Heatmap getCell={getCell} onSelect={onSelect} compact legend={false} />
    </div>
  );
}
