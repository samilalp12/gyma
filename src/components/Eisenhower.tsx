import { BrickWall, Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearBrick, deleteTask, setBrick, setTaskDone, updateTask } from '../db/actions';
import type { Task } from '../db/types';
import { useData } from '../hooks/useAppData';
import { relativeLabel } from '../lib/date';
import { brickOf, isQ2, isValidRange, type Quadrant, quadrant, QUADRANT_INFO } from '../lib/eisenhower';
import { Checkbox, cn, Modal } from './ui';

const BADGE_STYLE: Record<Quadrant, string> = {
  1: 'border-danger/50 bg-danger-soft text-danger',
  // Ç2 en önemli çeyrek: dolu, belirgin
  2: 'border-accent bg-accent text-accent-ink',
  3: 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]',
  4: 'border-line text-muted',
};

/** Görevin çeyreğini gösteren küçük rozet; onClick verilirse düzenleme açar. */
export function QuadrantBadge({ task, onClick }: { task: Task; onClick?: () => void }) {
  const q = quadrant(task);
  const cls = cn(
    'inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[10px] font-semibold tabular-nums',
    BADGE_STYLE[q],
    onClick && 'cursor-pointer hover:brightness-110',
  );
  const title = `${QUADRANT_INFO[q].label}${onClick ? ' · düzenlemek için tıkla' : ''}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {QUADRANT_INFO[q].short}
    </button>
  ) : (
    <span className={cls} title={title}>
      {QUADRANT_INFO[q].short}
    </span>
  );
}

/** Tek tıkla "Önemli" / "Acil" anahtarları */
export function ImpUrgToggles({
  important,
  urgent,
  onChange,
  size = 'sm',
}: {
  important: boolean;
  urgent: boolean;
  onChange: (v: { important: boolean; urgent: boolean }) => void;
  size?: 'sm' | 'md';
}) {
  const btn = (label: string, on: boolean, next: { important: boolean; urgent: boolean }) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(next)}
      className={cn(
        'cursor-pointer rounded-lg border font-medium',
        size === 'sm' ? 'px-2 py-1.5 text-[11px]' : 'flex-1 px-3 py-2 text-sm',
        on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className={cn('flex shrink-0 gap-1', size === 'md' && 'w-full')}>
      {btn('Önemli', important, { important: !important, urgent })}
      {btn('Acil', urgent, { important, urgent: !urgent })}
    </div>
  );
}

/** Görev düzenleme: başlık + Önemli / Acil. */
export function TaskEditor({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const data = useData();
  // Toggle'lar anında kaydedildiği için görevi her render'da güncel veriden bul
  const task = taskId ? [...data.tasksByDate.values()].flat().concat(data.backlog).find((t) => t.id === taskId) : undefined;
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (task) setTitle(task.title);
  }, [taskId]);
  if (!task) return null;
  const q = quadrant(task);

  return (
    <Modal open onClose={onClose} title="Görevi düzenle">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && title.trim() !== task.title) void updateTask(task.id, { title: title.trim() });
          onClose();
        }}
      >
        <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <ImpUrgToggles size="md" important={!!task.important} urgent={!!task.urgent} onChange={(v) => void updateTask(task.id, v)} />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <QuadrantBadge task={task} /> {QUADRANT_INFO[q].label}
          </div>
                  </div>
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            className="text-xs text-muted hover:text-danger"
            onClick={() => {
              void deleteTask(task.id);
              onClose();
            }}
          >
            Görevi sil
          </button>
          <button type="submit" className="btn-primary">
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Günün Tuğlası: seçiliyse belirgin kart (ad, saat aralığı, tamamlandı); değilse sade uyarı + seçici.
 * Yalnızca Ç2 işler seçilebilir, saat aralığı zorunlu.
 */
export function BrickCard({ date }: { date: string }) {
  const data = useData();
  const brick = brickOf(data, date);
  const [picking, setPicking] = useState(false);
  const isPast = date < data.today;

  if (brick && !picking) {
    return (
      <div className={cn('mb-4 rounded-xl border-2 p-4', brick.done ? 'border-accent/40 bg-accent-soft' : 'border-accent/60 bg-accent-soft')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
            <BrickWall size={14} /> Günün Tuğlası
          </span>
          <span className="flex items-center gap-1">
            <button className="btn-icon h-7 w-7" title="Değiştir" onClick={() => setPicking(true)}>
              <Pencil size={13} />
            </button>
            <button className="btn-icon h-7 w-7" title="Tuğlayı kaldır (görev listede kalır)" onClick={() => void clearBrick(brick.id)}>
              <X size={14} />
            </button>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox checked={brick.done} onChange={(v) => void setTaskDone(brick.id, v)} label={brick.title} />
          <span className={cn('min-w-0 flex-1 text-base font-semibold', brick.done && 'text-muted line-through')}>{brick.title}</span>
          <span className="shrink-0 rounded-lg border border-accent/40 px-2 py-1 text-sm font-semibold tabular-nums text-accent">
            {brick.brick!.start}–{brick.brick!.end}
          </span>
        </div>
      </div>
    );
  }

  if (!picking) {
    if (isPast) return null;
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <BrickWall size={15} />
          {date === data.today ? 'Bugünün' : `${relativeLabel(date, data.today)} gününün`} tuğlası henüz seçilmedi.
        </span>
        <button className="btn-ghost shrink-0 px-2.5 py-1 text-xs" onClick={() => setPicking(true)}>
          Seç
        </button>
      </div>
    );
  }

  return <BrickPicker date={date} current={brick} onDone={() => setPicking(false)} />;
}

function BrickPicker({ date, current, onDone }: { date: string; current?: Task; onDone: () => void }) {
  const data = useData();
  // Aday: o günün ve bekleyen listenin bitmemiş Ç2 işleri
  const candidates = [...(data.tasksByDate.get(date) ?? []), ...data.backlog].filter((t) => !t.done && isQ2(t));
  const [taskId, setTaskId] = useState(current?.id ?? candidates[0]?.id ?? '');
  const [start, setStart] = useState(current?.brick?.start ?? '');
  const [end, setEnd] = useState(current?.brick?.end ?? '');
  const valid = !!taskId && isValidRange(start, end);

  return (
    <form
      className="mb-4 space-y-3 rounded-xl border border-accent/40 bg-bg p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void setBrick(taskId, date, start, end);
        onDone();
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
          <BrickWall size={14} /> Günün Tuğlası
        </span>
        <button type="button" className="btn-icon h-7 w-7" onClick={onDone} aria-label="Vazgeç">
          <X size={14} />
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted">
          Seçilebilecek Ç2 iş yok. Bir işi <span className="text-fg">Önemli</span> (acil değil) olarak işaretle ya da aşağıdan Önemli seçili ekle.
        </p>
      ) : (
        <>
          <select className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.date ? '' : ' (bekleyenlerden)'}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <input type="time" required className="input w-auto" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Başlangıç" />
            <span className="text-muted">–</span>
            <input type="time" required className="input w-auto" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Bitiş" />
            <button type="submit" className="btn-primary ml-auto" disabled={!valid}>
              Tuğla yap
            </button>
          </div>
          {start && end && !isValidRange(start, end) && <p className="text-xs text-danger">Bitiş saati başlangıçtan sonra olmalı.</p>}
          {(!start || !end) && <p className="text-xs text-muted">Başlangıç ve bitiş saati zorunlu.</p>}
        </>
      )}
    </form>
  );
}
