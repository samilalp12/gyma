import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, db } from '../db/db';
import type { Task } from '../db/types';
import { todayISO } from '../lib/date';
import type { AppData } from '../lib/metrics';

/** Gün değişimini (gece yarısı) yakalamak için dakikada bir kontrol eder. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 30_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

const DataContext = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const raw = useLiveQuery(async () => {
    const [settings, apps, days, routines, checks, tasks, goals, sessions] = await Promise.all([
      db.settings.get('app'),
      db.apps.orderBy('order').toArray(),
      db.days.toArray(),
      db.routines.orderBy('order').toArray(),
      db.routineChecks.toArray(),
      db.tasks.toArray(),
      db.goals.orderBy('order').toArray(),
      db.sessions.toArray(),
    ]);
    return { settings, apps, days, routines, checks, tasks, goals, sessions };
  }, []);

  const data = useMemo<AppData | null>(() => {
    if (!raw) return null;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...raw.settings,
      weights: { ...DEFAULT_SETTINGS.weights, ...raw.settings?.weights },
    };
    const checks = new Map<string, Map<string, boolean>>();
    for (const c of raw.checks) {
      let m = checks.get(c.date);
      if (!m) checks.set(c.date, (m = new Map()));
      m.set(c.routineId, c.done);
    }
    const tasksByDate = new Map<string, Task[]>();
    const backlog: Task[] = [];
    for (const t of [...raw.tasks].sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))) {
      if (t.date == null) {
        backlog.push(t);
        continue;
      }
      const list = tasksByDate.get(t.date);
      if (list) list.push(t);
      else tasksByDate.set(t.date, [t]);
    }
    return {
      settings,
      apps: raw.apps,
      activeApps: raw.apps.filter((a) => !a.archived),
      appById: new Map(raw.apps.map((a) => [a.id, a])),
      days: new Map(raw.days.map((d) => [d.date, d])),
      routines: raw.routines,
      checks,
      tasksByDate,
      backlog,
      goals: raw.goals,
      sessions: [...raw.sessions].sort((a, b) => a.startedAt - b.startedAt),
      today,
    };
  }, [raw, today]);

  // Tema
  const theme = data?.settings.theme;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle('light', theme === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F5F6F8' : '#0F1115');
    try {
      localStorage.setItem('gyma:theme', theme);
    } catch {
      /* yoksay */
    }
  }, [theme]);

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Yükleniyor…</div>;
  }
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  const d = useContext(DataContext);
  if (!d) throw new Error('useData DataProvider içinde kullanılmalı');
  return d;
}
