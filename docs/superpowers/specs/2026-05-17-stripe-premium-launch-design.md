# Stripe Premium Launch - Design Spec

**Date** : 2026-05-17
**Branche d'implémentation cible** : `feat/stripe-premium` (depuis `main`)

## Context

Phase A "viral first" + profile discoverability sont livrés sur `main`. Le produit a un funnel viral (cartes partageables, profils publics, search interne) mais **aucun monétisation active** : 100% des features sont gratuites. Le plan de monétisation (`~/.claude/plans/j-aimerai-monetiser-ce-projet-smooth-sloth.md`) prévoyait Phase C avec un tier Premium freemium.

Ce spec implémente la **Phase C - partie paiement** : infrastructure Stripe complète (pricing page + checkout + webhook + Customer Portal + helper `isPremium`) **plus 2 features Premium minimum viables** pour que la pricing page ait quelque chose à vendre au launch (no-watermark cartes + profil customisé).

L'offre promotionnelle de lancement = **free trial 14 jours avec CB collectée** (standard SaaS, conversion ~50%, churn maîtrisé).

## Périmètre

### Dans le MVP

**Infrastructure paiement**
1. Setup Stripe (compte test+live, Product "loopstat Premium" + 2 Prices, Webhook endpoint, Stripe Tax activé, Customer Portal config)
2. Migration DB : 4 colonnes Stripe sur `users`
3. Helper `isPremium(userId)` cached
4. `POST /api/checkout` (create Checkout Session avec trial 14j)
5. `POST /api/stripe/webhook` (verify signature + sync DB)
6. `POST /api/portal` (create Customer Portal Session)
7. `GET /pricing` page publique (marketing + CTA)
8. `GET /checkout/success` + `GET /checkout/cancel` landings
9. `GET /settings/billing` page (3 états : actif / trial / pas abonné)
10. Lien sidebar "Premium" (état dynamique)

**Features Premium au launch**
11. No-watermark sur cartes téléchargeables `/api/share-card` ET sur OG image `/u/[username]/opengraph-image` - gating sur **le propriétaire du profil** (pas le visiteur)
12. Profil customisé : background (4 presets : mesh / wall / noir / mauve) + accent color (6 swatches), édité dans `/settings`, rendu sur `/u/<username>`

### Hors MVP (issues GH ouvertes après merge)

- Page upgrade-prompts contextuelles (modal "cette feature est Premium")
- Multi-currency (USD/GBP) - €/EUR only au launch
- Cadeau d'abonnement (gift)
- Promo étudiants/spéciales hors trial 14j
- Referral / parrainage
- Plusieurs tiers (Basic/Pro)
- Annual savings calculator interactif
- Page `/pricing` avec testimonials (pas crédible avec 1 user au launch)

### Décisions verrouillées

- **Provider** : Stripe direct (1.4% + 0.25€ EU). Pas merchant of record → TVA EU à gérer côté Jules (Stripe Tax aide pour le calcul, la déclaration reste manuelle).
- **Statut juridique** : à clarifier hors spec. Stripe Tax activé pour ne pas être pris au dépourvu.
- **Pricing** : 3€/mois OU 20€/an (annuel = -45%). Pas de tier Basic/Pro au MVP.
- **Trial** : 14 jours avec CB collectée. Auto-conversion à J+14. Stripe envoie email rappel J-3 (built-in).
- **Mode checkout** : Stripe Checkout hosted (redirect vers checkout.stripe.com). Apple Pay support automatique, ZERO setup côté code.
- **Customer Portal** : Stripe-hosted, pour annuler / switcher mensuel↔annuel / update CB / voir factures.
- **Downgrade UX** : si user passe non-Premium, on garde son `profile_settings` en DB (visiteurs voient toujours le custom) mais on désactive l'édition dans `/settings`. Pas de reset brutal.
- **Watermark gating** : `isPremium(profile.id)` (propriétaire), pas `isPremium(session.user.id)` (visiteur). Sinon le incentive Premium pour celui qui partage est cassé.

## Section 1 - Business model

- **Tier unique : Premium**. Pas de Basic/Pro/Enterprise.
- **2 prix** : 3€/mois (mensuel recurring) ou 20€/an (annuel recurring, -45%).
- **Free trial 14 jours**, CB collectée au signup, auto-conversion à J+14 sauf annulation.
- **TVA** : Stripe Tax activé (+0.5%) calcule la taxe selon le pays du buyer. Déclaration / remise côté Jules.
- **Annulation 1-click** via Stripe Customer Portal. Reste Premium jusqu'à `current_period_end`.

## Section 2 - DB & state

### Migration

`drizzle/0003_<name>.sql` :

```sql
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text UNIQUE;
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "users" ADD COLUMN "premium_status" text;
ALTER TABLE "users" ADD COLUMN "premium_until" timestamptz;
```

- `stripe_customer_id` : créé au 1er checkout, persisté pour les renouvellements / portal sessions. UNIQUE.
- `stripe_subscription_id` : mis à jour à chaque event `customer.subscription.{created,updated}`.
- `premium_status` : `"trialing" | "active" | "past_due" | "canceled" | null` - source = Stripe webhook events.
- `premium_until` : timestamp d'expiration du droit Premium. Sur trial = `trial_end`, sur active = `current_period_end`. Permet à `isPremium` de répondre sans round-trip Stripe.

### Type Drizzle (`src/db/schema.ts`)

Ajouter à `users` :
```ts
stripeCustomerId: text("stripe_customer_id").unique(),
stripeSubscriptionId: text("stripe_subscription_id"),
premiumStatus: text("premium_status"),
premiumUntil: timestamp("premium_until", { withTimezone: true }),
```

### `profile_settings` (déjà jsonb) - extension

Pas de migration. Le type local s'étend :

```ts
export type ProfileSettings = {
  background?: "mesh" | "wall" | "noir" | "mauve";
  accent?: "violet" | "blue" | "rose" | "green" | "orange" | "mono";
};
```

### Helper `isPremium`

Nouveau fichier `src/db/queries/billing.ts` :

```ts
import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

export const isPremium = cache(async (userId: string): Promise<boolean> => {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { premiumStatus: true, premiumUntil: true },
  });
  if (!row?.premiumUntil) return false;
  if (row.premiumUntil <= new Date()) return false;
  return row.premiumStatus === "trialing" || row.premiumStatus === "active";
});

export type BillingState =
  | { tier: "free" }
  | { tier: "trial"; trialEndsAt: Date }
  | { tier: "active"; renewsAt: Date; cancelAtPeriodEnd: boolean }
  | { tier: "past_due"; expiresAt: Date }
  | { tier: "canceled"; expiresAt: Date };

export const getBillingState = cache(
  async (userId: string): Promise<BillingState> => {
    /* read user row, map premiumStatus + premiumUntil + Stripe data to BillingState */
  },
);

export async function updateBillingFromWebhook(
  customerId: string,
  patch: { subscriptionId?: string; status?: string; periodEnd?: Date },
): Promise<void> {
  /* write to users where stripeCustomerId = customerId */
}
```

(Squelette - implémentations détaillées en plan d'implémentation.)

## Section 3 - Stripe Dashboard setup (hors code)

À faire avant le 1er run :

1. Activer mode test Stripe (Dashboard → toggle).
2. Créer 1 Product "loopstat Premium".
3. Créer 2 Prices liés :
   - 3€/mois recurring (note l'id `price_test_xxx`)
   - 20€/an recurring (note l'id `price_test_yyy`)
4. **Stripe Tax** : Settings → Tax → activer + définir l'origine France.
5. **Customer Portal** : Settings → Billing → Customer Portal → activer + permettre :
   - cancel subscription
   - switch plans (between monthly/yearly)
   - update payment method
   - view invoices/history
6. **Webhook endpoint** : Developers → Webhooks → Add endpoint :
   - URL : `https://loopstat.tech/api/stripe/webhook` (en prod) ou `http://127.0.0.1:3000/api/stripe/webhook` (en local via `stripe listen --forward-to ...`)
   - Events à écouter :
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Récupérer le `whsec_...` → `STRIPE_WEBHOOK_SECRET`

### Variables d'env

À ajouter dans `.env.local` (dev) et secrets Hetzner (prod) :

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
```

(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` pas nécessaire avec Hosted Checkout, mais on peut l'ajouter maintenant pour préparer le terrain si on switche en Payment Element plus tard.)

### Dépendance npm

`pnpm add stripe` (le package officiel, server-side only).

## Section 4 - Pages

### `/pricing` (server, public)

Pas d'auth requis pour voir. CTA déclenche checkout (qui demande auth).

Layout :
- **Hero** : "Soutiens loopstat, débloque les bonus" + sous-titre
- **Toggle Mensuel ↔ Annuel** (annuel default, badge violet "-45% · 2 mois offerts")
- **Card pricing** (1 seul card visible, change selon toggle) :
  - Header : "Premium" + prix grand (3€/mois ou 20€/an)
  - Bullet list features :
    - ✓ Cartes share **sans watermark**
    - ✓ **Profil customisé** (background + couleur d'accent)
    - ✓ Top illimité 4w/6m/1y/all (déjà gratuit, rappelé)
    - ✓ Profil public partageable (déjà gratuit, rappelé)
    - ✓ Annule à tout moment
  - CTA :
    - Pas auth → `[Se connecter pour essayer →]` (link `/login?next=/pricing`)
    - Auth + free → `[Essayer 14 jours gratuit]` (POST `/api/checkout`)
    - Auth + premium → `[Tu es Premium · Gérer mon abo →]` (link `/settings/billing`)
  - Mention sous CTA : "Annule en 1 click. Apple Pay accepté. Sans engagement."
- **FAQ** (3 items) :
  - "Comment annuler ?" : "En 1 click dans tes réglages. Pas de questions."
  - "Quand suis-je charged ?" : "À la fin de tes 14 jours d'essai. Rappel email J-3."
  - "Apple Pay ?" : "Oui, accepté via Stripe Checkout. Aussi CB classique, Google Pay, prélèvement SEPA."

Files : `src/app/pricing/page.tsx` (server, fetch session + isPremium + state) + `src/app/pricing/pricing-toggle.tsx` (client, gère le toggle + POST checkout).

### `/checkout/success` (server, public, query `session_id`)

```tsx
export default async function Page({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  // Optional: vérifier que la session existe et payment_status === 'paid' OR setup pour trial
  // Mais pas critique : le vrai état Premium est synchronisé via webhook
  return (
    <main>
      <h1>🎉 Bienvenue dans Premium</h1>
      <p>Ton accès est en cours d'activation. Profite-en !</p>
      <Link href="/dashboard">Retour au dashboard</Link>
    </main>
  );
}
```

### `/checkout/cancel` (server, public)

```tsx
<main>
  <h1>Paiement annulé</h1>
  <p>Pas de souci, tu peux réessayer quand tu veux.</p>
  <Link href="/pricing">Voir les offres →</Link>
</main>
```

### `/settings/billing` (server, auth requise)

3 états affichés selon `getBillingState(userId)` :

- **`tier=active`** : "Plan Premium · annuel · renouvelle le 17 mai 2027 · [Gérer mon abonnement →]" (POST `/api/portal`)
- **`tier=trial`** : "Essai gratuit · expire le 31 mai 2026 (J-X) · [Gérer mon abonnement →]" + "Annule à tout moment, sans frais."
- **`tier=past_due`** : alerte rouge "Paiement échoué. Mets à jour ta CB. [Régler →]" + portal link
- **`tier=canceled`** : "Abonnement annulé · accès jusqu'au 31 mai 2026 · [Réactiver →]"
- **`tier=free`** : "Tu n'es pas Premium · [Découvrir Premium →]" link `/pricing`

Files : `src/app/settings/billing/page.tsx` (server) + `src/app/settings/billing/portal-form.tsx` (client, POST `/api/portal` puis redirect).

## Section 5 - Routes API

### `POST /api/checkout`

`src/app/api/checkout/route.ts`. Auth requise.

```ts
import { auth } from "@/auth";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
  }

  const { priceTier } = (await req.json()) as { priceTier: "monthly" | "yearly" };
  const priceId =
    priceTier === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY!
      : process.env.STRIPE_PRICE_ID_MONTHLY!;

  const customer = await getOrCreateStripeCustomer(session.user.id);
  const origin = new URL(req.url).origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId: session.user.id },
    },
    automatic_tax: { enabled: true },
    customer_update: { name: "auto", address: "auto" }, // required for automatic_tax
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
  });

  return Response.json({ url: checkoutSession.url });
}
```

### `POST /api/stripe/webhook`

`src/app/api/stripe/webhook/route.ts`. **Public** (Stripe l'appelle). Vérifie la signature.

```ts
import { stripe } from "@/lib/stripe";
import { updateBillingFromWebhook } from "@/db/queries/billing";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text(); // raw body required for signature verify

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      await updateBillingFromWebhook(sub.customer as string, {
        subscriptionId: sub.id,
        status: sub.status, // trialing | active | past_due | canceled | ...
        periodEnd: new Date(
          (sub.trial_end ?? sub.current_period_end) * 1000,
        ),
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await updateBillingFromWebhook(sub.customer as string, {
        status: "canceled",
        periodEnd: new Date(sub.current_period_end * 1000),
      });
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object;
      await updateBillingFromWebhook(inv.customer as string, {
        status: "past_due",
      });
      break;
    }
    case "checkout.session.completed":
    case "invoice.paid":
      // Idempotent no-op : la subscription.updated qui suit fait le vrai sync
      break;
  }

  return new Response("ok", { status: 200 });
}
```

**Note Next 16 raw body** : `req.text()` puis verify suffit. Pas besoin de désactiver le body parser comme en Pages Router.

### `POST /api/portal`

`src/app/api/portal/route.ts`. Auth requise.

```ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) {
    return new Response(JSON.stringify({ error: "no_customer" }), { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/settings/billing`,
  });

  return Response.json({ url: portalSession.url });
}
```

## Section 6 - Premium features

### A. No-watermark sur cartes share

**Mécanique** :

1. `src/app/api/share-card/route.tsx` :
   - Après `getPublicProfileByUsername`, ajouter `const profileIsPremium = await isPremium(profile.id);`
   - Passer `hideWatermark: profileIsPremium` aux templates dans `props`
2. `src/app/api/share-card/templates/shared.tsx` :
   - `<Watermark>` accepte prop optionnelle `hidden?: boolean` → si true, return null
3. Les 3 templates (`twitter.tsx`, `post.tsx`, `story.tsx`) :
   - Reçoivent `hideWatermark` dans props, propagent `<Watermark hidden={hideWatermark} ... />`
4. `src/app/u/[username]/opengraph-image.tsx` :
   - Idem : check `isPremium(profile.id)`, hide watermark si oui

**Important** : gating sur **`profile.id`** (le propriétaire du profil), pas sur le visiteur. Sinon un user Premium pourrait télécharger des cartes propres de profils gratuits.

### B. Profil customisé (background + accent)

**Settings UI** (`src/app/settings/page.tsx` + nouveau composant) :

Nouvelle section "Apparence du profil" entre "Profil public" et "Compte" :

```tsx
<section>
  <h2>Apparence du profil</h2>
  <PremiumGate isPremium={isPremium}>
    <AppearanceForm
      initial={profile.profileSettings ?? {}}
      username={profile.username}
    />
  </PremiumGate>
</section>
```

`<AppearanceForm>` (client) :
- Segmented control Background : `mesh` / `wall` / `noir` / `mauve` (4 boutons)
- 6 swatches accent color (radio buttons)
- Mini preview live à droite (composant `<ProfilePreview>` qui rend une version réduite de `/u/<username>` avec les settings en cours)
- Bouton Enregistrer → server action

**Server action** : étendre `updateProfileAction` ou nouvelle `updateAppearanceAction(formData)` dans `src/app/settings/actions.ts` :
- Validate background + accent enums
- Refuse si user pas Premium (defense in depth - UI déjà gated, mais double-check)
- `db.update(users).set({ profileSettings: { ...existing, background, accent } })`
- `revalidatePath("/settings")`, `revalidatePath("/u/<username>")`

**Render sur `/u/<username>`** :

`src/app/u/[username]/page.tsx` :
- Lire `profile.profileSettings.background` et `.accent`
- Background :
  - `mesh` (default) : laisser le `<body>` background CSS actuel (gradient violet)
  - `wall` : render `<AlbumWall covers={...} />` (réutiliser le composant dashboard, fetch via wall-covers query)
  - `noir` : `style={{ background: "#070710" }}` sur main
  - `mauve` : `style={{ background: "linear-gradient(135deg, #2a1a40 0%, #070710 100%)" }}`
- Accent :
  - Set CSS variable sur `<main>` : `style={{ "--ls-accent": ACCENT_HEX[accent ?? "violet"] }}`
  - Remplacer les hard-coded `#7c3aed` dans le rendu profil par `var(--ls-accent, #7c3aed)` (badge "Public", CTA login, etc.)

**Constante ACCENT_HEX** dans `src/lib/profile/appearance.ts` :

```ts
export const ACCENT_HEX: Record<NonNullable<ProfileSettings["accent"]>, string> = {
  violet: "#7c3aed",
  blue: "#3b82f6",
  rose: "#ec4899",
  green: "#10b981",
  orange: "#f59e0b",
  mono: "#fafafa",
};

export const BACKGROUND_LABELS: Record<NonNullable<ProfileSettings["background"]>, string> = {
  mesh: "Nébuleuse (default)",
  wall: "Mur de pochettes",
  noir: "Noir profond",
  mauve: "Mauve sombre",
};
```

### C. Helper `<PremiumGate>` (client component)

`src/components/premium-gate.tsx` :

```tsx
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
```

## Section 7 - UI / CTAs

**Sidebar** : nouvel item entre "Trouver des amis" et "Horloge d'écoute" :
- Icon `Crown` (lucide)
- Si user free → label "Premium" en accent violet → link `/pricing`
- Si user trial → label "Essai · J-X" → link `/settings/billing`
- Si user active/canceled → label "Mon Premium" + badge ✓ → link `/settings/billing`

**OwnProfileCard (`/dashboard`)** : si user free + public → ajout d'une ligne discrète sous l'URL :
- "💡 Passe Premium pour retirer le watermark · [Découvrir →]"

Si user Premium + public → ajout du badge "👑 Premium" à côté du badge "Public".

**Banner self-visit `/u/<self>`** : si Premium, change le texte en "👑 Profil Premium · c'est ce que voient les autres".

**Settings** : nouveau sous-lien "Abonnement →" dans la section "Compte" (vers `/settings/billing`).

## Files à créer

| Path | Responsibility |
|---|---|
| `drizzle/0003_<name>.sql` | Migration 4 colonnes Stripe |
| `src/lib/stripe.ts` | Client Stripe + `getOrCreateStripeCustomer(userId)` |
| `src/lib/profile/appearance.ts` | Constants `ACCENT_HEX`, `BACKGROUND_LABELS` |
| `src/db/queries/billing.ts` | `isPremium`, `getBillingState`, `updateBillingFromWebhook` |
| `src/app/pricing/page.tsx` | Server, hero + card + FAQ |
| `src/app/pricing/pricing-toggle.tsx` | Client, toggle + CTA |
| `src/app/checkout/success/page.tsx` | Landing post-paiement |
| `src/app/checkout/cancel/page.tsx` | Landing annul |
| `src/app/settings/billing/page.tsx` | Server, 5 états billing |
| `src/app/settings/billing/portal-form.tsx` | Client, POST /api/portal + redirect |
| `src/app/api/checkout/route.ts` | POST, create Checkout Session |
| `src/app/api/stripe/webhook/route.ts` | POST, verify sig + sync DB |
| `src/app/api/portal/route.ts` | POST, create Portal Session |
| `src/components/profile/appearance-form.tsx` | Client, settings appearance |
| `src/components/profile/profile-preview.tsx` | Client, mini render preview |
| `src/components/premium-gate.tsx` | Client, overlay grisé + CTA |

## Files à modifier

| Path | Change |
|---|---|
| `src/db/schema.ts` | 4 nouvelles colonnes sur users + extension `ProfileSettings` |
| `src/components/sidebar.tsx` | Nav item "Premium" avec état dynamique (free / trial / active) - accepter prop `billingState` ou `isPremium`+`trialEndsAt` |
| `src/app/layout.tsx` | Étendre Promise.all pour fetcher l'état Premium et le forwarder à Sidebar |
| `src/app/api/share-card/route.tsx` | Check `isPremium(profile.id)` → `hideWatermark` |
| `src/app/u/[username]/opengraph-image.tsx` | Idem |
| `src/app/api/share-card/templates/shared.tsx` | `<Watermark hidden>` returns null |
| `src/app/api/share-card/templates/twitter.tsx` + `post.tsx` + `story.tsx` | Propager `hideWatermark` |
| `src/app/u/[username]/page.tsx` | Appliquer `profileSettings.background` et `.accent` + CSS var `--ls-accent` |
| `src/app/settings/page.tsx` | Section "Apparence du profil" gated + sous-lien "Abonnement →" |
| `src/app/settings/actions.ts` | `updateAppearanceAction` (validation + DB update + revalidate) |
| `src/components/profile/own-profile-card.tsx` | Badge "Premium" + hint watermark si free |
| `src/app/api/u/[username]/page.tsx` ou similaire | Banner self-visit avec "👑 Profil Premium" si applicable |
| `.env.example` | Documenter les nouvelles env vars Stripe |
| `package.json` | `pnpm add stripe` |

## Verification end-to-end

1. **Stripe Dashboard setup** : products, prices, webhook, Stripe Tax, Customer Portal config.
2. **Env vars** : copier `STRIPE_*` dans `.env.local`.
3. **Migration** : `pnpm db:generate && pnpm db:migrate` → 4 colonnes ajoutées à `users`.
4. **Test paiement local** :
   - `stripe listen --forward-to localhost:3000/api/stripe/webhook` (dans un terminal séparé)
   - Visite `/pricing` non auth → CTA "Se connecter pour essayer →" link `/login?next=/pricing`
   - Login puis revisit `/pricing` → CTA "Essayer 14 jours gratuit"
   - Toggle mensuel/annuel change le prix affiché
   - Click "Essayer 14 jours gratuit" → POST `/api/checkout` → redirect Stripe Checkout
   - Entre CB test `4242 4242 4242 4242`, valide
   - Stripe envoie `checkout.session.completed` + `customer.subscription.created` → webhook → DB updated
   - Landing `/checkout/success` s'affiche
   - Retour `/dashboard` → sidebar montre "Essai · J-14" → click ouvre `/settings/billing`
   - `/settings/billing` affiche état trial + bouton "Gérer mon abonnement"
   - Click → POST `/api/portal` → redirect Customer Portal Stripe
   - Annule depuis le Portal → `customer.subscription.updated` (cancel_at_period_end) → webhook → DB synced
5. **Test Premium features locale** :
   - `/settings` → section "Apparence du profil" visible (pas grisée car Premium actif)
   - Change background `wall` + accent `rose` → enregistrer
   - Visite `/u/<username>` → bg wall visible, accent rose appliqué sur badges
   - Télécharge carte share via `/share` → PNG sans watermark
   - OG image `/u/<username>/opengraph-image` sans watermark
6. **Anti-leak** : visite le profil d'un user free depuis un compte Premium → cartes downloadées DOIVENT avoir le watermark (gating sur propriétaire, pas visiteur).
7. **Trial expiry simulé** : via Stripe CLI `stripe trigger customer.subscription.trial_will_end` → l'user voit le rappel email Stripe (built-in, pas notre code).
8. **Downgrade UX** : DB UPDATE `users SET premium_status='canceled', premium_until=NOW() - INTERVAL '1 day'` → `/settings` section Apparence est grisée mais `/u/<username>` garde le visual config persisté.

## Métriques de succès (subjectif MVP)

- 1er paiement test bout-en-bout réussit en mode test Stripe
- Webhook gère les 5 events sans erreur sur Stripe Dashboard
- `isPremium(userId)` répond < 50ms (DB lookup avec cache React)
- `/pricing` load < 800ms server (toggle client-only, pas de fetch supplémentaire)

## Risques identifiés & mitigations

1. **TVA EU non gérée** → Stripe Tax compute mais déclaration manuelle. Tracker dans une feuille externe au début. À automatiser via export Stripe Tax ou outil tiers (Quaderno, Octobat) quand revenu justifie.
2. **Webhook race condition** : si user complète checkout, redirect `/checkout/success` avant que le webhook arrive → `isPremium` retourne false brièvement. Mitigation : la landing `/checkout/success` ne fait PAS dépendre son contenu de l'état Premium (juste un message générique). L'user voit le statut "trial" se mettre à jour quand il navigue.
3. **Webhook delivery delay** (rare mais possible) : Stripe retry jusqu'à 72h en cas d'échec 5xx. Notre handler doit être **idempotent** (les updates DB le sont - repeat = même résultat).
4. **`automatic_tax` requires customer_update** : Stripe exige que la session puisse enrichir le customer (nom, adresse) pour calculer la TVA. On passe `customer_update: { name: "auto", address: "auto" }`. À tester en mode test.
5. **Pas de feature à vendre** au launch si Premium gating mal implémenté → on ship strictement les 2 features Premium dans CE spec, pas en suivant.
6. **Apple Pay sur Safari/iOS** : marche automatiquement via Stripe Checkout hosted, MAIS si on switche vers Payment Element plus tard il faudra une domain registration Stripe.
7. **Trial fraud** : un user pourrait créer 10 comptes Spotify pour avoir 10×14 jours. Mitigation MVP : Stripe a un fingerprinting CB qui empêche la réutilisation. Bonus : tracker `card.fingerprint` côté Stripe pour bloquer (à voir si nécessaire en post-launch).

## Hors-scope explicite (rappel)

- Page upgrade-prompts contextuelles
- Multi-currency
- Cadeau/gift
- Promo étudiants, codes promo manuels
- Referral
- Tiers Basic/Pro
- Annual savings calculator interactif
- Testimonials sur pricing
- Customisation cartes (couleurs polices Premium) - déjà couvert par /share editor existant, et la customisation Premium ferait l'objet d'une feature à part
- Exports HD sans watermark - le no-watermark générique au MVP suffit, exports HD est une feature séparée
- Notifications (rappel J-3 fin de trial : déjà géré par Stripe nativement, pas besoin de code)
