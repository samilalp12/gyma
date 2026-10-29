import type { HeatCell, HeatLevel } from '../components/Heatmap';
import type { ISODate, Task } from '../db/types';
import { todayISO } from './date';
import type { AppData } from './metrics';

export type Quadrant = 1 | 2 | 3 | 4;

/** Ç1 önemli+acil · Ç2 önemli+acil değil · Ç3 önemsiz+acil · Ç4 önemsiz+acil değil */
export function quadrant(t: Pick<Task, 'important' | 'urgent'>): Quadrant {
  const i = !!t.important;
  const u = !!t.urgent;
  return i && u ? 1 : i ? 2 : u ? 3 : 4;
}

export const QUADRANT_INFO: Record<Quadrant, { short: string; label: string }> = {
  1: { short: 'Ç1', label: 'Önemli · acil — hemen yap' },
  2: { short: 'Ç2', label: 'Önemli · acil değil — planla, ilerle' },
  3: { short: 'Ç3', label: 'Önemsiz · acil — kısa tut / devret' },
  4: { short: 'Ç4', label: 'Önemsiz · acil değil — bırak' },
};

export const isQ2 = (t: Task) => quadrant(t) === 2;

export function isValidRange(start: string, end: string) {
  return !!start && !!end && end > start;
}

/** İşin tamamlandığı gün: tarihli işte atandığı gün, tarihsiz işte bitirildiği gün. */
export function completedOn(t: Task): ISODate | null {
  if (!t.done) return null;
  if (t.date) return t.date;
  return t.doneAt ? todayISO(new Date(t.doneAt)) : null;
}

/** Bir tarihteki Günün Tuğlası */
export function brickOf(data: AppData, date: ISODate): Task | undefined {
  return (data.tasksByDate.get(date) ?? []).find((t) => t.brick);
}

/** tarih → o gün tamamlanan işler (tarihsiz işler dahil) */
export function doneTasksByDay(data: AppData): Map<ISODate, Task[]> {
  const out = new Map<ISODate, Task[]>();
  const add = (t: Task) => {
    const d = completedOn(t);
    if (!d) return;
    const list = out.get(d);
    if (list) list.push(t);
    else out.set(d, [t]);
  };
  for (const list of data.tasksByDate.values()) list.forEach(add);
  data.backlog.forEach(add);
  return out;
}

/**
 * Heatmap: tamamlanan önemli işlere (Ç1 + Ç2) göre.
 * 0 = boş · 1 = açık · 2 = orta · 3+ = koyu. Sadece Ç3/Ç4 bitirilen gün yeşil olmaz.
 */
export function importantCell(data: AppData) {
  const byDay = doneTasksByDay(data);
  return (date: string): HeatCell | null => {
    const done = byDay.get(date) ?? [];
    if (done.length === 0) return null;
    const imp = done.filter((t) => t.important);
    const level: HeatLevel = imp.length === 0 ? 0 : imp.length === 1 ? 2 : imp.length === 2 ? 3 : 4;
    const names = (q: Quadrant) =>
      imp
        .filter((t) => quadrant(t) === q)
        .map((t) => (t.brick ? `🧱 ${t.title}` : t.title))
        .join(', ');
    const lines: string[] = [];
    if (names(1)) lines.push(`Ç1: ${names(1)}`);
    if (names(2)) lines.push(`Ç2: ${names(2)}`);
    if (!imp.length) lines.push('Önemli iş yok (yalnızca Ç3/Ç4)');
    lines.push(`Toplam tamamlanan: ${done.length} iş`);
    return { level, label: lines.join('\n') };
  };
}
