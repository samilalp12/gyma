# gyma

Kişisel disiplin ve verimlilik takibi — her akşam ~5 dakikalık bir check-in ile günü kapat,
alışkanlıklarını, ekran süreni, odak seanslarını ve hedeflerini tek yerden gör.
Tamamen Türkçe, **hesap yok, sunucu yok**: tüm veriler senin cihazında (IndexedDB) kalır.

## Özellikler

- **Gece check-in'i:** ekran süresi (uygulama bazında + telefon toplamı), rutinler, disiplin, uyku, mood (1–10), not.
  Klavyeyle hızlı; sabaha kalırsa dünün tarihine yazar.
- **Bugün yapılacaklar + bekleyen işler:** Eisenhower çeyrekleri (Ç1–Ç4), "Günün Tuğlası", sürükle-bırak sıralama.
- **Rutinler:** sabah / gün içi / akşam, haftanın günleri, seriler, ölçüm rutini (ör. haftalık kilo).
- **Odak seansları:** tek tıkla başlat, serbest ya da hedef süreli, kategori bazında istatistikler.
- **Hedefler:** haftalık / aylık, ilerleme çubuğu ya da tek iş.
- **Korelasyonlar:** "Seni ne etkiliyor?" — uyku, ekran süresi, sabah rutini, odak ve disiplin arasındaki ilişkiler.
- **Heatmap'ler:** gün skoru, ekran süresi limit uyumu, disiplin, önemli işler, odak.
- **Masaüstü uygulaması (macOS):** menü çubuğu ikonu ve masaüstünde duran küçük widget (odak, bugün, not, hedef, özet).
- Açık / koyu tema, JSON dışa / içe aktarma.

## Çalıştırma (web)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

## Masaüstü uygulaması (macOS)

[Rust](https://rustup.rs) gerekir.

```bash
npm run app:build
cp -R src-tauri/target/release/bundle/macos/gyma.app /Applications/
```

İlk açılışta "Mac açıldığında başlat" etkinleşir (Ayarlar'dan kapatılabilir). Widget'ı başlığından sürükleyerek konumlandırabilirsin.

## Yayınlama

**Netlify:** Build command `npm run build`, publish directory `dist`. SPA yönlendirmesi için `public/_redirects` hazır.

**Vercel:** Projeyi import et (Vite otomatik algılanır). `vercel.json` hazır.

> Veriler tarayıcıya ve adrese bağlıdır. Taşımak için Ayarlar → Veri → JSON indir / İçe aktar.

## Yapı

```
src/
  db/          Dexie şeması, tipler, veri işlemleri
  lib/         tarih (Europe/Istanbul), metrikler (skor, streak), heatmap hücre eşlemeleri, sabitler
  hooks/       veri context'i, hatırlatma, grafik teması
  components/  Heatmap, Layout, ortak UI, odak zamanlayıcısı, Eisenhower, grafikler
  pages/       Özet, Check-in, Ekran Süresi, Günlük, Odak, Disiplin, Haftalık, Ayarlar, Widget
src-tauri/     macOS uygulaması (Tauri): pencereler, menü çubuğu, otomatik başlatma
```

## Veri modeli

| Tablo           | Anahtar               | İçerik                                                                 |
| --------------- | --------------------- | ---------------------------------------------------------------------- |
| `settings`      | `id = 'app'`          | skor ağırlıkları, hatırlatma saati, sabah check-in sınırı, tema        |
| `apps`          | `id`                  | ad, renk, günlük limit, sıra, arşiv (silinen uygulamanın geçmişi kalır) |
| `days`          | `date` (YYYY-MM-DD)   | ekran dakikaları, telefon toplam ekran süresi, temiz mi, porno, yeltenme sayısı, erteleme sayısı, tetikleyici, uyku (saat), mood (1–10), enerji (1–5), kilo (kg), not, kapandı mı |
| `routines`      | `id`                  | ad, günün bölümü (sabah / gün içi / akşam), haftanın günleri, başlangıç, arşiv, `measure: 'kg'` = ölçüm rutini |
| `routineChecks` | `[routineId+date]`    | yapıldı mı                                                             |
| `goals`         | `id`                  | haftalık / aylık hedef: dönem başlangıcı, tür (`bar` = 0–100 ilerleme, `check` = tek iş), ilerleme, tamamlandı, sıra |
| `sessions`      | `id`                  | odak seansı: gün, kategori, başlangıç/bitiş, dakika, hedef |
| `tasks`         | `id`                  | iş; `date = null` ise tarihsiz genel iş (bekleyen listesi), yapıldı mı, kaç kez ertelendi, sıra, `important` / `urgent` (Eisenhower), `brick` = Günün Tuğlası saat aralığı |

**Gün skoru** = rutin + iş tamamlanma oranı, ekran süresi limit uyumu (limit aşımı oranında düşer) ve disiplin (temiz = 100)
bileşenlerinin ağırlıklı ortalaması; varsayılan ağırlıklar eşit (⅓ her biri). O gün girilmeyen bileşen hesaba katılmaz.

## Check-in kısayolları

- `Enter` sonraki adım (ekran süresi adımında sonraki kutu), `Shift+Enter` geri
- Rutinler: `1`–`9` tikle, `+`/`−` erteleme sayısı
- Disiplin: `E`/`H` sırayla "temiz miyim" ve "porno izledim mi" sorularını yanıtlar, `0`–`9` yeltenme sayısı
- Uyku: `7,5` ya da `7:30` yaz, Enter (ya da hazır saatlerden birine tıkla)
- Mood/enerji: önce mood (`1`–`9`, `0` = 10), sonra enerji (`1`–`5`), ör. `8` `3`

**Sabah check-in'i:** Ayarlar'daki gün sınırından (varsayılan 12:00) önce check-in açılırsa ve dün kapanmadıysa,
kayıt dünün tarihine yazılır. Ekranın üstünde bunu belirten bir bant görünür.

**Sıralama:** Uygulamalar, rutinler, günün işleri ve bekleyen işler tutup sürüklenerek sıralanır (dokunmatikte ~0,2 sn basılı tut).

## Eisenhower ve Günün Tuğlası

- İşler `important` + `urgent` ile çeyreğe ayrılır: Ç1 önemli+acil · **Ç2 önemli+acil değil** · Ç3 acil · Ç4 ikisi de değil.
  Eski kayıtlarda alan yoksa `false` kabul edilir (geçiş gerekmez).
- Günlük'teki heatmap yalnızca **tamamlanan önemli işlere (Ç1 + Ç2)** göre renklenir (0 boş · 1 açık · 2 orta · 3+ koyu); Ç3/Ç4 saymaz.
- **Günün Tuğlası:** günde bir Ç2 iş, başlangıç–bitiş saati zorunlu. Günün listesinin en üstünde ayrı kartta durur.
  İş Ç2 olmaktan çıkarsa, başka güne taşınırsa ya da bekleyenlere atılırsa tuğlalığı kalkar.

## Lisans

MIT
