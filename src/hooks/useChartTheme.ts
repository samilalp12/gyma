import { useData } from './useAppData';

/** Recharts SVG'leri için tema renkleri. */
export function useChartTheme() {
  const { settings } = useData();
  const light = settings.theme === 'light';
  return {
    grid: light ? '#E2E5EA' : '#262A33',
    axis: light ? '#646B77' : '#8B919C',
    text: light ? '#14171C' : '#E6E8EC',
    card: light ? '#FFFFFF' : '#181B22',
    accent: light ? '#16A34A' : '#4ADE80',
    danger: light ? '#E5484D' : '#F87171',
    muted: light ? '#9AA1AC' : '#5B616C',
    tooltip: {
      contentStyle: {
        background: light ? '#FFFFFF' : '#181B22',
        border: `1px solid ${light ? '#E2E5EA' : '#262A33'}`,
        borderRadius: 10,
        fontSize: 12,
        color: light ? '#14171C' : '#E6E8EC',
      },
      labelStyle: { color: light ? '#646B77' : '#8B919C', marginBottom: 4 },
      itemStyle: { padding: 0 },
      cursor: { fill: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' },
    },
  };
}
