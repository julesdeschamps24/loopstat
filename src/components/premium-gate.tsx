"use client";

import Link from "next/link";
import { Crown } from "lucide-react";

export function PremiumGate({
  isPremium,
  children,
}: {
  isPremium: boolean;
  children: React.ReactNode;
}) {
  if (isPremium) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
        >
          <Crown className="size-4" /> Débloquer Premium
        </Link>
      </div>
    </div>
  );
}
