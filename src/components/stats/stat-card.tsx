/**
 * A label + big number card. Pure presentational — value is pre-formatted
 * by the caller.
 */
export type StatCardProps = {
  /** Short caption above the number. */
  label: string;
  /** The headline value (pre-formatted string or raw number). */
  value: string | number;
  /** Optional secondary line below the value, e.g. "320 minutes". */
  sublabel?: string;
};

export function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {sublabel ? (
        <p className="mt-1 text-sm text-muted-foreground">{sublabel}</p>
      ) : null}
    </div>
  );
}
