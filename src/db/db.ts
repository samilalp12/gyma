import Dexie, { type EntityTable } from 'dexie';
import type { DayLog, FocusSession, Goal, Routine, RoutineCheck, Settings, Task, TrackedApp } from './types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  // Eşit ağırlık: rutin, ekran ve disiplin günü eşit belirler
  weights: { routines: 33, screen: 33, discipline: 33 },
  reminderTime: '23:00',
  lateCheckinUntil: '12:00',
  theme: 'dark',
  screenTimeEnabled: false,
  focusCategories: [
    { id: 'ders', name: 'Ders', color: '#3987e5' },
    { id: 'proje', name: 'Proje', color: '#199e70' },
    { id: 'kitap', name: 'Kitap', color: '#c98500' },
  ],
  activeFocus: null,
};

class GymaDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  apps!: EntityTable<TrackedApp, 'id'>;
  days!: EntityTable<DayLog, 'date'>;
  routines!: EntityTable<Routine, 'id'>;
  routineChecks!: Dexie.Table<RoutineCheck, [string, string]>;
  tasks!: EntityTable<Task, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  sessions!: EntityTable<FocusSession, 'id'>;

  constructor() {
    super('gyma');
    this.version(1).stores({
      settings: 'id',
      apps: 'id, order',
      days: 'date',
      routines: 'id, order, archived',
      routineChecks: '[routineId+date], routineId, date',
      tasks: 'id, date',
    });
    // v2: mood 1–5 → 1–10
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('days')
          .toCollection()
          .modify((d: DayLog) => {
            if (d.mood != null) d.mood = Math.min(10, d.mood * 2);
          }),
      );
    // v3: hedefler + eski varsayılan ağırlıklar (40/30/30) eşite çekilir
    this.version(3)
      .stores({ goals: 'id, [period+start]' })
      .upgrade((tx) =>
        tx
          .table('settings')
          .toCollection()
          .modify((s: Settings) => {
            const w = s.weights;
            if (w && w.routines === 40 && w.screen === 30 && w.discipline === 30) s.weights = { routines: 33, screen: 33, discipline: 33 };
          }),
      );
    // v4: hedef sıralaması için order indeksi
    this.version(4).stores({ goals: 'id, order, [period+start]' });
    // v5: odak seansları
    this.version(5).stores({ sessions: 'id, date' });
  }
}

export const db = new GymaDB();

export const TABLES = ['settings', 'apps', 'days', 'routines', 'routineChecks', 'tasks'] as const;

export function uid(): string {
  return crypto.randomUUID();
}

export function emptyDay(date: string): DayLog {
  return {
    date,
    screen: {},
    phoneTotal: null,
    clean: null,
    mood: null,
    energy: null,
    sleep: null,
    porn: null,
    urges: null,
    procrastination: null,
    note: '',
    closed: false,
    updatedAt: Date.now(),
  };
}
