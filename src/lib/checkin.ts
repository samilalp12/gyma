import { addDaysISO, nowHHmm } from './date';
import type { AppData } from './metrics';

/**
 * Check-in hangi güne yapılmalı?
 * Sabah `lateCheckinUntil` saatinden önce ve dün kapanmadıysa → dün; aksi halde bugün.
 * (Akşam unutulup sabaha kalan check-in yanlışlıkla yeni güne yazılmasın.)
 */
export function checkinTarget(data: AppData, now = new Date()): string {
  const yesterday = addDaysISO(data.today, -1);
  const morning = nowHHmm(now) < data.settings.lateCheckinUntil;
  if (morning && !data.days.get(yesterday)?.closed && !data.days.get(data.today)?.closed) return yesterday;
  return data.today;
}
