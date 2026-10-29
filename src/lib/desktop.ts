/** Tauri masaüstü uygulaması içinde mi çalışıyoruz? */
export const isDesktopApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Ana pencereyi göster ve verilen sayfaya git (masaüstü); tarayıcıda yeni sekmede aç. */
export async function openMainWindow(path = '/') {
  if (!isDesktopApp) {
    window.open(path, '_blank');
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const { emitTo } = await import('@tauri-apps/api/event');
  const main = await WebviewWindow.getByLabel('main');
  await main?.unminimize();
  await main?.show();
  await main?.setFocus();
  await emitTo('main', 'gyma:navigate', path);
}

/** Ana pencerede: widget'tan gelen "şu sayfaya git" isteklerini dinler. */
export async function listenNavigate(go: (path: string) => void): Promise<() => void> {
  if (!isDesktopApp) return () => {};
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  return getCurrentWebviewWindow().listen<string>('gyma:navigate', (e) => go(e.payload));
}

/** Oturum açılışında başlatma (yalnızca masaüstü uygulaması) */
export async function getAutostart(): Promise<boolean> {
  if (!isDesktopApp) return false;
  const { isEnabled } = await import('@tauri-apps/plugin-autostart');
  return isEnabled();
}

export async function setAutostart(on: boolean) {
  if (!isDesktopApp) return;
  const { enable, disable } = await import('@tauri-apps/plugin-autostart');
  await (on ? enable() : disable());
}
