import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { ISODate } from '../db/types';

const TZ = 'Europe/Istanbul';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Europe/Istanbul saatine göre bugünün tarihi. */
export function todayISO(now = new Date()): ISODate {
  return dateFmt.format(now);
}

/** Europe/Istanbul saatine göre 'HH:mm'. */
export function nowHHmm(now = new Date()): string {
  return timeFmt.format(now);
}

/** Takvim tarihi (yerel gece yarısı) olarak parse eder. */
export function fromISO(d: ISODate): Date {
  return parseISO(d);
}

export function toISO(d: Date): ISODate {
  return format(d, 'yyyy-MM-dd');
}

export function addDaysISO(d: ISODate, n: number): ISODate {
  return toISO(addDays(fromISO(d), n));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISO(a), fromISO(b));
}

/** ISO haftanın günü: 1 = Pazartesi ... 7 = Pazar */
export function isoWeekday(d: ISODate): number {
  const w = fromISO(d).getDay();
  return w === 0 ? 7 : w;
}

export function weekStartISO(d: ISODate): ISODate {
  return toISO(startOfWeek(fromISO(d), { weekStartsOn: 1 }));
}

/** start ve end dahil tarih listesi */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}

export function lastNDays(n: number, end = todayISO()): ISODate[] {
  return dateRange(addDaysISO(end, -(n - 1)), end);
}

export function fmt(d: ISODate, pattern: string): string {
  return format(fromISO(d), pattern, { locale: tr });
}

/** 12 Ekim 2026, Pazartesi */
export const fmtLong = (d: ISODate) => fmt(d, 'd MMMM yyyy, EEEE');
/** 12 Eki */
export const fmtShort = (d: ISODate) => fmt(d, 'd MMM');
/** 12 Eki Pzt */
export const fmtShortDay = (d: ISODate) => fmt(d, 'd MMM EEE');

export function relativeLabel(d: ISODate, today = todayISO()): string {
  const diff = diffDays(d, today);
  if (diff === 0) return 'Bugün';
  if (diff === -1) return 'Dün';
  if (diff === 1) return 'Yarın';
  return fmt(d, 'd MMMM EEEE');
}

export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const WEEKDAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export function formatMinutes(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

/** 7.5 → "7 sa 30 dk" */
export function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(h)) return '—';
  return formatMinutes(h * 60);
}
