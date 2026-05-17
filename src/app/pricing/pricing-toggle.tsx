"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown } from "lucide-react";

type Tier = "monthly" | "yearly";

export function PricingToggle({
  isAuthenticated,
  isPremium,
}: {
  isAuthenticated: boolean;
  isPremium: boolean;
}) {
  const [tier, setTier] = useState<Tier>("yearly");
  const [submitting, setSubmitting] = useState(false);
  const price = tier === "yearly" ? "20€/an" : "3€/mois";
  const subtitle =
    tier === "yearly"
      ? "Soit 1,67€/mois facturé annuellement"
      : "Sans engagement, annule à tout moment";

  async function startCheckout() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceTier: tier }),
      });
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.assign(url);
      else setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="inline-flex rounded-full border bg-card p-1">
        {(["monthly", "yearly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            className={
              t === tier
                ? "rounded-full bg-[#7c3aed] px-5 py-2 text-sm font-medium text-white"
                : "rounded-full px-5 py-2 text-sm text-muted-foreground"
            }
          >
            {t === "monthly" ? "Mensuel" : "Annuel "}
            {t === "yearly" ? (
              <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                -45%
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-[0_30px_80px_rgba(124,58,237,0.15)]">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h3 className="text-lg font-medium">Premium</h3>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="text-3xl font-semibold">{price}</div>
        </div>

        <ul className="space-y-3 text-sm">
          {[
            "Cartes share sans watermark",
            "Profil customisé (background + couleur d'accent)",
            "Top illimité 4 sem / 6 mois / 1 an / tout",
            "Profil public partageable",
            "Annule à tout moment",
          ].map((f) => (
            <li key={f} className="flex gap-3">
              <Check className="size-4 shrink-0 text-emerald-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {isPremium ? (
            <Link
              href="/settings/billing"
              className="block w-full rounded-full bg-[#7c3aed] px-5 py-3 text-center text-sm font-medium text-white"
            >
              <Crown className="mr-2 inline size-4" />
              Tu es Premium · Gérer mon abo
            </Link>
          ) : isAuthenticated ? (
            <button
              type="button"
              disabled={submitting}
              onClick={startCheckout}
              className="block w-full rounded-full bg-[#7c3aed] px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
            >
              {submitting ? "Redirection…" : "Essayer 14 jours gratuit"}
            </button>
          ) : (
            <Link
              href="/login?next=/pricing"
              className="block w-full rounded-full bg-[#7c3aed] px-5 py-3 text-center text-sm font-medium text-white"
            >
              Se connecter pour essayer →
            </Link>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Apple Pay accepté. Sans engagement.
        </p>
      </div>
    </div>
  );
}
