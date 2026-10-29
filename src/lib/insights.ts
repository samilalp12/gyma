import type { ISODate } from '../db/types';
import { lastNDays } from './date';
import { focusTotal } from './focus';
import { type AppData, avg, dueRoutines, isRoutineDone, overallScreen, screenOn } from './metrics';

/**
 * Korelasyon kartı: verilerdeki iki grubu (ör. az / çok uyuduğun günler) bir sonuç
 * metriğinde (ör. mood) kıyaslar. Bu ilişki gösterir, neden-sonuç kanıtlamaz.
 */
export interface Insight {
  id: string;
  /** "7 saatten az uyuduğun günlerde" */
  aLabel: string;
  bLabel: string;
  metric: string;
  a: number;
  b: number;
  aN: number;
  bN: number;
  /** Değerin biçimi */
  unit: 'num' | 'pct' | 'min';
  /** Daha düşük olan mı iyi? (dürtü, erteleme, bozulma) */
  lowerIsBetter: boolean;
  /** Etki büyüklüğü (sıralama için) */
  strength: number;
}

const MIN_N = 4;
const WINDOW = 90;

type Get<T> = (d: ISODate) => T | null | undefined;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function compare(
  dates: ISODate[],
  group: Get<boolean>,
  outcome: Get<number>,
  meta: Omit<Insight, 'a' | 'b' | 'aN' | 'bN' | 'strength'>,
): Insight | null {
  const A: number[] = [];
  const B: number[] = [];
  for (const d of dates) {
    const g = group(d);
    const o = outcome(d);
    if (g == null || o == null) continue;
    (g ? A : B).push(o);
  }
  if (A.length < MIN_N || B.length < MIN_N) return null;
  const a = avg(A)!;
  const b = avg(B)!;
  // Anlamlı fark eşiği: yüzdelerde 15 puan, sayılarda %15 (küçük tabana karşı korumalı)
  const diff = meta.unit === 'pct' ? Math.abs(a - b) / 100 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
  if (diff < 0.15) return null;
  return { ...meta, a, b, aN: A.length, bN: B.length, strength: diff };
}

export function computeInsights(data: AppData): { insights: Insight[]; daysWithData: number } {
  const dates = lastNDays(WINDOW, data.today).filter((d) => d < data.today || data.days.get(d)?.closed);
  const day = (d: ISODate) => data.days.get(d);

  const sleep: Get<number> = (d) => day(d)?.sleep;
  const mood: Get<number> = (d) => day(d)?.mood;
  const urges: Get<number> = (d) => day(d)?.urges;
  const procr: Get<number> = (d) => day(d)?.procrastination;
  const slip: Get<number> = (d) => (day(d)?.clean == null ? null : day(d)!.clean ? 0 : 100);
  const screen: Get<number> = (d) => (day(d) ? overallScreen(data, d) : null);
  const focus: Get<number> = (d) => (day(d)?.closed ? focusTotal(data, d) : null);
  const morningDone: Get<boolean> = (d) => {
    const m = dueRoutines(data, d).filter((r) => r.part === 'sabah');
    if (!m.length || !day(d)) return null;
    return m.every((r) => isRoutineDone(data, r.id, d));
  };

  const screens = dates.map(screen).filter((x): x is number => x != null);
  const screenMed = median(screens);
  const highScreen: Get<boolean> = (d) => {
    const v = screen(d);
    return v == null ? null : v > screenMed;
  };
  const lowSleep: Get<boolean> = (d) => {
    const v = sleep(d);
    return v == null ? null : v < 7;
  };
  const sm = Math.round(screenMed);
  const screenA = `Ekran süresi ${sm} dk’yı aştığı günlerde`;
  const screenB = 'daha az olduğu günlerde';

  const candidates: (Insight | null)[] = [
    compare(dates, lowSleep, mood, { id: 'sleep-mood', aLabel: '7 saatten az uyuduğun günlerde', bLabel: '7+ saat uyuduğunda', metric: 'mood', unit: 'num', lowerIsBetter: false }),
    compare(dates, lowSleep, urges, { id: 'sleep-urges', aLabel: '7 saatten az uyuduğun günlerde', bLabel: '7+ saat uyuduğunda', metric: 'dürtü', unit: 'num', lowerIsBetter: true }),
    compare(dates, lowSleep, procr, { id: 'sleep-procr', aLabel: '7 saatten az uyuduğun günlerde', bLabel: '7+ saat uyuduğunda', metric: 'erteleme', unit: 'num', lowerIsBetter: true }),
    compare(dates, highScreen, mood, { id: 'screen-mood', aLabel: screenA, bLabel: screenB, metric: 'mood', unit: 'num', lowerIsBetter: false }),
    compare(dates, highScreen, slip, { id: 'screen-slip', aLabel: screenA, bLabel: screenB, metric: 'bozulma oranı', unit: 'pct', lowerIsBetter: true }),
    compare(dates, highScreen, urges, { id: 'screen-urges', aLabel: screenA, bLabel: screenB, metric: 'dürtü', unit: 'num', lowerIsBetter: true }),
    compare(dates, morningDone, procr, { id: 'morning-procr', aLabel: 'Sabah rutinini tamamladığın günlerde', bLabel: 'tamamlamadığında', metric: 'erteleme', unit: 'num', lowerIsBetter: true }),
    compare(dates, morningDone, focus, { id: 'morning-focus', aLabel: 'Sabah rutinini tamamladığın günlerde', bLabel: 'tamamlamadığında', metric: 'odak süresi', unit: 'min', lowerIsBetter: false }),
    compare(dates, morningDone, mood, { id: 'morning-mood', aLabel: 'Sabah rutinini tamamladığın günlerde', bLabel: 'tamamlamadığında', metric: 'mood', unit: 'num', lowerIsBetter: false }),
    compare(dates, (d) => (focus(d) == null ? null : focus(d)! >= 60), mood, { id: 'focus-mood', aLabel: 'En az 1 saat odaklandığın günlerde', bLabel: 'daha az odaklandığında', metric: 'mood', unit: 'num', lowerIsBetter: false }),
    compare(dates, (d) => (procr(d) == null ? null : procr(d)! >= 3), slip, { id: 'procr-slip', aLabel: '3+ kez ertelediğin günlerde', bLabel: 'daha az ertelediğinde', metric: 'bozulma oranı', unit: 'pct', lowerIsBetter: true }),
  ];

  const noScreen = !screenOn(data);
  const insights = candidates
    .filter((x) => !(noScreen && x?.id.startsWith('screen'))).filter((x): x is Insight => x != null).sort((a, b) => b.strength - a.strength);
  return { insights, daysWithData: dates.filter((d) => day(d)).length };
}

export function formatInsightValue(i: Insight, v: number) {
  if (i.unit === 'pct') return `%${Math.round(v)}`;
  if (i.unit === 'min') return `${Math.round(v)} dk`;
  return v.toFixed(1).replace('.', ',');
}

/** A grubunun B'ye göre iyi mi kötü mü olduğu */
export function insightTone(i: Insight): 'good' | 'bad' {
  const aBetter = i.lowerIsBetter ? i.a < i.b : i.a > i.b;
  return aBetter ? 'good' : 'bad';
}
