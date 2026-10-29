import { useEffect, useRef, useState } from 'react';
import type { ActiveFocus, FocusCategory, ISODate } from '../db/types';
import type { AppData } from './metrics';

/** Hızlı süre önerileri (dk) */
export const FOCUS_SUGGESTIONS = [25, 50, 90];

const LAST_KEY = 'gyma:lastFocus';

/** Son kullanılan kategori ve süre (cihaz başına kolaylık) */
export function loadLastFocus(): { category: string; minutes: string } {
  try {
    return { category: '', minutes: '', ...JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') };
  } catch {
    return { category: '', minutes: '' };
  }
}

export function saveLastFocus(v: { category: string; minutes: string }) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    /* yoksay */
  }
}

/** "45" → 45 · boş/geçersiz → null (serbest) */
export function parseTarget(s: string): number | null {
  const n = Math.round(Number(s.replace(',', '.')));
  return s.trim() && Number.isFinite(n) && n > 0 && n <= 600 ? n : null;
}

export function elapsedMs(f: ActiveFocus, now = Date.now()) {
  return f.accumulatedMs + (f.runningSince != null ? now - f.runningSince : 0);
}

/** 1:05:09 · 25:03 */
export function formatClock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function categoryOf(data: AppData, id: string): FocusCategory {
  return data.settings.focusCategories?.find((c) => c.id === id) ?? { id, name: 'Silinmiş kategori', color: '#8b919c' };
}

/** Tarihlerde kategori bazında toplam odak dakikası */
export function focusMinutes(data: AppData, dates: ISODate[]): Map<string, number> {
  const set = new Set(dates);
  const out = new Map<string, number>();
  for (const s of data.sessions) if (set.has(s.date)) out.set(s.categoryId, (out.get(s.categoryId) ?? 0) + s.minutes);
  return out;
}

export function focusTotal(data: AppData, date: ISODate): number {
  return data.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
}

/**
 * Çalışan seansın canlı süresi (saniyede bir günceller).
 * Pomodoro hedefi dolduğunda bir kez tarayıcı bildirimi gönderir.
 */
export function useFocusClock(f: ActiveFocus | null | undefined, label: string) {
  const [now, setNow] = useState(Date.now());
  const notified = useRef<number | null>(null);

  useEffect(() => {
    if (!f || f.runningSince == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [f]);

  const ms = f ? elapsedMs(f, now) : 0;
  const targetMs = f?.targetMin ? f.targetMin * 60000 : null;
  const reached = targetMs != null && ms >= targetMs;

  useEffect(() => {
    if (!f || !reached || notified.current === f.startedAt) return;
    notified.current = f.startedAt;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('gyma · Süre doldu', { body: `${label}: ${f.targetMin} dakika tamam. Mola ver ya da devam et.`, icon: '/favicon.svg' });
    } catch {
      /* desteklenmiyor */
    }
  }, [reached, f, label]);

  return { ms, targetMs, reached, progress: targetMs ? Math.min(1, ms / targetMs) : null };
}
