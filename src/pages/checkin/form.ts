import type { DayLog, Trigger, TrackedApp } from '../../db/types';

export interface CheckinForm {
  /** appId -> input metni (boş = girilmedi) */
  screen: Record<string, string>;
  /** Telefon toplamı: saat / dakika input metinleri */
  phoneH: string;
  phoneM: string;
  clean: boolean | null;
  porn: boolean | null;
  urges: number | null;
  procrastination: number | null;
  trigger: Trigger;
  mood: number | null;
  energy: number | null;
  /** Uyku saati, input metni (ör. "7,5") */
  sleep: string;
  note: string;
}

export function formFromDay(day: DayLog | undefined): CheckinForm {
  return {
    screen: Object.fromEntries(Object.entries(day?.screen ?? {}).map(([k, v]) => [k, String(v)])),
    phoneH: day?.phoneTotal != null ? String(Math.floor(day.phoneTotal / 60)) : '',
    phoneM: day?.phoneTotal != null ? String(day.phoneTotal % 60) : '',
    clean: day?.clean ?? null,
    porn: day?.porn ?? null,
    urges: day?.urges ?? null,
    procrastination: day?.procrastination ?? null,
    trigger: day?.trigger ?? { causes: [] },
    mood: day?.mood ?? null,
    energy: day?.energy ?? null,
    sleep: day?.sleep != null ? String(day.sleep).replace('.', ',') : '',
    note: day?.note ?? '',
  };
}

export function parseMinutes(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Saat + dakika → toplam dakika; ikisi de boşsa null */
export function parsePhoneTotal(h: string, m: string): number | null {
  if (!h.trim() && !m.trim()) return null;
  const hh = parseMinutes(h) ?? 0;
  const mm = parseMinutes(m) ?? 0;
  return hh * 60 + mm;
}

/** "7,5" / "7.5" / "7:30" → 7.5 saat (0–24 arası, çeyrek saate yuvarlı) */
export function parseSleep(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  let h: number;
  const hm = t.match(/^(\d{1,2})[:.](\d{2})$/);
  if (t.includes(':') && hm) h = Number(hm[1]) + Number(hm[2]) / 60;
  else h = Number(t.replace(',', '.'));
  if (!Number.isFinite(h) || h < 0 || h > 24) return null;
  return Math.round(h * 4) / 4;
}

/** Form → DayLog patch. Önceki kayıttaki (ör. arşivlenmiş uygulamaların) dakikalar korunur. */
export function formToPatch(form: CheckinForm, prev: DayLog | undefined, apps: TrackedApp[]): Partial<DayLog> {
  const screen: Record<string, number> = { ...(prev?.screen ?? {}) };
  for (const a of apps) {
    const m = parseMinutes(form.screen[a.id]);
    if (m == null) delete screen[a.id];
    else screen[a.id] = m;
  }
  const hasTrigger = form.trigger.slot || form.trigger.place || form.trigger.causes.length || form.trigger.note?.trim();
  return {
    screen,
    phoneTotal: parsePhoneTotal(form.phoneH, form.phoneM),
    clean: form.clean,
    porn: form.porn,
    urges: form.urges,
    procrastination: form.procrastination,
    trigger: (form.clean === false || form.porn === true) && hasTrigger ? { ...form.trigger, note: form.trigger.note?.trim() } : undefined,
    mood: form.mood,
    energy: form.energy,
    sleep: parseSleep(form.sleep),
    note: form.note.trim(),
  };
}
