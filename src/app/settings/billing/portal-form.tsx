"use client";

import { useState } from "react";

export function OpenPortalButton({
  className,
  label = "Gérer mon abonnement →",
}: {
  className?: string;
  label?: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function open() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.assign(url);
      else setSubmitting(false);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={submitting}
      onClick={open}
      className={
        (className ?? "") +
        " inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
      }
    >
      {submitting ? "Redirection…" : label}
    </button>
  );
}
