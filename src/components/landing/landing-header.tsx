import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="flex w-full items-center justify-between px-8 py-6">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight"
        style={{ color: "#f4f0ff", letterSpacing: "-0.02em" }}
      >
        loopstat<span style={{ color: "#7c3aed" }}>.</span>
      </Link>
      <Link
        href="/pricing"
        className="text-sm transition hover:opacity-80"
        style={{ color: "#a89ec8" }}
      >
        Tarifs
      </Link>
    </header>
  );
}
