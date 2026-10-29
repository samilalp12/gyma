import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { listenNavigate } from './lib/desktop';
import { Layout } from './components/Layout';
import { DataProvider } from './hooks/useAppData';
import { CheckinPage } from './pages/checkin/CheckinPage';
import { DisciplinePage } from './pages/DisciplinePage';
import { JournalPage } from './pages/JournalPage';
import { OverviewPage } from './pages/OverviewPage';
import { ScreenTimePage } from './pages/ScreenTimePage';
import { SettingsPage } from './pages/SettingsPage';
import { FocusPage } from './pages/FocusPage';
import { WeeklyPage } from './pages/WeeklyPage';
import { WidgetPage } from './pages/WidgetPage';

/** Masaüstü uygulamasındaki widget penceresi index.html?view=widget ile açılır */
const isWidgetWindow = new URLSearchParams(window.location.search).get('view') === 'widget';

/** Masaüstü: widget'tan gelen sayfa isteklerini router'a iletir */
function DesktopBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    let off = () => {};
    void listenNavigate((p) => navigate(p)).then((f) => (off = f));
    return () => off();
  }, [navigate]);
  return null;
}

export function App() {
  if (isWidgetWindow)
    return (
      <DataProvider>
        <WidgetPage />
      </DataProvider>
    );
  return (
    <DataProvider>
      <BrowserRouter>
        <DesktopBridge />
        <Routes>
          {/* Masaüstü widget'ı: menü/çerçeve yok */}
          <Route path="widget" element={<WidgetPage />} />
          <Route element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="checkin/:date" element={<CheckinPage />} />
            <Route path="ekran" element={<ScreenTimePage />} />
            <Route path="gunluk" element={<JournalPage />} />
            <Route path="odak" element={<FocusPage />} />
            <Route path="disiplin" element={<DisciplinePage />} />
            <Route path="haftalik" element={<WeeklyPage />} />
            <Route path="ayarlar" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
