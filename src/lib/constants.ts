import type { DayPart } from '../db/types';

export const TIME_SLOTS = [
  { key: 'sabah', label: 'Sabah', range: '06–12' },
  { key: 'ogle', label: 'Öğleden sonra', range: '12–17' },
  { key: 'aksam', label: 'Akşam', range: '17–21' },
  { key: 'gece', label: 'Gece', range: '21–00' },
  { key: 'geceyarisi', label: 'Gece yarısı', range: '00–03' },
  { key: 'sabaha-karsi', label: 'Sabaha karşı', range: '03–06' },
] as const;

export const PLACES = ['Yatakta', 'Evde yalnız', 'Bilgisayar başında', 'Telefonda', 'Dışarıda', 'Sosyal ortam'];

export const CAUSES = ['Sıkılma', 'Stres', 'Yalnızlık', 'Yorgunluk', 'Uykusuzluk', 'Sosyal medya', 'Kaygı', 'Erteleme'];

/** Mood 1–10 ölçeği */
export const MOOD_MAX = 10;

const MOOD_FACES = ['😫', '😞', '🙁', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

/** 1–10 mood değeri (ortalama da olabilir) için emoji */
export function moodEmoji(v: number | null | undefined): string {
  if (v == null) return '';
  return MOOD_FACES[Math.min(9, Math.max(0, Math.round(v) - 1))];
}

export function moodLabel(v: number): string {
  if (v <= 2) return 'Çok kötü';
  if (v <= 4) return 'Kötü';
  if (v <= 6) return 'Normal';
  if (v <= 8) return 'İyi';
  return 'Harika';
}

export const ENERGY_LABELS = ['Bitkin', 'Düşük', 'Orta', 'Yüksek', 'Çok yüksek'];

export function slotLabel(key?: string) {
  const s = TIME_SLOTS.find((x) => x.key === key);
  return s ? `${s.label} (${s.range})` : '';
}

const ALL = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5];

export const DAY_PARTS: { key: DayPart; label: string }[] = [
  { key: 'sabah', label: 'Sabah' },
  { key: 'gun', label: 'Gün içi' },
  { key: 'aksam', label: 'Akşam' },
];

export const partOrder = (p?: DayPart) => (p === 'sabah' ? 0 : p === 'aksam' ? 2 : 1);

export interface RoutineSuggestion {
  title: string;
  weekdays: number[];
  part: DayPart;
  measure?: 'kg';
}

/** Uyanınca telefona uzanmadan önce yapılacak sabah zinciri (sırası önemli) */
export const MORNING_PACK: RoutineSuggestion[] = [
  { title: 'Kişisel bakım (yüz, diş, cilt)', weekdays: ALL, part: 'sabah' },
  { title: 'Bir bardak su + vitaminler', weekdays: ALL, part: 'sabah' },
  { title: '10–15 dk esneme / yoga', weekdays: ALL, part: 'sabah' },
  { title: 'Deftere günün 3 işi + 1 iyi cümle', weekdays: ALL, part: 'sabah' },
];

/** Ayarlar ve Günlük sayfasında tek tıkla eklenebilen rutin önerileri */
export const ROUTINE_SUGGESTIONS: RoutineSuggestion[] = [
  ...MORNING_PACK,
  { title: 'Kilo ölç', weekdays: [1], part: 'sabah', measure: 'kg' },
  { title: 'Uyanınca ilk 30 dk telefonsuz', weekdays: ALL, part: 'sabah' },
  { title: '30 dk yürüyüş / spor', weekdays: ALL, part: 'gun' },
  { title: '2 litre su', weekdays: ALL, part: 'gun' },
  { title: '90 dk derin çalışma (telefon başka odada)', weekdays: WEEKDAYS, part: 'gun' },
  { title: '20 sayfa kitap', weekdays: ALL, part: 'aksam' },
  { title: 'Yatmadan 1 saat önce ekranı bırak', weekdays: ALL, part: 'aksam' },
  { title: 'Telefonu yatak odası dışında şarja tak', weekdays: ALL, part: 'aksam' },
  { title: '00:00’dan önce yatakta ol', weekdays: ALL, part: 'aksam' },
  { title: 'Masayı / odayı topla', weekdays: ALL, part: 'aksam' },
  { title: 'Haftalık planlama', weekdays: [7], part: 'aksam' },
];
