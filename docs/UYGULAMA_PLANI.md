# gyma → Uygulama planı

Amaç: web sitesini Mac'te gerçek bir uygulama hâline getirmek ve masaüstünde, hava durumu
widget'ının altında duran küçük bir **gyma widget'ı** (kronometre, günün işleri, rutinler,
hedefler) kullanmak. iPhone'da ana ekrandan açılan bir sürüm.

## Durum

| Adım | Durum |
|---|---|
| Widget görünümü (`/widget`) — cam kart, kronometre, tuğla, işler, hedefler | ✅ hazır |
| PWA manifest (iPhone/Mac'te "Ana Ekrana Ekle" ile tam ekran açılır) | ✅ hazır |
| Odak seansları veritabanında tutuluyor → widget ve ana uygulama aynı seansı görür | ✅ hazır |
| Tauri ile Mac uygulaması | ⏳ Rust kurulumu gerekiyor |
| Verileri tarayıcıdan uygulamaya taşıma | ⏳ tek seferlik dışa/içe aktarma gerekiyor |

## Aşama 1 — iPhone (şimdi yapılabilir)

1. Siteyi Netlify'a at.
2. iPhone'da Safari → siteyi aç → Paylaş → **Ana Ekrana Ekle**.
3. Uygulama gibi tam ekran açılır. Verisi Safari'den ayrı tutulur, ilk açılışta boş olur
   (bunu baştan buradan kullanmaya başlarsan sorun yok).

> iPhone ana ekran widget'ı yalnızca yerel (Swift) uygulamalarla yapılabiliyor; PWA'da yok.

## Aşama 2 — Mac uygulaması + masaüstü widget'ı (Tauri)

**Neden Tauri:** mevcut React kodu olduğu gibi içine girer, uygulama ~10 MB olur (Electron ~150 MB).

1. Kurulum (bir kez):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   npm install -D @tauri-apps/cli@^2
   npx tauri init
   ```
2. İki pencere tanımlanır (`src-tauri/tauri.conf.json`):
   - **main**: normal uygulama penceresi (`/`).
   - **widget**: `/widget` adresi; `decorations: false`, `transparent: true`,
     `alwaysOnBottom: true` (masaüstünde, diğer pencerelerin altında durur),
     `skipTaskbar: true`, `visibleOnAllWorkspaces: true`, boyut ~320×460,
     konum sol üst (hava durumu widget'ının altı, ör. x=24, y=280). Konum sürükleyerek
     değiştirilebilir ve hatırlanır.
3. Menü çubuğu ikonu: widget'ı göster/gizle, uygulamayı aç, çıkış.
4. Oturum açılışında otomatik başlat (Tauri `autostart` eklentisi).
5. `npx tauri build` → `gyma.app` → Uygulamalar klasörüne.

**Not:** Bu, macOS'un kendi "widget galerisi"ndeki bir widget değil; masaüstüne sabitlenmiş,
çerçevesiz bir pencere. Görünüm olarak hava durumu widget'ının yanında aynı durur, üstüne
tıklayıp kronometreyi başlatabilir, iş tikleyebilirsin. Gerçek WidgetKit widget'ı Swift ile
ayrı yazılmayı ve tıklayınca uygulamayı açmayı gerektirir (içinde düğme sınırlı); ihtiyaç
olursa sonra eklenebilir.

## Aşama 3 — Veri taşıma

Tauri uygulaması kendi tarayıcı motorunu kullanır; Chrome/Netlify'daki IndexedDB'yi göremez.
Geçişte bir kez:
1. Eski sitede **Ayarlar → Dışa aktar** (JSON) — geçiş sırasında geri eklenecek.
2. Uygulamada **İçe aktar**.

## Aşama 4 (isteğe bağlı) — Senkron

Telefon ve bilgisayar aynı veriyi görsün istenirse: tek kullanıcılı küçük bir arka uç
(ör. Supabase) + çevrimdışı öncelikli eşitleme. Şimdilik gerek yok; telefon verisi elle giriliyor.
