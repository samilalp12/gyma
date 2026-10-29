/** Tüm tarihler Europe/Istanbul yerel gününe göre 'YYYY-MM-DD' formatındadır. */
export type ISODate = string;

export interface ScoreWeights {
  routines: number;
  screen: number;
  discipline: number;
}

export type Theme = 'dark' | 'light';

export interface Settings {
  id: 'app';
  weights: ScoreWeights;
  /** 'HH:mm' */
  reminderTime: string;
  /** 'HH:mm' — bu saatten önce check-in açılırsa, dün kapanmadıysa dünü doldurur */
  lateCheckinUntil: string;
  theme: Theme;
  /** Odak kategorileri (ders, kitap…) */
  focusCategories?: FocusCategory[];
  /** Çalışan odak seansı (sayfa yenilense de sürer) */
  activeFocus?: ActiveFocus | null;
}

export interface FocusCategory {
  id: string;
  name: string;
  color: string;
}

export interface ActiveFocus {
  categoryId: string;
  /** Son başlatma/devam anı (ms); duraklatılmışsa null */
  runningSince: number | null;
  /** Önceki çalışma dilimlerinin toplamı (ms) */
  accumulatedMs: number;
  /** Seansın ilk başladığı an (ms) */
  startedAt: number;
  /** Pomodoro hedefi (dk); null = serbest */
  targetMin: number | null;
}

export interface TrackedApp {
  id: string;
  name: string;
  color: string;
  /** Günlük limit (dakika). 0 = limitsiz */
  limit: number;
  order: number;
  /** Silinen uygulamalar geçmiş veriler bozulmasın diye arşivlenir. */
  archived: boolean;
}

export interface Trigger {
  /** Saat aralığı anahtarı (bkz. TIME_SLOTS) */
  slot?: string;
  place?: string;
  causes: string[];
  note?: string;
}

export interface DayLog {
  date: ISODate;
  /** appId -> dakika */
  screen: Record<string, number>;
  /** Telefonun gösterdiği toplam ekran süresi (dk), tüm uygulamalar */
  phoneTotal?: number | null;
  /** null = girilmedi */
  clean: boolean | null;
  trigger?: Trigger;
  /** 1–10 (eski 1–5 kayıtlar v2 geçişinde ×2 yapıldı) */
  mood: number | null;
  /** 1–5 */
  energy: number | null;
  /** Önceki gece uyunan süre (saat). Eski kayıtlarda alan olmayabilir. */
  sleep?: number | null;
  /** Porno izlendi mi (null = girilmedi) */
  porn?: boolean | null;
  /** Kaç kez yeltenildi / dürtüye yaklaşıldı (boşalma olmasa da) */
  urges?: number | null;
  /** Gün içinde kaç kez erteleme yapıldı */
  procrastination?: number | null;
  /** Tartı (kg) — haftalık ölçüm */
  weight?: number | null;
  note: string;
  /** Check-in tamamlandı mı */
  closed: boolean;
  updatedAt: number;
}

/** Rutinin günün hangi bölümünde yapılacağı */
export type DayPart = 'sabah' | 'gun' | 'aksam';

export interface Routine {
  id: string;
  title: string;
  /** Eski kayıtlarda yoksa 'gun' kabul edilir */
  part?: DayPart;
  /** Ölçüm rutini: satırda değer kutusu çıkar (ör. kilo) */
  measure?: 'kg';
  /** ISO haftanın günleri: 1 = Pazartesi ... 7 = Pazar */
  weekdays: number[];
  startDate: ISODate;
  archived: boolean;
  archivedAt: ISODate | null;
  order: number;
}

export interface RoutineCheck {
  routineId: string;
  date: ISODate;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** null = belirli bir güne bağlı olmayan genel iş (bekleyen listesi) */
  date: ISODate | null;
  done: boolean;
  doneAt?: number | null;
  createdAt: number;
  /** Kaç kez ertelendi */
  moved: number;
  /** Elle sıralama; yoksa createdAt'e göre */
  order?: number;
  /** Eisenhower: eski kayıtlarda yoksa false kabul edilir */
  important?: boolean;
  urgent?: boolean;
  /** Günün Tuğlası (yalnızca Ç2 + tarihli işler, günde en fazla bir) */
  brick?: { start: string; end: string } | null;
}

export type GoalPeriod = 'week' | 'month';

/** Haftalık / aylık hedef */
export interface Goal {
  id: string;
  title: string;
  period: GoalPeriod;
  /** Haftanın pazartesisi ya da ayın 1'i (YYYY-MM-DD) */
  start: ISODate;
  /** bar = 0–100 ilerleme · check = tek seferde biten iş */
  kind: 'bar' | 'check';
  /** 0–100 (check türünde 0 ya da 100) */
  progress: number;
  done: boolean;
  doneAt: number | null;
  order: number;
  createdAt: number;
}

/** Tamamlanmış odak seansı */
export interface FocusSession {
  id: string;
  /** Başladığı gün (Europe/Istanbul) */
  date: ISODate;
  categoryId: string;
  startedAt: number;
  endedAt: number;
  minutes: number;
  targetMin: number | null;
}
