import type { HeatCell, HeatLevel } from '../components/Heatmap';
import type { Routine } from '../db/types';
import { formatHours, formatMinutes } from './date';
import { moodEmoji } from './constants';
import {
  type AppData,
  cleanRunLengths,
  dayScore,
  hasActivity,
  isRoutineDone,
  isRoutineDue,
  screenStatus,
} from './metrics';

/** Heatmap hücre üreticileri — her sayfa kendi değer → renk eşlemesini buradan alır. */

export function scoreLevel(score: number): HeatLevel {
  if (score >= 85) return 4;
  if (score >= 65) return 3;
  if (score >= 40) return 2;
  return 1;
}

export function scoreCell(data: AppData) {
  return (date: string): HeatCell | null => {
    const s = dayScore(data, date);
    if (s.score == null) return null;
    const lines = [`Gün skoru: ${s.score}`];
    if (s.routines != null) lines.push(`Rutinler: %${Math.round(s.routines * 100)}`);
    if (s.screen != null) lines.push(`Ekran uyumu: %${Math.round(s.screen * 100)}`);
    if (s.discipline != null) lines.push(`Disiplin: ${s.discipline ? 'temiz' : 'bozuldu'}`);
    const day = data.days.get(date);
    if (day?.mood) lines.push(`Mood: ${moodEmoji(day.mood)} ${day.mood}/10`);
    if (day?.sleep != null) lines.push(`Uyku: ${formatHours(day.sleep)}`);
    return { level: scoreLevel(s.score), label: lines.join('\n') };
  };
}

export function screenCell(data: AppData) {
  return (date: string): HeatCell | null => {
    const day = data.days.get(date);
    const s = screenStatus(data, day);
    if (!s.hasData) return null;
    const lines = [`Toplam: ${formatMinutes(s.total)}${s.limitTotal ? ` / limit ${formatMinutes(s.limitTotal)}` : ''}`];
    if (s.over) {
      const names = s.overApps.map((id) => data.appById.get(id)?.name).filter(Boolean);
      lines.push(`Limit aşıldı: ${names.join(', ')}`);
      const r = s.worstRatio;
      const level: HeatLevel = r > 2 ? 4 : r > 1.5 ? 3 : r > 1.25 ? 2 : 1;
      return { level, tone: 'bad', label: lines.join('\n') };
    }
    if (s.usageRatio == null) return { level: 1, label: lines.join('\n') };
    const u = s.usageRatio;
    lines.push('Limitler içinde ✓');
    const level: HeatLevel = u <= 0.25 ? 4 : u <= 0.5 ? 3 : u <= 0.75 ? 2 : 1;
    return { level, label: lines.join('\n') };
  };
}

export function disciplineCell(data: AppData) {
  const runs = cleanRunLengths(data);
  return (date: string): HeatCell | null => {
    const day = data.days.get(date);
    if (day?.clean == null) return null;
    const extra: string[] = [];
    if (day.porn != null) extra.push(day.porn ? 'İçerik: evet' : 'İçerik: yok');
    if (day.urges) extra.push(`Dürtü: ${day.urges}`);
    const tail = extra.length ? `\n${extra.join(' · ')}` : '';
    if (!day.clean) {
      const cause = day.trigger?.causes?.join(', ');
      return { level: 4, tone: 'bad', label: `Bozuldu${cause ? ` · ${cause}` : ''}${tail}` };
    }
    const run = runs.get(date) ?? 1;
    // Temiz ama tetikleyici içerik varsa en açık yeşil
    const level: HeatLevel = day.porn ? 1 : run >= 14 ? 4 : run >= 7 ? 3 : run >= 3 ? 2 : 1;
    return { level, label: `Temiz · serinin ${run}. günü${tail}` };
  };
}

export function routineCell(data: AppData, r: Routine) {
  return (date: string): HeatCell | null => {
    if (!isRoutineDue(r, date)) return { level: 0, label: 'Planlı değil' };
    if (isRoutineDone(data, r.id, date)) return { level: 3, label: 'Yapıldı ✓' };
    if (!hasActivity(data, date) && date !== data.today) return null;
    return { level: 0, label: date === data.today ? 'Henüz yapılmadı' : 'Yapılmadı' };
  };
}
