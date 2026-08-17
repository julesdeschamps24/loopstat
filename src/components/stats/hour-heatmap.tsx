import { formatNumber } from "@/lib/utils";

export type HourHeatmapData = { hour: number; count: number }[];

/**
 * Heatmap 24 barres verticales. La hauteur de chaque barre est proportionnelle
 * au max de la série ; l'opacité aussi (les heures jamais écoutées sont presque
 * invisibles). Layout : 12 colonnes sur mobile, 24 sur desktop.
 */
export function HourHeatmap({ data }: { data: HourHeatmapData }) {
  const maxHour = Math.max(...data.map((h) => h.count), 1);

  return (
    <div className="mt-4 grid grid-cols-12 gap-1 sm:grid-cols-24">
      {data.map(({ hour, count }) => {
        const intensity = count / maxHour;
        return (
          <div
            key={hour}
            className="flex flex-col items-center gap-1"
            title={`${hour}h - ${formatNumber(count)} écoute${count > 1 ? "s" : ""}`}
          >
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-md bg-[#7c3aed]"
                style={{
                  height: `${Math.max(intensity * 100, count > 0 ? 6 : 2)}%`,
                  opacity: count > 0 ? 0.3 + intensity * 0.7 : 0.12,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}
