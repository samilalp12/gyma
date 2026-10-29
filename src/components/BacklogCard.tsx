import { CalendarPlus, Inbox, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addTask, deleteTask, reorderTasks, scheduleTask, setTaskDone } from '../db/actions';
import type { Task } from '../db/types';
import { useData } from '../hooks/useAppData';
import { fmt, relativeLabel } from '../lib/date';
import { ImpUrgToggles, QuadrantBadge, TaskEditor } from './Eisenhower';
import { DragHandle, SortableItem, SortableList } from './SortableList';
import { Card, Checkbox, cn } from './ui';

/**
 * Bekleyen işler: belirli bir güne bağlı olmayan genel işler + geçmişte kalmış yapılmamış işler.
 * `target` seçili gün; "güne al" işi o güne atar.
 */
export function BacklogCard({ target, onSelect }: { target: string; onSelect: (d: string) => void }) {
  const { backlog, tasksByDate, today } = useData();
  const [title, setTitle] = useState('');
  const [flags, setFlags] = useState({ important: false, urgent: false });
  const [editing, setEditing] = useState<string | null>(null);

  const open = backlog.filter((t) => !t.done);
  const done = backlog.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const overdue = useMemo(() => {
    const out: (Task & { date: string })[] = [];
    for (const [d, list] of tasksByDate) if (d < today) for (const t of list) if (!t.done) out.push({ ...t, date: d });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [tasksByDate, today]);

  const targetLabel = target === today ? 'Bugüne al' : `${relativeLabel(target, today)} gününe al`;

  return (
    <Card title="Bekleyen işler" action={open.length + overdue.length > 0 ? <span className="text-xs tabular-nums text-muted">{open.length + overdue.length}</span> : undefined}>
      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void addTask(title, null, flags);
          setTitle('');
          setFlags({ important: false, urgent: false });
        }}
      >
        <input className="input min-w-0 flex-1 basis-40" placeholder="Genel bir iş not al… (Enter)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <ImpUrgToggles important={flags.important} urgent={flags.urgent} onChange={setFlags} />
        <button className="btn-ghost shrink-0 px-2.5" type="submit" disabled={!title.trim()} aria-label="Ekle">
          <Plus size={16} />
        </button>
      </form>

      {open.length === 0 && overdue.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-sm text-muted">
          Belirli bir günü olmayan ama yapılması gereken işleri buraya not al. Zamanı gelince bir güne atarsın.
        </p>
      ) : (
        <SortableList items={open} onReorder={(ids) => void reorderTasks(ids)} className="space-y-1">
          {(t) => (
            <SortableItem key={t.id} id={t.id} className="group flex items-center gap-2 rounded-lg bg-card py-1.5 pr-1 text-sm hover:bg-card-2">
              <DragHandle />
              <Checkbox checked={false} onChange={() => void setTaskDone(t.id, true)} label={t.title} />
              <QuadrantBadge task={t} onClick={() => setEditing(t.id)} />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <button className="btn-icon h-7 w-7" onClick={() => void scheduleTask(t.id, target)} title={targetLabel}>
                <CalendarPlus size={14} />
              </button>
              <button className="btn-icon h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => void deleteTask(t.id)} title="Sil">
                <Trash2 size={14} />
              </button>
            </SortableItem>
          )}
        </SortableList>
      )}

      {overdue.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="label mb-2 text-danger">Gecikenler</div>
          <ul className="space-y-1">
            {overdue.slice(0, 12).map((t) => (
              <li key={t.id} className="group flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-card-2">
                <Checkbox checked={false} onChange={() => void setTaskDone(t.id, true)} label={t.title} />
                <QuadrantBadge task={t} onClick={() => setEditing(t.id)} />
                <button className="min-w-0 flex-1 cursor-pointer truncate text-left hover:text-accent" onClick={() => onSelect(t.date)}>
                  {t.title}
                </button>
                <span className="shrink-0 text-xs text-muted">{fmt(t.date, 'd MMM')}</span>
                <button className="btn-icon h-7 w-7" onClick={() => void scheduleTask(t.id, today)} title="Bugüne al">
                  <CalendarPlus size={14} />
                </button>
                <button className="btn-icon h-7 w-7" onClick={() => void scheduleTask(t.id, null)} title="Genel listeye at (tarihsiz)">
                  <Inbox size={14} />
                </button>
              </li>
            ))}
          </ul>
          {overdue.length > 12 && <p className="mt-1 text-xs text-muted">+{overdue.length - 12} iş daha</p>}
        </div>
      )}

      {done.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-xs text-muted">Tamamlanan genel işler ({done.length})</summary>
          <ul className="mt-2 space-y-1">
            {done.slice(0, 15).map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                <Checkbox checked onChange={() => void setTaskDone(t.id, false)} label={t.title} />
                <span className={cn('min-w-0 flex-1 truncate text-muted line-through')}>{t.title}</span>
                {t.doneAt && <span className="text-xs text-muted">{new Date(t.doneAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <TaskEditor taskId={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
