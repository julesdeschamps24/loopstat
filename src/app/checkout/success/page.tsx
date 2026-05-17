import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  return (
    <main
      id="main"
      className="flex-1 flex flex-col items-center justify-center px-6 py-24 max-w-xl mx-auto w-full text-center"
    >
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-semibold">Bienvenue dans Premium</h1>
      <p className="mt-4 text-base text-muted-foreground">
        Ton accès est en cours d&apos;activation. Le rendu peut prendre quelques
        secondes, le temps que Stripe nous informe.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
      >
        Retour au dashboard →
      </Link>
    </main>
  );
}
