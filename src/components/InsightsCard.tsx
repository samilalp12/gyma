import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useData } from '../hooks/useAppData';
import { computeInsights, formatInsightValue, type Insight, insightTone } from '../lib/insights';
import { cn } from './ui';

/** "Seni ne etkiliyor?" — verilerden otomatik çıkan en güçlü ilişkiler. */
export function InsightsCard({ limit = 4, compact = false }: { limit?: number; compact?: boolean }) {
  const data = useData();
  const { insights, daysWithData } = useMemo(() => computeInsights(data), [data]);
  const shown = insights.slice(0, limit);

  if (compact && shown.length === 0) return null;

  return (
    <section className="mb-5 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-[#c98500]" /> Seni ne etkiliyor?
        </h2>
        <span className="text-xs text-muted">son 90 gün · {daysWithData} günlük veri</span>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
          Henüz yeterli veri yok. Her gruptan en az 4 gün birikince (genelde 2–3 hafta) uyku, ekran süresi, sabah rutini, odak ve
          disiplin arasındaki ilişkiler burada belirecek.
        </p>
      ) : (
        <ul className={cn('grid gap-3', !compact && 'md:grid-cols-2')}>
          {shown.map((i) => (
            <InsightRow key={i.id} i={i} />
          ))}
        </ul>
      )}
      {!compact && shown.length > 0 && <p className="mt-3 text-xs text-muted">Bunlar ilişki gösterir, kesin neden değildir. Ama hangi alışkanlığın neyi taşıdığına dair iyi bir ipucu.</p>}
    </section>
  );
}

function InsightRow({ i }: { i: Insight }) {
  const tone = insightTone(i);
  const max = Math.max(i.a, i.b, i.unit === 'pct' ? 1 : 0.1);
  const Icon = (i.a > i.b) ? TrendingUp : TrendingDown;
  return (
    <li className={cn('rounded-xl border p-3', tone === 'good' ? 'border-accent/30 bg-accent-soft' : 'border-danger/30 bg-danger-soft')}>
      <div className="mb-2 flex items-start gap-2 text-sm">
        <Icon size={16} className={cn('mt-0.5 shrink-0', tone === 'good' ? 'text-accent' : 'text-danger')} />
        <span>
          {i.aLabel} <b>{i.metric}</b> {i.unit === 'pct' ? '' : 'ortalaman '}
          <b className="tabular-nums">{formatInsightValue(i, i.a)}</b>; {i.bLabel} <b className="tabular-nums">{formatInsightValue(i, i.b)}</b>.
        </span>
      </div>
      <div className="space-y-1 pl-6">
        {[
          { v: i.a, n: i.aN, main: true },
          { v: i.b, n: i.bN, main: false },
        ].map((x, k) => (
          <div key={k} className="flex items-center gap-2 text-[11px] text-muted">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2">
              <div
                className={cn('h-full rounded-full', x.main ? (tone === 'good' ? 'bg-accent' : 'bg-danger') : 'bg-muted')}
                style={{ width: `${(x.v / max) * 100}%` }}
              />
            </div>
            <span className="w-10 tabular-nums">{x.n} gün</span>
          </div>
        ))}
      </div>
    </li>
  );
}
