import { ArrowRightToLine, Inbox, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  addRoutine,
  addTask,
  deleteTask,
  moveTaskToNextDay,
  reorderRoutines,
  reorderTasks,
  scheduleTask,
  setRoutineDone,
  setTaskDone,
} from '../db/actions';
import type { DayPart, Routine } from '../db/types';
import { useData } from '../hooks/useAppData';
import { DAY_PARTS } from '../lib/constants';
import { brickOf } from '../lib/eisenhower';
import { completion, dueRoutines, isRoutineDone } from '../lib/metrics';
import { BrickCard, ImpUrgToggles, QuadrantBadge, TaskEditor } from './Eisenhower';
import { DragHandle, SortableItem, SortableList } from './SortableList';
import { WeightInput } from './WeightCard';
import { Card, Checkbox, cn, ProgressBar } from './ui';

/** Bir günün rutinleri (sabah / gün içi / akşam) + o güne atanmış işler + hızlı ekleme. */
export function DayTasksCard({ date, title, action, className }: { date: string; title: ReactNode; action?: ReactNode; className?: string }) {
  const data = useData();
  const { today } = data;
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'task' | 'routine'>('task');
  const [flags, setFlags] = useState({ important: false, urgent: false });
  const [editing, setEditing] = useState<string | null>(null);

  const routines = dueRoutines(data, date);
  // Günün Tuğlası listede değil, en üstte kendi kartında durur
  const tasks = (data.tasksByDate.get(date) ?? []).filter((t) => !t.brick);
  const comp = completion(data, date);
  const isFuture = date > today;

  const groups = DAY_PARTS.map((p) => ({ ...p, items: routines.filter((r) => (r.part ?? 'gun') === p.key) })).filter((g) => g.items.length);
  const showGroupHeaders = groups.length > 1 || (groups.length === 1 && groups[0].key !== 'gun') || tasks.length > 0;

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    // Kutuyu hemen temizle; hızlı yazınca sonraki metin öncekine eklenmesin
    setText('');
    if (kind === 'task') {
      void addTask(value, date, flags);
      setFlags({ important: false, urgent: false });
    }
    else void addRoutine(value, [1, 2, 3, 4, 5, 6, 7], date < today ? date : today);
  };

  return (
    <Card className={className} title={title} action={action}>
      <BrickCard date={date} />
      {comp.total > 0 && !isFuture && (
        <div className="mb-4 flex items-center gap-3">
          <ProgressBar value={comp.done / comp.total} />
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {comp.done}/{comp.total}
          </span>
        </div>
      )}

      {routines.length + tasks.length === 0 && !brickOf(data, date) ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Bu gün için madde yok. Aşağıya yazıp Enter’a bas.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              {showGroupHeaders && <GroupHeader part={g.key} label={g.label} routines={g.items} date={date} />}
              <SortableList items={g.items} onReorder={(ids) => void reorderRoutines(ids)} className="space-y-1.5">
                {(r) => {
                  const done = isRoutineDone(data, r.id, date);
                  return (
                    <SortableItem key={r.id} id={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-bg py-2.5 pl-1.5 pr-3">
                      <DragHandle />
                      {isFuture ? (
                        <span className="h-5 w-5 rounded-md border border-dashed border-line" />
                      ) : (
                        <Checkbox checked={done} onChange={(v) => void setRoutineDone(r.id, date, v)} label={r.title} />
                      )}
                      <button
                        className={cn('flex-1 cursor-pointer truncate text-left text-sm', done && 'text-muted line-through')}
                        onClick={() => !isFuture && void setRoutineDone(r.id, date, !done)}
                        tabIndex={-1}
                      >
                        {r.title}
                      </button>
                      {r.measure === 'kg' && !isFuture ? (
                        <WeightInput date={date} />
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide text-muted">rutin</span>
                      )}
                    </SortableItem>
                  );
                }}
              </SortableList>
            </div>
          ))}

          {tasks.length > 0 && (
            <div>
              {showGroupHeaders && <div className="label mb-2">İşler</div>}
              <SortableList items={tasks} onReorder={(ids) => void reorderTasks(ids)} className="space-y-1.5">
                {(t) => (
                  <SortableItem key={t.id} id={t.id} className="group flex items-center gap-3 rounded-xl border border-line bg-bg py-2.5 pl-1.5 pr-3">
                    <DragHandle />
                    <Checkbox checked={t.done} onChange={(v) => void setTaskDone(t.id, v)} label={t.title} />
                    <QuadrantBadge task={t} onClick={() => setEditing(t.id)} />
                    <span className={cn('flex-1 truncate text-sm', t.done && 'text-muted line-through')}>
                      {t.title}
                      {t.moved > 0 && <span className="ml-2 text-[11px] text-muted">{t.moved}× ertelendi</span>}
                    </span>
                    {!t.done && (
                      <>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void moveTaskToNextDay(t.id)}>
                          <ArrowRightToLine size={13} /> <span className="hidden sm:inline">Yarına taşı</span>
                        </button>
                        <button
                          className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={() => void scheduleTask(t.id, null)}
                          title="Bekleyen işlere at (tarihsiz)"
                        >
                          <Inbox size={14} />
                        </button>
                      </>
                    )}
                    <button className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void deleteTask(t.id)} title="Sil">
                      <Trash2 size={14} />
                    </button>
                  </SortableItem>
                )}
              </SortableList>
            </div>
          )}
        </div>
      )}

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex shrink-0 rounded-[10px] border border-line p-0.5">
          {(['task', 'routine'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn('cursor-pointer rounded-lg px-2.5 py-1.5 text-xs', kind === k ? 'bg-card-2 text-fg' : 'text-muted')}
            >
              {k === 'task' ? 'İş' : 'Rutin'}
            </button>
          ))}
        </div>
        {kind === 'task' && <ImpUrgToggles important={flags.important} urgent={flags.urgent} onChange={setFlags} />}
        <input
          className="input min-w-0 flex-1 basis-48"
          placeholder={kind === 'task' ? 'Bu güne iş ekle… (Enter)' : 'Her gün tekrarlanacak rutin… (Enter)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0 px-2.5" type="submit" disabled={!text.trim()} aria-label="Ekle">
          <Plus size={16} />
        </button>
      </form>
      <TaskEditor taskId={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function GroupHeader({ part, label, routines, date }: { part: DayPart; label: string; routines: Routine[]; date: string }) {
  const data = useData();
  const done = routines.filter((r) => isRoutineDone(data, r.id, date)).length;
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className={cn('label', part === 'sabah' && 'text-accent')}>{label}</span>
      <span className="text-[11px] tabular-nums text-muted">
        {done}/{routines.length}
      </span>
    </div>
  );
}
