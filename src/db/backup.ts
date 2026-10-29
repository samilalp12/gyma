import { todayISO } from '../lib/date';
import { db } from './db';

/** Yedekte taşınan tüm tablolar */
const TABLES = ['settings', 'apps', 'days', 'routines', 'routineChecks', 'tasks', 'goals', 'sessions'] as const;
type TableName = (typeof TABLES)[number];

export interface BackupFile {
  app: 'gyma';
  version: 2;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

/** Tüm veriyi tarihli bir JSON dosyası olarak indirir. */
export async function exportAll(): Promise<void> {
  const tables: BackupFile['tables'] = {};
  for (const t of TABLES) tables[t] = await db.table(t).toArray();
  const file: BackupFile = { app: 'gyma', version: 2, exportedAt: new Date().toISOString(), tables };
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gyma-yedek-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportMode = 'replace' | 'merge';

/**
 * replace: mevcut her şeyi silip yedeği yükler.
 * merge: aynı anahtarlı kayıtlar yedektekiyle güncellenir, diğerleri korunur.
 */
export async function importBackup(file: File, mode: ImportMode): Promise<{ days: number }> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile> & Record<string, unknown>;
  if (parsed?.app !== 'gyma') throw new Error('Bu dosya bir gyma yedeği değil.');
  // v1 yedekleri tabloları en üst seviyede tutuyordu
  const tables = (parsed.tables ?? parsed) as BackupFile['tables'];
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = tables[t];
      if (mode === 'replace') await db.table(t).clear();
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
  });
  return { days: Array.isArray(tables.days) ? tables.days.length : 0 };
}
