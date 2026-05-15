"use client";

import { useState } from "react";

const CONFIRMATION_PHRASE = "SUPPRIMER";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = typed === CONFIRMATION_PHRASE;

  async function handleDelete() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          body.error
            ? `La suppression a échoué (${body.error}).`
            : "La suppression a échoué. Réessaie dans un instant.",
        );
        setLoading(false);
        return;
      }
      // Session cookie cleared server-side; bounce to the landing page.
      window.location.replace("/");
    } catch (err) {
      console.error("[delete-account] request failed", err);
      setError("Impossible de joindre le serveur. Réessaie dans un instant.");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
        >
          Supprimer mon compte
        </button>
        <p className="text-xs text-muted-foreground">
          Tes écoutes, imports et jetons Spotify seront effacés. Le catalogue
          partagé (titres, artistes, albums) reste intact pour les autres
          utilisateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-500">
          Cette action est définitive.
        </p>
        <p className="text-xs text-muted-foreground">
          Tape «&nbsp;SUPPRIMER&nbsp;» pour confirmer la suppression de ton
          compte.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">
        <span className="sr-only">
          Tape «&nbsp;SUPPRIMER&nbsp;» pour confirmer
        </span>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          aria-required="true"
          aria-label="Tape SUPPRIMER pour confirmer"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          placeholder="SUPPRIMER"
          className="rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="text-xs text-red-500"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canConfirm || loading}
          className="rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Suppression…" : "Confirmer la suppression"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped("");
            setError(null);
          }}
          disabled={loading}
          className="rounded-full border px-4 py-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
