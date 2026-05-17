"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const POLL_INTERVAL_MS = 2000;

// Seuils de "ça bloque" différents selon le statut :
// - `pending` = pas encore pris en compte par le worker. BullMQ pick-up est
//   normalement < 5 s ; au-delà de 60 s on suspecte un worker down.
// - `processing` = worker bosse activement. Un gros import (150k+ rows) peut
//   prendre quelques minutes ; on n'alerte qu'au-delà de 5 min.
const PENDING_STALL_MS = 60 * 1000;
const PROCESSING_STALL_MS = 5 * 60 * 1000;
const STALL_TICK_MS = 5 * 1000;

type ImportStatus = "pending" | "processing" | "completed" | "failed";

type StatusResponse = {
  status: ImportStatus;
  filesCount: number;
  rowsImported: number;
  errorMessage: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "running"; status: "pending" | "processing" }
  | { kind: "completed"; rowsImported: number }
  | { kind: "failed"; errorMessage: string | null }
  | { kind: "unauthorized" }
  | { kind: "notfound" };

export function ImportProgress({ importId }: { importId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  // Mount time stands in for the import's server-side `started_at`: the
  // component mounts right after POST /api/import returns, so the gap is at
  // most a couple of seconds — well below the 5 min stall threshold. A `now`
  // state ticks every 30s so the banner appears as soon as the elapsed time
  // crosses STALL_THRESHOLD_MS, even if no poll response lands in that window.
  const [mountedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STALL_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/import/${importId}/status`);

        if (cancelled) return;

        // Definitive errors — stop polling, show a message.
        if (res.status === 401) {
          setState({ kind: "unauthorized" });
          return;
        }
        if (res.status === 404) {
          setState({ kind: "notfound" });
          return;
        }
        // Transient (5xx, network blips) — keep polling.
        if (!res.ok) {
          console.error("[import-progress] status poll failed", res.status);
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
          return;
        }

        const body = (await res.json()) as StatusResponse;
        if (cancelled) return;

        if (body.status === "completed") {
          setState({ kind: "completed", rowsImported: body.rowsImported });
          return;
        }
        if (body.status === "failed") {
          setState({ kind: "failed", errorMessage: body.errorMessage });
          return;
        }

        setState({ kind: "running", status: body.status });
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        // Network error — log and retry.
        console.error("[import-progress] status poll error", err);
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [importId]);

  if (state.kind === "completed") {
    return (
      <p className="flex items-center gap-2 font-medium text-primary">
        <CheckCircle2 className="size-4" />
        {formatNumber(state.rowsImported)} écoute
        {state.rowsImported > 1 ? "s" : ""} importée
        {state.rowsImported > 1 ? "s" : ""}
      </p>
    );
  }

  if (state.kind === "failed") {
    return (
      <p className="flex items-center gap-2 font-medium text-red-500">
        <AlertCircle className="size-4 shrink-0" />
        {state.errorMessage?.trim()
          ? state.errorMessage
          : "L'import a échoué. Réessaie dans un instant."}
      </p>
    );
  }

  if (state.kind === "unauthorized") {
    return (
      <p className="flex items-center gap-2 text-sm text-red-500">
        Session expirée, reconnecte-toi.{" "}
        <Link href="/login" className="font-medium underline">
          Se reconnecter
        </Link>
      </p>
    );
  }

  if (state.kind === "notfound") {
    return (
      <p className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="size-4 shrink-0" />
        Import introuvable.
      </p>
    );
  }

  // loading / running — animated indicator, plus a stalled banner when the
  // import has been pending/processing past its status-specific threshold.
  const elapsedMs = now - mountedAt;
  const stalledKind =
    state.kind === "running" && state.status === "pending" && elapsedMs > PENDING_STALL_MS
      ? "pending"
      : state.kind === "running" &&
          state.status === "processing" &&
          elapsedMs > PROCESSING_STALL_MS
        ? "processing"
        : null;

  return (
    <div className="flex flex-col gap-2">
      {stalledKind === "pending" ? (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
          Aucun worker ne semble disponible pour traiter ton import. Si tu es
          en dev, lance <code>pnpm worker</code> ; sinon réessaie dans
          quelques minutes.
        </div>
      ) : null}
      {stalledKind === "processing" ? (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
          Le worker traite ton import depuis plus de 5 minutes. Pour un gros
          historique c&apos;est normal, sinon il a peut-être crashé.
        </div>
      ) : null}
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {state.kind === "running" && state.status === "processing"
          ? "Traitement en cours…"
          : "Import en attente de traitement…"}
      </p>
    </div>
  );
}
