import { BellRing, CalendarRange, LayoutDashboard, ListChecks, MoonStar, Settings, Shield, Smartphone, Timer } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useData } from '../hooks/useAppData';
import { useReminder } from '../hooks/useReminder';
import { checkinTarget } from '../lib/checkin';
import { screenOn } from '../lib/metrics';
import { cn } from './ui';

const NAV = [
  { to: '/', label: 'Özet', icon: LayoutDashboard, end: true },
  { to: '/checkin', label: 'Check-in', icon: MoonStar },
  { to: '/ekran', label: 'Ekran Süresi', short: 'Ekran', icon: Smartphone },
  { to: '/gunluk', label: 'Günlük', icon: ListChecks },
  { to: '/odak', label: 'Odak', icon: Timer },
  { to: '/disiplin', label: 'Disiplin', icon: Shield },
  { to: '/haftalik', label: 'Haftalık', icon: CalendarRange },
  { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

export function Layout() {
  const data = useData();
  const closed = data.days.get(data.today)?.closed ?? false;
  const showReminder = useReminder(data.settings.reminderTime, data.today, closed);
  const { pathname } = useLocation();
  const inCheckin = pathname.startsWith('/checkin');
  const checkinDate = checkinTarget(data);
  const yesterdayMissing = checkinDate !== data.today;
  const nav = NAV.filter((n) => n.to !== '/ekran' || screenOn(data));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen md:pl-16 lg:pl-52">
      {/* Masaüstü sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-line bg-bg md:flex lg:w-52">
        <Link to="/" className="flex h-16 items-center gap-2.5 px-5">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <span className="hidden text-[15px] font-semibold tracking-tight lg:inline">gyma</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm',
                  isActive ? 'bg-card text-fg' : 'text-muted hover:bg-card/60 hover:text-fg',
                )
              }
            >
              <Icon size={18} strokeWidth={1.8} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 pb-5 text-[11px] text-muted lg:block">Veriler yalnızca bu tarayıcıda.</div>
      </aside>

      {(showReminder || yesterdayMissing) && !inCheckin && (
        <div className="sticky top-0 z-20 border-b border-accent/30 bg-accent-soft backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6">
            <span className="flex items-center gap-2 text-fg">
              <BellRing size={16} className="text-accent" />
              {yesterdayMissing ? 'Dünün check-in’i yapılmadı.' : 'Günü kapatma zamanı — bugünün check-in’i henüz yapılmadı.'}
            </span>
            <Link to={`/checkin/${checkinDate}`} className="btn-primary py-1.5">
              Check-in yap
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      {/* Mobil tab bar */}
      <nav style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map(({ to, label, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2 text-[10px]', isActive ? 'text-accent' : 'text-muted')
            }
          >
            <Icon size={19} strokeWidth={1.8} />
            <span className="truncate">{short ?? label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
