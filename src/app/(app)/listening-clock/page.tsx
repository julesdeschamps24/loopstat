import { redirect } from "next/navigation";
import { Clock } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/stats/empty-state";
import { getListeningClock, getListeningTotals } from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";
import { hasCompletedImport } from "@/db/queries/imports";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_LISTENING_HOURS } from "@/lib/demo/data";

// The hourly distribution shifts slowly — re-derive it at most once an hour.
export const revalidate = 3600;

const LOW_DATA_THRESHOLD = 20;

export default async function ListeningClockPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const hasImport = await hasCompletedImport(userId);

  if (!hasImport) {
    const demoMax = Math.max(...DEMO_LISTENING_HOURS.map((c) => c.count), 1);
    return (
      <>
        <DemoModeBanner />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <header className="mb-8">
            <h1 className="text-2xl font-semibold">Horloge d&apos;écoute</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ces données sont fictives — importe ton historique pour voir les tiennes.
            </p>
          </header>
          <section className="rounded-2xl border bg-card p-6">
            <div className="grid grid-cols-12 gap-2 sm:grid-cols-24">
              {DEMO_LISTENING_HOURS.map(({ hour, count }) => {
                const intensity = count / demoMax;
                return (
                  <div
                    key={hour}
                    className="flex flex-col items-center gap-1"
                    title={`${hour}h — ${formatNumber(count)} écoute${count > 1 ? "s" : ""}`}
                  >
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-md bg-primary"
                        style={{
                          height: `${Math.max(intensity * 100, count > 0 ? 6 : 2)}%`,
                          opacity: count > 0 ? 0.25 + intensity * 0.75 : 0.15,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </>
    );
  }

  const [clock, totals] = await Promise.all([
    getListeningClock(userId),
    getListeningTotals(userId),
  ]);

  const totalStreams = totals.find((t) => t.window === "lifetime")?.count ?? 0;
  const maxCount = Math.max(...clock.map((c) => c.count), 1);

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Horloge d&apos;écoute</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Répartition de tes écoutes selon l&apos;heure de la journée.
        </p>
      </header>

      {totalStreams === 0 ? (
        <EmptyState
          title="Pas encore d'écoutes"
          description="Ta répartition horaire apparaîtra ici une fois ton historique importé."
          icon={Clock}
        />
      ) : (
        <section className="rounded-2xl border bg-card p-6">
          {totalStreams < LOW_DATA_THRESHOLD ? (
            <p className="mb-6 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Données limitées — la heatmap se précisera avec le temps.
            </p>
          ) : null}

          <div className="grid grid-cols-12 gap-2 sm:grid-cols-24">
            {clock.map(({ hour, count }) => {
              const intensity = count / maxCount;
              return (
                <div
                  key={hour}
                  className="flex flex-col items-center gap-1"
                  title={`${hour}h — ${formatNumber(count)} écoute${count > 1 ? "s" : ""}`}
                >
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-md bg-primary"
                      style={{
                        height: `${Math.max(intensity * 100, count > 0 ? 6 : 2)}%`,
                        opacity: count > 0 ? 0.25 + intensity * 0.75 : 0.15,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {hour}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            {formatNumber(totalStreams)} écoute{totalStreams > 1 ? "s" : ""} au
            total · heures en fuseau du serveur.
          </p>
        </section>
      )}
    </main>
  );
}
