import { formatNumber } from "@/lib/utils";

type MonthlyPoint = { month: Date; plays: number };

const MONTH_LABELS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function formatMonth(d: Date): string {
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Dense series from the first non-zero month to "now" — fills empty months
 * with 0. Without this a track played in 2019 and 2025 would look like two
 * adjacent bars instead of two bars years apart.
 */
function fillGaps(points: MonthlyPoint[]): MonthlyPoint[] {
  if (points.length === 0) return [];
  const byKey = new Map(points.map((p) => [monthKey(p.month), p.plays]));

  const first = new Date(
    Date.UTC(points[0].month.getUTCFullYear(), points[0].month.getUTCMonth(), 1),
  );
  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const dense: MonthlyPoint[] = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const key = monthKey(cursor);
    dense.push({ month: new Date(cursor), plays: byKey.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dense;
}

/**
 * Monthly play sparkline rendered as flex-bar columns with native title
 * tooltips. No chart dep — pure CSS. Empty-month gaps are filled so the
 * time axis is linear.
 */
export function SparklineMonthly({ data }: { data: MonthlyPoint[] }) {
  const dense = fillGaps(data);
  if (dense.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas assez de données pour tracer une évolution.
      </p>
    );
  }

  const max = Math.max(...dense.map((p) => p.plays), 1);
  const peak = dense.reduce((a, b) => (b.plays > a.plays ? b : a));
  const total = dense.reduce((acc, p) => acc + p.plays, 0);

  // Label only first / peak / last to avoid axis clutter on long ranges.
  const firstIdx = 0;
  const lastIdx = dense.length - 1;
  const peakIdx = dense.findIndex((p) => p === peak);

  return (
    <div className="space-y-2">
      <div className="flex h-20 items-end gap-px">
        {dense.map((p, i) => {
          const ratio = p.plays / max;
          const isPeak = i === peakIdx && p.plays > 0;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[#7c3aed] transition"
              style={{
                height: `${Math.max(ratio * 100, p.plays > 0 ? 4 : 2)}%`,
                opacity: p.plays > 0 ? (isPeak ? 1 : 0.55 + ratio * 0.4) : 0.1,
              }}
              title={`${formatMonth(p.month)} — ${formatNumber(p.plays)} écoute${p.plays > 1 ? "s" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatMonth(dense[firstIdx].month)}</span>
        {peakIdx !== firstIdx && peakIdx !== lastIdx ? (
          <span>
            pic : {formatMonth(peak.month)} ({formatNumber(peak.plays)})
          </span>
        ) : null}
        <span>{formatMonth(dense[lastIdx].month)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatNumber(total)} écoutes sur {dense.length} mois
      </p>
    </div>
  );
}
