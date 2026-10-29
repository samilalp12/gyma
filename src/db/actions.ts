import { addDaysISO, todayISO } from '../lib/date';
import { DEFAULT_SETTINGS, db, emptyDay, uid } from './db';
import type { DayLog, DayPart, FocusCategory, Goal, GoalPeriod, Routine, Settings, TrackedApp } from './types';

/* ---------- Ayarlar ---------- */

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...s, weights: { ...DEFAULT_SETTINGS.weights, ...s?.weights } };
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>) {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, id: 'app' });
}

/* ---------- Günler ---------- */

export async function saveDay(date: string, patch: Partial<Omit<DayLog, 'date'>>) {
  await db.transaction('rw', db.days, async () => {
    const cur = (await db.days.get(date)) ?? emptyDay(date);
    await db.days.put({ ...cur, ...patch, date, updatedAt: Date.now() });
  });
}

/* ---------- Ölçümler ---------- */

/** Kiloyu o güne yazar; kilo ölçüm rutinini de tikler (boşaltılırsa tiki kaldırır). */
export async function setWeight(date: string, kg: number | null) {
  await saveDay(date, { weight: kg });
  const measureRoutines = await db.routines.filter((r) => r.measure === 'kg' && !r.archived).toArray();
  await Promise.all(measureRoutines.map((r) => db.routineChecks.put({ routineId: r.id, date, done: kg != null })));
}

/* ---------- Rutinler ---------- */

export async function setRoutineDone(routineId: string, date: string, done: boolean) {
  await db.routineChecks.put({ routineId, date, done });
}

export async function addRoutine(
  title: string,
  weekdays: number[] = [1, 2, 3, 4, 5, 6, 7],
  startDate = todayISO(),
  part: DayPart = 'gun',
  measure?: Routine['measure'],
) {
  const count = await db.routines.count();
  const r: Routine = {
    id: uid(),
    title: title.trim(),
    part,
    ...(measure ? { measure } : {}),
    weekdays: [...weekdays].sort(),
    startDate,
    archived: false,
    archivedAt: null,
    order: count,
  };
  await db.routines.add(r);
  return r;
}

export async function updateRoutine(id: string, patch: Partial<Pick<Routine, 'title' | 'weekdays' | 'startDate' | 'part'>>) {
  await db.routines.update(id, patch);
}

export async function archiveRoutine(id: string, archived: boolean) {
  await db.routines.update(id, { archived, archivedAt: archived ? todayISO() : null });
}

/** Rutini ve tüm tik geçmişini kalıcı olarak siler. */
export async function deleteRoutine(id: string) {
  await db.transaction('rw', db.routines, db.routineChecks, async () => {
    await db.routineChecks.where('routineId').equals(id).delete();
    await db.routines.delete(id);
  });
}

/** Sürükle-bırak sonrası verilen sıraya göre order yazar. */
export async function reorderRoutines(ids: string[]) {
  await db.transaction('rw', db.routines, () => Promise.all(ids.map((id, i) => db.routines.update(id, { order: i }))));
}

/* ---------- Tek seferlik işler ---------- */

/** date = null → belirli bir güne bağlı olmayan genel iş */
export async function addTask(title: string, date: string | null, flags: { important?: boolean; urgent?: boolean } = {}) {
  await db.tasks.add({
    id: uid(),
    title: title.trim(),
    date,
    done: false,
    doneAt: null,
    createdAt: Date.now(),
    moved: 0,
    important: !!flags.important,
    urgent: !!flags.urgent,
  });
}

/** Başlık / önem / aciliyet güncelle. Görev Ç2 olmaktan çıkarsa tuğlalığı da kalkar. */
export async function updateTask(id: string, patch: { title?: string; important?: boolean; urgent?: boolean }) {
  const t = await db.tasks.get(id);
  if (!t) return;
  const next = { ...t, ...patch };
  const stillQ2 = !!next.important && !next.urgent;
  await db.tasks.update(id, { ...patch, ...(stillQ2 ? {} : { brick: null }) });
}

/** Günün Tuğlası: o tarihteki diğer tuğlayı kaldırır, işi o güne atar ve saat aralığını yazar. */
export async function setBrick(id: string, date: string, start: string, end: string) {
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks
      .where('date')
      .equals(date)
      .modify((t) => {
        if (t.id !== id && t.brick) t.brick = null;
      });
    await db.tasks.update(id, { date, brick: { start, end } });
  });
}

export async function clearBrick(id: string) {
  await db.tasks.update(id, { brick: null });
}

export async function setTaskDone(id: string, done: boolean) {
  await db.tasks.update(id, { done, doneAt: done ? Date.now() : null });
}

export async function moveTaskToNextDay(id: string) {
  const t = await db.tasks.get(id);
  if (!t?.date) return;
  await db.tasks.update(id, { date: addDaysISO(t.date, 1), moved: t.moved + 1, done: false, doneAt: null, brick: null });
}

/** Bir işi güne ata (date) ya da genel listeye geri gönder (null). */
export async function scheduleTask(id: string, date: string | null) {
  // Başka güne giden iş, eski günün tuğlası olarak kalmasın
  await db.tasks.update(id, { date, brick: null });
}

export async function reorderTasks(ids: string[]) {
  await db.transaction('rw', db.tasks, () => Promise.all(ids.map((id, i) => db.tasks.update(id, { order: i }))));
}

export async function deleteTask(id: string) {
  await db.tasks.delete(id);
}

/* ---------- Uygulamalar ---------- */

// Koyu yüzeyde doğrulanmış kategorik palet (dataviz validator: CVD + kontrast)
export const APP_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#8b919c'];

export async function addApp(name: string, limit: number, color?: string) {
  const all = await db.apps.toArray();
  const app: TrackedApp = {
    id: uid(),
    name: name.trim(),
    limit: Math.max(0, Math.round(limit)),
    color: color ?? APP_COLORS[all.length % APP_COLORS.length],
    order: all.length,
    archived: false,
  };
  await db.apps.add(app);
}

export async function updateApp(id: string, patch: Partial<Pick<TrackedApp, 'name' | 'limit' | 'color'>>) {
  await db.apps.update(id, patch);
}

/** Silme = arşivleme; geçmiş istatistikler korunur. */
export async function removeApp(id: string) {
  await db.apps.update(id, { archived: true });
}

export async function restoreApp(id: string) {
  await db.apps.update(id, { archived: false });
}

export async function reorderApps(ids: string[]) {
  await db.transaction('rw', db.apps, () => Promise.all(ids.map((id, i) => db.apps.update(id, { order: i }))));
}

/* ---------------- Hedefler ---------------- */

export async function addGoal(title: string, period: GoalPeriod, start: string, kind: Goal['kind']) {
  const count = await db.goals.where('[period+start]').equals([period, start]).count();
  await db.goals.add({
    id: uid(),
    title: title.trim(),
    period,
    start,
    kind,
    progress: 0,
    done: false,
    doneAt: null,
    order: count,
    createdAt: Date.now(),
  });
}

/** İlerleme 0–100; 100'e ulaşınca hedef tamamlanmış sayılır. */
export async function setGoalProgress(id: string, progress: number) {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  await db.goals.update(id, { progress: p, done: p >= 100, doneAt: p >= 100 ? Date.now() : null });
}

export async function updateGoal(id: string, patch: Partial<Pick<Goal, 'title' | 'kind'>>) {
  await db.goals.update(id, patch);
}

export async function deleteGoal(id: string) {
  await db.goals.delete(id);
}

export async function reorderGoals(ids: string[]) {
  await db.transaction('rw', db.goals, () => Promise.all(ids.map((id, i) => db.goals.update(id, { order: i }))));
}

/** Biten dönemden kalan hedefleri yeni döneme taşır (ilerleme korunur). */
export async function carryOverGoals(ids: string[], start: string) {
  await db.transaction('rw', db.goals, () => Promise.all(ids.map((id) => db.goals.update(id, { start }))));
}

/* ---------------- Odak seansları ---------------- */

export async function startFocus(categoryId: string, targetMin: number | null) {
  const now = Date.now();
  await saveSettings({ activeFocus: { categoryId, runningSince: now, accumulatedMs: 0, startedAt: now, targetMin } });
}

/** Kategoriyi adıyla bulur; yoksa oluşturup seansı başlatır. */
export async function startFocusByName(name: string, targetMin: number | null) {
  const n = name.trim();
  if (!n) return;
  const cats = (await getSettings()).focusCategories ?? [];
  let cat = cats.find((c) => c.name.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'));
  if (!cat) {
    cat = { id: uid(), name: n, color: APP_COLORS[cats.length % APP_COLORS.length] };
    await saveSettings({ focusCategories: [...cats, cat] });
  }
  await startFocus(cat.id, targetMin);
}

export async function pauseFocus() {
  const { activeFocus: f } = await getSettings();
  if (!f || f.runningSince == null) return;
  await saveSettings({ activeFocus: { ...f, accumulatedMs: f.accumulatedMs + (Date.now() - f.runningSince), runningSince: null } });
}

export async function resumeFocus() {
  const { activeFocus: f } = await getSettings();
  if (!f || f.runningSince != null) return;
  await saveSettings({ activeFocus: { ...f, runningSince: Date.now() } });
}

/** Seansı bitirir; 1 dakikadan uzunsa kaydeder. Kaydedilen dakikayı döner. */
export async function stopFocus(): Promise<number> {
  const { activeFocus: f } = await getSettings();
  if (!f) return 0;
  const now = Date.now();
  const ms = f.accumulatedMs + (f.runningSince != null ? now - f.runningSince : 0);
  const minutes = Math.round(ms / 60000);
  await db.transaction('rw', db.settings, db.sessions, async () => {
    if (minutes >= 1)
      await db.sessions.add({
        id: uid(),
        date: todayISO(new Date(f.startedAt)),
        categoryId: f.categoryId,
        startedAt: f.startedAt,
        endedAt: now,
        minutes,
        targetMin: f.targetMin,
      });
    await saveSettings({ activeFocus: null });
  });
  return minutes;
}

export async function cancelFocus() {
  await saveSettings({ activeFocus: null });
}

export async function deleteSession(id: string) {
  await db.sessions.delete(id);
}

export async function saveFocusCategories(list: FocusCategory[]) {
  await saveSettings({ focusCategories: list });
}

/* ---------------- Bakım ---------------- */

/** Tüm kayıtları siler; yalnızca tema tercihi korunur. */
export async function wipeAll() {
  await db.transaction('rw', [db.settings, db.apps, db.days, db.routines, db.routineChecks, db.tasks, db.goals, db.sessions], async () => {
    const theme = (await db.settings.get('app'))?.theme;
    await Promise.all([
      db.settings.clear(),
      db.apps.clear(),
      db.days.clear(),
      db.routines.clear(),
      db.routineChecks.clear(),
      db.tasks.clear(),
      db.goals.clear(),
      db.sessions.clear(),
    ]);
    if (theme) await db.settings.put({ ...DEFAULT_SETTINGS, theme });
  });
}
