import { STREAM_PERIODS, type StreamPeriod } from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

/**
 * Grille 4 cards (4 sem / 6 mois / 1 an / All) affichant les nombres de
 * plays par fenêtre temporelle. Pattern de typographie : Instrument Serif
 * italique pour les chiffres, label uppercase tracking-wider en muted.
 */
export function PeriodBreakdownGrid({
  data,
}: {
  data: Record<StreamPeriod, number>;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STREAM_PERIODS.map(({ value, label }) => (
        <div key={value} className="rounded-xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
            {formatNumber(data[value])}
          </p>
        </div>
      ))}
    </div>
  );
}
