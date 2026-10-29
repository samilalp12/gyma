import { useEffect, useState } from 'react';
import { Plus, Sunrise } from 'lucide-react';
import { addRoutine, updateRoutine } from '../db/actions';
import type { DayPart, Routine } from '../db/types';
import { DAY_PARTS, MORNING_PACK, ROUTINE_SUGGESTIONS } from '../lib/constants';
import { WEEKDAY_SHORT } from '../lib/date';
import { cn, Modal } from './ui';

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const presets = [
    { label: 'Her gün', days: [1, 2, 3, 4, 5, 6, 7] },
    { label: 'Hafta içi', days: [1, 2, 3, 4, 5] },
    { label: 'Hafta sonu', days: [6, 7] },
  ];
  return (
    <div>
      <div className="flex gap-1">
        {WEEKDAY_SHORT.map((l, i) => {
          const d = i + 1;
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
              className={cn(
                'h-9 flex-1 cursor-pointer rounded-lg border text-xs',
                on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg',
              )}
            >
              {l}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className={cn('chip', p.days.join() === [...value].sort().join() && 'chip-on')}
            onClick={() => onChange(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function weekdaysLabel(days: number[]): string {
  const s = [...days].sort().join();
  if (s === '1,2,3,4,5,6,7') return 'Her gün';
  if (s === '1,2,3,4,5') return 'Hafta içi';
  if (s === '6,7') return 'Hafta sonu';
  return days.map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
}

/** routine verilirse düzenler, null ise yeni rutin oluşturur. */
export function RoutineEditor({ open, routine, onClose }: { open: boolean; routine: Routine | null; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [part, setPart] = useState<DayPart>('gun');

  useEffect(() => {
    if (!open) return;
    setTitle(routine?.title ?? '');
    setDays(routine?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
    setPart(routine?.part ?? 'gun');
  }, [open, routine]);

  const save = async () => {
    if (!title.trim() || days.length === 0) return;
    if (routine) await updateRoutine(routine.id, { title: title.trim(), weekdays: days, part });
    else await addRoutine(title, days, undefined, part);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={routine ? 'Rutini düzenle' : 'Yeni rutin'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <div>
          <div className="label mb-1.5">Ad</div>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ör. 20 sayfa kitap" />
        </div>
        <div>
          <div className="label mb-1.5">Günün hangi bölümü?</div>
          <PartPicker value={part} onChange={setPart} />
        </div>
        <div>
          <div className="label mb-1.5">Hangi günler?</div>
          <WeekdayPicker value={days} onChange={setDays} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim() || days.length === 0}>
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PartPicker({ value, onChange }: { value: DayPart; onChange: (v: DayPart) => void }) {
  return (
    <div className="flex gap-1">
      {DAY_PARTS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={cn(
            'h-9 flex-1 cursor-pointer rounded-lg border text-xs',
            value === p.key ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function partLabel(p?: DayPart) {
  return DAY_PARTS.find((x) => x.key === (p ?? 'gun'))!.label;
}

/** Henüz eklenmemiş hazır rutin önerileri; tıklayınca doğrudan eklenir. */
export function RoutineSuggestions({ existing }: { existing: Routine[] }) {
  const titles = new Set(existing.filter((r) => !r.archived).map((r) => r.title.toLocaleLowerCase('tr')));
  const missing = (list: typeof ROUTINE_SUGGESTIONS) => list.filter((s) => !titles.has(s.title.toLocaleLowerCase('tr')));
  const list = missing(ROUTINE_SUGGESTIONS);
  const morning = missing(MORNING_PACK);
  if (list.length === 0) return null;
  return (
    <div className="space-y-3">
      {morning.length > 0 && (
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2.5 text-left hover:brightness-110"
          onClick={async () => {
            for (const s of morning) await addRoutine(s.title, s.weekdays, undefined, s.part, s.measure);
          }}
        >
          <Sunrise size={18} className="shrink-0 text-accent" />
          <span className="flex-1">
            <span className="block text-sm font-medium">Sabah rutini paketini ekle</span>
            <span className="block text-xs text-muted">{morning.map((s) => s.title).join(' → ')}</span>
          </span>
          <Plus size={16} className="text-accent" />
        </button>
      )}
      <div>
        <div className="label mb-2">Öneriler · tıkla, ekle</div>
        <div className="flex flex-wrap gap-1.5">
          {list.map((s) => (
            <button
              key={s.title}
              type="button"
              className="chip"
              onClick={() => void addRoutine(s.title, s.weekdays, undefined, s.part, s.measure)}
              title={`${partLabel(s.part)} · ${weekdaysLabel(s.weekdays)}`}
            >
              <Plus size={12} />
              {s.title}
              <span className="opacity-60">
                · {partLabel(s.part)}
                {s.weekdays.length < 7 && `, ${weekdaysLabel(s.weekdays)}`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
