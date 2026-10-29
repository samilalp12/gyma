import { useEffect, useState } from 'react';
import { nowHHmm } from '../lib/date';

const NOTIFIED_KEY = 'gyma:notified';

/**
 * Hatırlatma saati geldiyse ve check-in yapılmadıysa true döner.
 * Sekme açıksa ve izin verildiyse bir kez tarayıcı bildirimi gösterir.
 */
export function useReminder(reminderTime: string, today: string, closed: boolean): boolean {
  const [now, setNow] = useState(nowHHmm);

  useEffect(() => {
    const t = setInterval(() => setNow(nowHHmm()), 20_000);
    return () => clearInterval(t);
  }, []);

  const due = !closed && now >= reminderTime;

  useEffect(() => {
    if (!due || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(NOTIFIED_KEY);
    } catch {
      /* yoksay */
    }
    if (last === today) return;
    try {
      const n = new Notification('gyma · Günü kapatma zamanı', {
        body: 'Bugünün check-in’i henüz yapılmadı. 5 dakikanı al.',
        icon: '/favicon.svg',
        tag: 'gyma-checkin',
      });
      n.onclick = () => {
        window.focus();
        window.location.href = '/checkin';
      };
      localStorage.setItem(NOTIFIED_KEY, today);
    } catch {
      /* bazı tarayıcılar sayfa içi Notification oluşturmayı desteklemez */
    }
  }, [due, today]);

  return due;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}
