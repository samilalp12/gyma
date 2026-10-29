import type { DayLog, FocusSession, Goal, ISODate, Routine, Settings, Task, TrackedApp } from '../db/types';
import { partOrder } from './constants';
import { addDaysISO, dateRange, isoWeekday, lastNDays } from './date';

/** Uygulama genelinde tek seferde yüklenen veri seti (kişisel kullanım için küçük). */
export interface AppData {
  settings: Settings;
  /** Arşivlenenler dahil, sıraya göre */
  apps: TrackedApp[];
  activeApps: TrackedApp[];
  appById: Map<string, TrackedApp>;
  days: Map<ISODate, DayLog>;
  /** Arşivlenenler dahil, sıraya göre */
  routines: Routine[];
  /** date -> routineId -> done */
  checks: Map<ISODate, Map<string, boolean>>;
  tasksByDate: Map<ISODate, Task[]>;
  /** Belirli bir güne bağlı olmayan genel işler */
  backlog: Task[];
  /** Haftalık / aylık hedefler, sıraya göre */
  goals: Goal[];
  /** Odak seansları (eskiden yeniye) */
  sessions: FocusSession[];
  today: ISODate;
}

/** Ekran süresi takibi açık mı? (Ayarlar → Ekran süresi) */
export function screenOn(data: AppData): boolean {
  return data.settings.screenTimeEnabled !== false;
}

/* ---------------- Rutin / iş tamamlanma ---------------- */

export function isRoutineDue(r: Routine, date: ISODate): boolean {
  if (date < r.startDate) return false;
  if (r.archived && r.archivedAt && date >= r.archivedAt) return false;
  return r.weekdays.includes(isoWeekday(date));
}

/** O gün düşen rutinler; sabah → gün içi → akşam sırasıyla */
export function dueRoutines(data: AppData, date: ISODate): Routine[] {
  return data.routines
    .filter((r) => isRoutineDue(r, date))
    .sort((a, b) => partOrder(a.part) - partOrder(b.part) || a.order - b.order);
}

export function isRoutineDone(data: AppData, routineId: string, date: ISODate): boolean {
  return data.checks.get(date)?.get(routineId) ?? false;
}

export interface Completion {
  done: number;
  total: number;
  rate: number | null;
  routinesDone: number;
  routinesTotal: number;
}

export function completion(data: AppData, date: ISODate): Completion {
  const due = dueRoutines(data, date);
  const routinesDone = due.filter((r) => isRoutineDone(data, r.id, date)).length;
  const tasks = data.tasksByDate.get(date) ?? [];
  const tasksDone = tasks.filter((t) => t.done).length;
  const done = routinesDone + tasksDone;
  const total = due.length + tasks.length;
  return { done, total, rate: total ? done / total : null, routinesDone, routinesTotal: due.length };
}

/** O gün için herhangi bir etkileşim var mı (check-in, tik vb.) */
export function hasActivity(data: AppData, date: ISODate): boolean {
  if (data.days.has(date)) return true;
  const c = data.checks.get(date);
  if (c && [...c.values()].some(Boolean)) return true;
  return (data.tasksByDate.get(date) ?? []).some((t) => t.done);
}

/* ---------------- Ekran süresi ---------------- */

export interface ScreenStatus {
  hasData: boolean;
  total: number;
  /** Limiti olan uygulamaların limit toplamı */
  limitTotal: number;
  overApps: string[];
  over: boolean;
  /** 0..1, limitli uygulama yoksa null */
  compliance: number | null;
  /** Limitli uygulamalarda kullanım / limit (0..∞) */
  worstRatio: number;
  usageRatio: number | null;
}

export function screenStatus(data: AppData, day: DayLog | undefined): ScreenStatus {
  const entries = day ? Object.entries(day.screen) : [];
  const hasData = entries.length > 0;
  let total = 0;
  let limitTotal = 0;
  let usedWithinLimitTotal = 0;
  let complianceSum = 0;
  let limitedCount = 0;
  let worstRatio = 0;
  const overApps: string[] = [];
  for (const [appId, min] of entries) {
    const app = data.appById.get(appId);
    if (!app) continue;
    total += min;
    if (app.limit > 0) {
      limitedCount++;
      limitTotal += app.limit;
      usedWithinLimitTotal += min;
      const ratio = min / app.limit;
      worstRatio = Math.max(worstRatio, ratio);
      if (min > app.limit) {
        overApps.push(appId);
        complianceSum += Math.max(0, 1 - (min - app.limit) / app.limit);
      } else complianceSum += 1;
    }
  }
  return {
    hasData,
    total,
    limitTotal,
    overApps,
    over: overApps.length > 0,
    compliance: limitedCount ? complianceSum / limitedCount : null,
    worstRatio,
    usageRatio: limitTotal ? usedWithinLimitTotal / limitTotal : null,
  };
}

export function screenTotal(data: AppData, date: ISODate): number | null {
  const d = data.days.get(date);
  if (!d || Object.keys(d.screen).length === 0) return null;
  let t = 0;
  for (const [id, m] of Object.entries(d.screen)) if (data.appById.has(id)) t += m;
  return t;
}

/** Telefonun gösterdiği toplam ekran süresi (dk) */
export function phoneTotal(data: AppData, date: ISODate): number | null {
  return data.days.get(date)?.phoneTotal ?? null;
}

/** Genel ekran süresi: telefon toplamı girildiyse o, yoksa takip edilen uygulamaların toplamı */
export function overallScreen(data: AppData, date: ISODate): number | null {
  return phoneTotal(data, date) ?? screenTotal(data, date);
}

/* ---------------- Gün skoru ---------------- */

export interface DayScore {
  score: number | null;
  routines: number | null;
  screen: number | null;
  discipline: number | null;
}

export function dayScore(data: AppData, date: ISODate): DayScore {
  const empty: DayScore = { score: null, routines: null, screen: null, discipline: null };
  if (date > data.today || !hasActivity(data, date)) return empty;
  const day = data.days.get(date);
  const w = data.settings.weights;
  const c = completion(data, date);
  const s = screenStatus(data, day);
  const parts: DayScore = {
    score: null,
    routines: c.rate,
    screen: screenOn(data) && s.hasData ? s.compliance : null,
    // Temiz ama tetikleyici içerik varsa yarım puan
    discipline: day?.clean == null ? null : day.clean ? (day.porn ? 0.5 : 1) : 0,
  };
  let sum = 0;
  let wsum = 0;
  if (parts.routines != null) (sum += parts.routines * w.routines), (wsum += w.routines);
  if (parts.screen != null) (sum += parts.screen * w.screen), (wsum += w.screen);
  if (parts.discipline != null) (sum += parts.discipline * w.discipline), (wsum += w.discipline);
  parts.score = wsum > 0 ? Math.round((sum / wsum) * 100) : null;
  return parts;
}

/* ---------------- Streak'ler ---------------- */

export interface DisciplineStats {
  current: number;
  longest: number;
  totalClean: number;
  totalEntered: number;
  last30Clean: number;
  last30Entered: number;
  /** Tetikleyici içeriksiz günlerin mevcut serisi */
  pornFreeCurrent: number;
}

export function disciplineStats(data: AppData): DisciplineStats {
  const today = data.today;
  // Mevcut seri: bugün girilmediyse dünden başla
  let cursor = data.days.get(today)?.clean == null ? addDaysISO(today, -1) : today;
  let current = 0;
  while (data.days.get(cursor)?.clean === true) {
    current++;
    cursor = addDaysISO(cursor, -1);
  }

  const sorted = [...data.days.values()].filter((d) => d.clean != null && d.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  let longest = 0;
  let run = 0;
  let prev: ISODate | null = null;
  let totalClean = 0;
  for (const d of sorted) {
    if (d.clean) {
      totalClean++;
      run = prev && addDaysISO(prev, 1) === d.date && run > 0 ? run + 1 : 1;
      longest = Math.max(longest, run);
    } else run = 0;
    prev = d.date;
  }

  let last30Clean = 0;
  let last30Entered = 0;
  for (const date of lastNDays(30, today)) {
    const c = data.days.get(date)?.clean;
    if (c != null) last30Entered++;
    if (c === true) last30Clean++;
  }
  let pc = data.days.get(today)?.porn == null ? addDaysISO(today, -1) : today;
  let pornFreeCurrent = 0;
  while (data.days.get(pc)?.porn === false) {
    pornFreeCurrent++;
    pc = addDaysISO(pc, -1);
  }

  return {
    current,
    longest: Math.max(longest, current),
    totalClean,
    totalEntered: sorted.length,
    last30Clean,
    last30Entered,
    pornFreeCurrent,
  };
}

/* ---------------- Dürtü / içerik / erteleme ---------------- */

export interface HabitStats {
  /** İçerik sorusu girilen gün sayısı ve bunlardan içeriksiz olanlar */
  pornEntered: number;
  pornFree: number;
  /** Günlük ortalama dürtü sayısı (girilen günler) */
  urgesAvg: number | null;
  urgesTotal: number;
  /** Günlük ortalama erteleme (girilen günler) */
  procrastAvg: number | null;
  procrastTotal: number;
  /** Dönemde "yarına taşı" yapılan iş sayısı (o tarihlere atanmış işlerin erteleme sayısı) */
  movedTasks: number;
}

export function habitStats(data: AppData, dates: ISODate[]): HabitStats {
  let pornEntered = 0;
  let pornFree = 0;
  const urges: number[] = [];
  const procs: number[] = [];
  let movedTasks = 0;
  for (const d of dates) {
    if (d > data.today) continue;
    const day = data.days.get(d);
    if (day?.porn != null) {
      pornEntered++;
      if (!day.porn) pornFree++;
    }
    if (day?.urges != null) urges.push(day.urges);
    if (day?.procrastination != null) procs.push(day.procrastination);
    for (const t of data.tasksByDate.get(d) ?? []) movedTasks += t.moved;
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    pornEntered,
    pornFree,
    urgesAvg: avg(urges),
    urgesTotal: sum(urges),
    procrastAvg: avg(procs),
    procrastTotal: sum(procs),
    movedTasks,
  };
}

/** Disiplin heatmap'i için: o tarihte kaçıncı temiz gün olduğu. */
export function cleanRunLengths(data: AppData): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  const sorted = [...data.days.values()].filter((d) => d.clean === true).sort((a, b) => (a.date < b.date ? -1 : 1));
  let prev: ISODate | null = null;
  let run = 0;
  for (const d of sorted) {
    run = prev && addDaysISO(prev, 1) === d.date ? run + 1 : 1;
    out.set(d.date, run);
    prev = d.date;
  }
  return out;
}

export interface RoutineStats {
  current: number;
  longest: number;
  last30Rate: number | null;
}

export function routineStats(data: AppData, r: Routine): RoutineStats {
  const today = data.today;
  let current = 0;
  let cursor = today;
  // Bugün henüz yapılmadıysa seriyi bozmaz
  if (isRoutineDue(r, today) && !isRoutineDone(data, r.id, today)) cursor = addDaysISO(today, -1);
  while (cursor >= r.startDate) {
    if (isRoutineDue(r, cursor)) {
      if (isRoutineDone(data, r.id, cursor)) current++;
      else break;
    }
    cursor = addDaysISO(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  const start = r.startDate > addDaysISO(today, -730) ? r.startDate : addDaysISO(today, -730);
  for (const d of dateRange(start, today)) {
    if (!isRoutineDue(r, d)) continue;
    if (isRoutineDone(data, r.id, d)) longest = Math.max(longest, ++run);
    else if (d !== today) run = 0;
  }

  let due = 0;
  let done = 0;
  for (const d of lastNDays(30, today)) {
    if (!isRoutineDue(r, d)) continue;
    due++;
    if (isRoutineDone(data, r.id, d)) done++;
  }
  return { current, longest: Math.max(longest, current), last30Rate: due ? done / due : null };
}

/* ---------------- Dönem istatistikleri ---------------- */

export interface PeriodStats {
  dates: ISODate[];
  /** Takip edilen uygulamaların günlük ortalaması */
  screenAvg: number | null;
  screenDays: number;
  /** Telefon toplamı günlük ortalaması */
  phoneAvg: number | null;
  completionRate: number | null;
  cleanDays: number;
  dirtyDays: number;
  moodAvg: number | null;
  energyAvg: number | null;
  sleepAvg: number | null;
  scoreAvg: number | null;
}

export function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function periodStats(data: AppData, dates: ISODate[]): PeriodStats {
  const screens: number[] = [];
  const phones: number[] = [];
  const moods: number[] = [];
  const energies: number[] = [];
  const sleeps: number[] = [];
  const scores: number[] = [];
  let done = 0;
  let total = 0;
  let cleanDays = 0;
  let dirtyDays = 0;
  for (const d of dates) {
    if (d > data.today) continue;
    const st = screenTotal(data, d);
    if (st != null) screens.push(st);
    const pt = phoneTotal(data, d);
    if (pt != null) phones.push(pt);
    const day = data.days.get(d);
    if (day?.mood != null) moods.push(day.mood);
    if (day?.energy != null) energies.push(day.energy);
    if (day?.sleep != null) sleeps.push(day.sleep);
    if (day?.clean === true) cleanDays++;
    if (day?.clean === false) dirtyDays++;
    if (hasActivity(data, d)) {
      const c = completion(data, d);
      done += c.done;
      total += c.total;
    }
    const sc = dayScore(data, d).score;
    if (sc != null) scores.push(sc);
  }
  return {
    dates,
    screenAvg: avg(screens),
    screenDays: screens.length,
    phoneAvg: avg(phones),
    completionRate: total ? done / total : null,
    cleanDays,
    dirtyDays,
    moodAvg: avg(moods),
    energyAvg: avg(energies),
    sleepAvg: avg(sleeps),
    scoreAvg: avg(scores),
  };
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}
