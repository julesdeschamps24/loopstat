"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const POLL_INTERVAL_MS = 2000;

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

  // loading / running — animated indicator
  return (
    <p className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {state.kind === "running" && state.status === "processing"
        ? "Traitement en cours…"
        : "Import en attente de traitement…"}
    </p>
  );
}
