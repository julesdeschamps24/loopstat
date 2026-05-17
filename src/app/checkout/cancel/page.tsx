import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CheckoutCancelPage() {
  return (
    <main
      id="main"
      className="flex-1 flex flex-col items-center justify-center px-6 py-24 max-w-xl mx-auto w-full text-center"
    >
      <h1 className="text-3xl font-semibold">Paiement annulé</h1>
      <p className="mt-4 text-base text-muted-foreground">
        Pas de souci, tu peux réessayer quand tu veux. Aucune CB n&apos;a été
        chargée.
      </p>
      <Link
        href="/pricing"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
      >
        Voir les offres →
      </Link>
    </main>
  );
}
