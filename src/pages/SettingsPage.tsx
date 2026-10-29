import { Archive, ArchiveRestore, Bell, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RoutineEditor, RoutineSuggestions, weekdaysLabel } from '../components/RoutineEditor';
import { DragHandle, SortableItem, SortableList } from '../components/SortableList';
import { Card, cn, ConfirmModal, PageHeader } from '../components/ui';
import {
  addApp,
  APP_COLORS,
  archiveRoutine,
  deleteRoutine,
  removeApp,
  reorderApps,
  reorderRoutines,
  restoreApp,
  saveSettings,
  updateApp,
  wipeAll,
} from '../db/actions';
import { exportAll, importBackup, type ImportMode } from '../db/backup';
import type { Routine, ScoreWeights, TrackedApp } from '../db/types';
import { useData } from '../hooks/useAppData';
import { requestNotificationPermission } from '../hooks/useReminder';
import { DAY_PARTS } from '../lib/constants';
import { getAutostart, isDesktopApp, setAutostart } from '../lib/desktop';

export function SettingsPage() {
  const { settings } = useData();
  return (
    <>
      <PageHeader title="Ayarlar" />
      <div className="space-y-5">
        <ScreenToggle />
        {settings.screenTimeEnabled !== false && <AppsSection />}
        <RoutinesSection />
        <div className="grid gap-5 lg:grid-cols-2">
          <WeightsSection />
          <div className="space-y-5">
            <ReminderSection />
            <ThemeSection />
          </div>
        </div>
        {isDesktopApp && <DesktopSection />}
        <DataSection />
      </div>
    </>
  );
}

/* ---------------- Ekran süresi aç/kapa ---------------- */

function ScreenToggle() {
  const { settings } = useData();
  const on = settings.screenTimeEnabled !== false;
  return (
    <Card title="Ekran süresi">
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} onChange={(e) => void saveSettings({ screenTimeEnabled: e.target.checked })} />
        Ekran süresi takibi
      </label>
      <p className="mt-2 text-xs text-muted">
        Kapalıyken check-in’deki ekran süresi adımı, Ekran Süresi sekmesi, gün skorundaki ekran payı ve ilgili grafikler gizlenir.
        Daha önce girilen veriler silinmez; açınca geri gelir.
      </p>
    </Card>
  );
}

/* ---------------- Uygulamalar ---------------- */

function AppsSection() {
  const { apps } = useData();
  const active = apps.filter((a) => !a.archived);
  const removed = apps.filter((a) => a.archived);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('30');

  const submit = () => {
    if (!name.trim()) return;
    void addApp(name, Number(limit) || 0);
    setName('');
  };

  return (
    <Card title="Takip edilen uygulamalar" action={<span className="text-xs text-muted">Tutup sürükle · check-in’de bu sırayla görünür</span>}>
      {active.length === 0 && (
        <p className="mb-3 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Henüz uygulama yok. Aşağıdan ekle — ör. Instagram, 30 dk.
        </p>
      )}
      <SortableList items={active} onReorder={(ids) => void reorderApps(ids)} className="space-y-1.5">
        {(a) => <AppRow key={a.id} app={a} />}
      </SortableList>

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input className="input min-w-40 flex-1" placeholder="Uygulama adı" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-2">
          <input
            className="input w-20 text-right"
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            aria-label="Günlük limit"
          />
          <span className="text-xs text-muted">dk/gün</span>
        </div>
        <button className="btn-primary" type="submit" disabled={!name.trim()}>
          <Plus size={15} /> Ekle
        </button>
      </form>

      {removed.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-muted">Silinen uygulamalar ({removed.length}) — geçmiş verileri korunur</summary>
          <ul className="mt-2 space-y-1.5">
            {removed.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  {a.name}
                </span>
                <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void restoreApp(a.id)}>
                  <ArchiveRestore size={13} /> Geri al
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function AppRow({ app }: { app: TrackedApp }) {
  const [name, setName] = useState(app.name);
  const [limit, setLimit] = useState(String(app.limit));
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    setName(app.name);
  }, [app.name]);
  useEffect(() => {
    setLimit(String(app.limit));
  }, [app.limit]);

  const commit = () => {
    const l = Math.max(0, Math.round(Number(limit) || 0));
    if (name.trim() && (name.trim() !== app.name || l !== app.limit)) void updateApp(app.id, { name: name.trim(), limit: l });
    else {
      setName(app.name);
      setLimit(String(app.limit));
    }
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.target as HTMLInputElement).blur();

  return (
    <SortableItem id={app.id} handle className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg px-2 py-2">
      <DragHandle />
      <button
        className="h-6 w-6 shrink-0 cursor-pointer rounded-full border-2 border-bg ring-1 ring-line"
        style={{ background: app.color }}
        onClick={() => setPalette((p) => !p)}
        title="Renk"
      />
      {palette && (
        <div className="absolute left-8 top-11 z-20 flex gap-1.5 rounded-xl border border-line bg-card p-2 shadow-xl">
          {APP_COLORS.map((c) => (
            <button
              key={c}
              className={cn('h-6 w-6 cursor-pointer rounded-full', c === app.color && 'ring-2 ring-fg ring-offset-2 ring-offset-card')}
              style={{ background: c }}
              onClick={() => {
                void updateApp(app.id, { color: c });
                setPalette(false);
              }}
            />
          ))}
        </div>
      )}
      <input className="input min-w-32 flex-1 border-transparent bg-transparent px-2" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={onKey} />
      <div className="flex items-center gap-1.5">
        <input
          className="input w-20 text-right"
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          aria-label="Günlük limit"
        />
        <span className="w-12 text-xs text-muted">dk/gün</span>
      </div>
      <button className="btn-icon hover:text-danger" onClick={() => void removeApp(app.id)} title="Sil (geçmiş korunur)">
        <Trash2 size={15} />
      </button>
    </SortableItem>
  );
}

/* ---------------- Rutinler ---------------- */

function RoutinesSection() {
  const { routines } = useData();
  const active = routines.filter((r) => !r.archived);
  const archived = routines.filter((r) => r.archived);
  const [editing, setEditing] = useState<Routine | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Routine | null>(null);

  const groups = DAY_PARTS.map((p) => ({ ...p, items: active.filter((r) => (r.part ?? 'gun') === p.key) })).filter((g) => g.items.length);

  return (
    <Card
      title="Rutinler"
      action={
        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setEditing(null)}>
          <Plus size={14} /> Yeni rutin
        </button>
      }
    >
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Henüz rutin yok. Aşağıdaki önerilerden seç ya da “Yeni rutin” ile kendi rutinini ekle.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className={cn('label mb-2', g.key === 'sabah' && 'text-accent')}>{g.label}</div>
              <SortableList items={g.items} onReorder={(ids) => void reorderRoutines(ids)} className="space-y-1.5">
                {(r) => (
                  <SortableItem key={r.id} id={r.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-2 py-2">
                    <DragHandle />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{r.title}</div>
                      <div className="text-xs text-muted">{weekdaysLabel(r.weekdays)}</div>
                    </div>
                    <button className="btn-icon" onClick={() => setEditing(r)} title="Düzenle">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => void archiveRoutine(r.id, true)} title="Arşivle (geçmiş korunur, listeden kalkar)">
                      <Archive size={14} />
                    </button>
                    <button className="btn-icon hover:text-danger" onClick={() => setDeleting(r)} title="Sil">
                      <Trash2 size={14} />
                    </button>
                  </SortableItem>
                )}
              </SortableList>
            </div>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-sm text-muted">Arşivlenmiş rutinler ({archived.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {archived.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted">{r.title}</span>
                <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void archiveRoutine(r.id, false)}>
                  <ArchiveRestore size={13} /> Geri al
                </button>
                <button className="btn-icon hover:text-danger" onClick={() => setDeleting(r)} title="Sil">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <RoutineSuggestions existing={routines} />
      </div>
      <RoutineEditor open={editing !== undefined} routine={editing ?? null} onClose={() => setEditing(undefined)} />
      <ConfirmModal
        open={deleting != null}
        title="Rutin silinsin mi?"
        text={
          <>
            “{deleting?.title}” ve tüm geçmiş tikleri kalıcı olarak silinecek. Sadece listeden kaldırıp geçmişini korumak istersen{' '}
            <span className="text-fg">arşivle</span>.
          </>
        }
        confirmLabel="Sil"
        danger
        onConfirm={() => deleting && void deleteRoutine(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}

/* ---------------- Ağırlıklar ---------------- */

function WeightsSection() {
  const { settings } = useData();
  const w = settings.weights;
  const screen = settings.screenTimeEnabled !== false;
  const total = w.routines + (screen ? w.screen : 0) + w.discipline;
  const set = (k: keyof ScoreWeights, v: number) => void saveSettings({ weights: { ...w, [k]: v } });
  const items: { k: keyof ScoreWeights; label: string }[] = [
    { k: 'routines', label: 'Rutin tamamlanma' },
    { k: 'screen', label: 'Ekran süresi limit uyumu' },
    { k: 'discipline', label: 'Disiplin (temiz gün)' },
  ].filter((x) => screen || x.k !== 'screen') as { k: keyof ScoreWeights; label: string }[];
  return (
    <Card
      title="Gün skoru ağırlıkları"
      action={
        <button className="text-xs text-muted hover:text-fg" onClick={() => void saveSettings({ weights: { routines: 33, screen: 33, discipline: 33 } })}>
          Eşit dağıt
        </button>
      }
    >
      <div className="space-y-4">
        {items.map(({ k, label }) => (
          <div key={k}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span>{label}</span>
              <span className="tabular-nums text-muted">%{total ? Math.round((w[k] / total) * 100) : 0}</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={w[k]} onChange={(e) => set(k, Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Oranlar toplam 100’e göre normalize edilir. O gün girilmeyen bileşen hesaba katılmaz.
        {total === 0 && <span className="text-danger"> En az bir ağırlık 0’dan büyük olmalı.</span>}
      </p>
    </Card>
  );
}

/* ---------------- Hatırlatma ---------------- */

function ReminderSection() {
  const { settings } = useData();
  const [perm, setPerm] = useState<string>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const label: Record<string, string> = {
    granted: 'Bildirimler açık',
    denied: 'Bildirimler engellendi (tarayıcı ayarlarından açabilirsin)',
    default: 'Bildirim izni verilmedi',
    unsupported: 'Bu tarayıcı bildirimleri desteklemiyor',
  };
  return (
    <Card title="Hatırlatma ve gün sınırı">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="time"
          className="input w-auto"
          value={settings.reminderTime}
          onChange={(e) => e.target.value && void saveSettings({ reminderTime: e.target.value })}
        />
        {perm === 'default' && (
          <button className="btn-ghost" onClick={async () => setPerm(await requestNotificationPermission())}>
            <Bell size={15} /> Bildirimlere izin ver
          </button>
        )}
      </div>
      <p className={cn('mt-3 text-xs', perm === 'granted' ? 'text-accent' : 'text-muted')}>{label[perm]}</p>
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="time"
            className="input w-auto"
            value={settings.lateCheckinUntil}
            onChange={(e) => e.target.value && void saveSettings({ lateCheckinUntil: e.target.value })}
          />
          <span className="text-sm">saatine kadar açılan check-in, dün kapanmadıysa dünü doldurur</span>
        </div>
        <p className="mt-2 text-xs text-muted">Akşam unutup sabah yaptığında kayıtlar yanlışlıkla yeni güne yazılmaz.</p>
      </div>
      <p className="mt-1 text-xs text-muted">
        Sekme açıksa bu saatte bildirim gelir; check-in yapılmadıysa uygulamanın üstünde uyarı bandı görünür.
      </p>
    </Card>
  );
}

/* ---------------- Tema ---------------- */

function ThemeSection() {
  const { settings } = useData();
  return (
    <Card title="Tema">
      <div className="inline-flex rounded-[10px] border border-line p-0.5">
        {(['dark', 'light'] as const).map((t) => (
          <button
            key={t}
            onClick={() => void saveSettings({ theme: t })}
            className={cn('cursor-pointer rounded-lg px-4 py-1.5 text-sm', settings.theme === t ? 'bg-card-2 text-fg' : 'text-muted')}
          >
            {t === 'dark' ? 'Koyu' : 'Açık'}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Veri ---------------- */

function DesktopSection() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void getAutostart().then(setOn);
  }, []);
  return (
    <Card title="Masaüstü uygulaması">
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={!!on}
          disabled={on == null}
          onChange={async (e) => {
            await setAutostart(e.target.checked);
            setOn(await getAutostart());
          }}
        />
        Mac açıldığında başlat (yalnızca widget açılır)
      </label>
      <p className="mt-2 text-xs text-muted">Widget’ı menü çubuğundaki gyma ikonundan gösterip gizleyebilirsin.</p>
    </Card>
  );
}

function DataSection() {
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState<ImportMode>('replace');
  const [pending, setPending] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runImport = async (f: File) => {
    try {
      const r = await importBackup(f, mode);
      setMsg({ ok: true, text: `İçe aktarıldı: ${r.days} günlük kayıt (${mode === 'merge' ? 'birleştirildi' : 'üzerine yazıldı'}).` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'İçe aktarma başarısız.' });
    }
  };

  return (
    <Card title="Veri">
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <div className="label mb-2">Dışa aktar</div>
          <button className="btn-primary" onClick={() => void exportAll()}>
            <Download size={15} /> JSON indir
          </button>
          <p className="mt-2 text-xs text-muted">Tüm kayıtları tek dosyada indirir (taşıma / yedek).</p>
        </div>
        <div>
          <div className="label mb-2">İçe aktar</div>
          <div className="mb-2 flex gap-3 text-sm">
            {(
              [
                ['replace', 'Üzerine yaz'],
                ['merge', 'Birleştir'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="import-mode" checked={mode === k} onChange={() => setMode(k)} className="accent-[var(--accent)]" />
                {l}
              </label>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (mode === 'replace') setPending(f);
              else void runImport(f);
            }}
          />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Dosya seç
          </button>
          {msg && <p className={cn('mt-2 text-xs', msg.ok ? 'text-accent' : 'text-danger')}>{msg.text}</p>}
        </div>
        <div>
          <div className="label mb-2">Sıfırdan başla</div>
          <button className="btn-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> Tüm veriyi sil
          </button>
          <p className="mt-2 text-xs text-muted">Geri alınamaz; önce dışa aktarmanı öneririm.</p>
        </div>
      </div>
      <ConfirmModal
        open={confirm}
        title="Tüm veri silinsin mi?"
        text="Uygulamalar, rutinler, işler, hedefler, odak seansları ve tüm günlük kayıtlar kalıcı olarak silinecek."
        confirmLabel="Evet, hepsini sil"
        danger
        onConfirm={() => void wipeAll()}
        onClose={() => setConfirm(false)}
      />
      <ConfirmModal
        open={pending != null}
        title="Üzerine yazılsın mı?"
        text="Buradaki mevcut veriler silinip yedek dosyasındakilerle değiştirilecek."
        confirmLabel="Üzerine yaz"
        danger
        onConfirm={() => pending && void runImport(pending)}
        onClose={() => setPending(null)}
      />
    </Card>
  );
}
