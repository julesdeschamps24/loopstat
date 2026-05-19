"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWelcomeModalState } from "./use-welcome-modal";

/**
 * Modal de bienvenue affichée une seule fois (per browser, localStorage flag)
 * au premier load après auth pour un user en mode démo. Présente l'app
 * + options Skip / Importer maintenant.
 *
 * Esc = Skip (équivalent au bouton).
 */
export function WelcomeModal() {
  const { isOpen, close } = useWelcomeModalState();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(7, 7, 16, 0.7)", backdropFilter: "blur(4px)" }}
      aria-modal="true"
      role="dialog"
      aria-label="Bienvenue sur loopstat"
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-8 text-center space-y-6"
        style={{
          background: "#1a0d2e",
          borderColor: "rgba(124, 58, 237, 0.3)",
          color: "#f4f0ff",
        }}
      >
        <h2 className="text-2xl font-semibold">Bienvenue sur loopstat 👋</h2>
        <p className="text-sm" style={{ color: "#a89ec8" }}>
          Cette démo te montre à quoi ressemble loopstat avec des données
          fictives. Importe ton historique Spotify pour voir TES vraies
          stats — tops, listening clock, partage de profils, et plus.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{
              background: "transparent",
              color: "#a89ec8",
              border: "1px solid rgba(168, 158, 200, 0.3)",
            }}
          >
            Skip et explorer la démo
          </button>
          <Link
            href="/import?from=welcome"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "#7c3aed", color: "#ffffff" }}
          >
            Importer maintenant →
          </Link>
        </div>
      </div>
    </div>
  );
}
