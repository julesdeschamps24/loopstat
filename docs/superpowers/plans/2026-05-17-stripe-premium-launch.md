# Stripe Premium Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase C monetisation MVP — Stripe-powered subscription (3€/mois ou 20€/an, 14-day free trial with CB) wrapping a pricing page, Customer Portal, webhook sync, and the two launch Premium features (no-watermark share cards + customizable profile background/accent).

**Architecture:** New `users` columns sync from Stripe webhook events into a local `isPremium`/`getBillingState` cached helper. Stripe Checkout hosted flow (Apple Pay automatic) launched from a public `/pricing` page; Customer Portal is the only way to cancel/switch plans. Premium features gate via `isPremium(profile.id)` on the OWNER (not visitor), so sharing remains the incentive.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), React 19, TypeScript, Drizzle ORM + Postgres, Stripe Node SDK (server-side only), Tailwind, lucide-react, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-17-stripe-premium-launch-design.md](docs/superpowers/specs/2026-05-17-stripe-premium-launch-design.md)

**Branch:** create `feat/stripe-premium` from `main`.

---

## Critical context for the engineer

1. **Project conventions** : Next.js 16 (read `node_modules/next/dist/docs/01-app/` before touching App Router features — the version has breaking changes vs common docs). Host `http://127.0.0.1:3000` (NEVER localhost — Spotify OAuth quirk). User already runs `pnpm dev` on port 3000 — do NOT start a second dev server.

2. **Stripe is server-side only.** All Stripe SDK usage stays behind API route handlers or server components. No `NEXT_PUBLIC_STRIPE_*` is needed for Hosted Checkout — we redirect users via a server action that returns a Stripe-hosted URL.

3. **Webhook needs RAW body for signature verification.** In Next.js 16 App Router, `await req.text()` returns the raw body before any parsing — pass that to `stripe.webhooks.constructEvent(body, sig, secret)`. Do NOT use `req.json()`.

4. **`auth()` from `@/auth`** returns `Session | null` with `session?.user?.id` (uuid).

5. **`isPremium(profile.id)` not `isPremium(session.user.id)`** when gating share cards — the watermark is removed for the PROFILE OWNER, not for the visitor downloading. Otherwise Premium users could download clean cards from free profiles, killing the incentive.

6. **DB state (verified)** : 1 user `judescha`, `is_public=true`, `id='606faa26-da96-4e7c-935d-2a803eaefc01'`. Use Stripe test cards (`4242 4242 4242 4242`) for smoke tests; never live cards in test mode.

7. **Stripe webhook delivery** is asynchronous : a user may land on `/checkout/success` BEFORE the webhook arrives and updates the DB. Don't make `/checkout/success` content depend on `isPremium` — it shows a generic welcome. The trial state appears in the sidebar once the user navigates.

8. **TVA admin is on Jules's side** (not merchant of record). Stripe Tax computes per buyer country, but declaration is manual. Spec acknowledges this — no code needed.

9. **React 19 strict eslint** bans `setState` in `useEffect` body. Reuse the project's `useIsClient` pattern (cf. `src/components/share-button.tsx:21-27` or, ideally, the future shared helper from issue #23 if landed first).

10. **Existing helpers to reuse**:
    - `auth()` from `@/auth`
    - `getProfile(userId)` in `src/db/queries/users.ts` (cached, returns ProfileRow with `{ username, isPublic, displayName, spotifyId }`)
    - `getPublicProfileByUsername(username)` returns `PublicProfile | null` (null on not-found OR not-public)
    - `cn`, `glassCard` from `@/lib/utils`
    - `<AlbumWall covers={...} />` from `src/components/album-wall.tsx` — reusable for the `wall` background option

11. **Stripe Dashboard setup is MANUAL** (Task 2 documents the steps). The plan code assumes Products/Prices/Webhook are already configured ; if a smoke test fails because Stripe says "no such price", recheck the Dashboard before chasing code bugs.

12. **Migration safety** : the new columns are all nullable. Existing users continue to behave exactly as before (treated as free until they paid). Roll forward only.

---

## File structure

**Create:**

| Path | Responsibility |
|---|---|
| `drizzle/0003_<name>.sql` | Migration : 4 Stripe columns on `users` |
| `src/lib/stripe.ts` | Stripe client singleton + `getOrCreateStripeCustomer(userId, email?)` |
| `src/lib/profile/appearance.ts` | `ACCENT_HEX`, `BACKGROUND_LABELS`, type guards |
| `src/db/queries/billing.ts` | `isPremium`, `getBillingState`, `updateBillingFromWebhook` |
| `src/app/api/checkout/route.ts` | POST → Stripe Checkout Session URL |
| `src/app/api/stripe/webhook/route.ts` | POST → verify sig + sync DB |
| `src/app/api/portal/route.ts` | POST → Stripe Customer Portal URL |
| `src/app/pricing/page.tsx` | Server : hero + comparison + FAQ + CTA |
| `src/app/pricing/pricing-toggle.tsx` | Client : monthly/yearly toggle + checkout POST |
| `src/app/checkout/success/page.tsx` | Generic post-paiement landing |
| `src/app/checkout/cancel/page.tsx` | Generic annul landing |
| `src/app/settings/billing/page.tsx` | Server : 5 billing states |
| `src/app/settings/billing/portal-form.tsx` | Client : POST /api/portal + redirect |
| `src/components/premium-gate.tsx` | Client : overlay grisé + CTA Premium |
| `src/components/profile/appearance-form.tsx` | Client : background+accent picker + Enregistrer |
| `src/components/profile/profile-preview.tsx` | Client : mini render preview |

**Modify:**

| Path | Change |
|---|---|
| `src/db/schema.ts` | 4 new columns on `users` + extend `ProfileSettings` type |
| `.env.example` | Add `STRIPE_*` env vars |
| `package.json` (via `pnpm add stripe`) | Add `stripe` dep |
| `src/app/api/share-card/route.tsx` | Check `isPremium(profile.id)` → pass `hideWatermark` |
| `src/app/u/[username]/opengraph-image.tsx` | Idem |
| `src/app/api/share-card/templates/shared.tsx` | `<Watermark hidden>` returns null |
| `src/app/api/share-card/templates/twitter.tsx`, `post.tsx`, `story.tsx` | Propagate `hideWatermark` |
| `src/app/u/[username]/page.tsx` | Apply `profileSettings.background` + accent CSS var |
| `src/app/settings/page.tsx` | New "Apparence du profil" section (premium-gated) + "Abonnement →" link |
| `src/app/settings/actions.ts` | New `updateAppearanceAction` server action |
| `src/components/profile/own-profile-card.tsx` | Premium badge + watermark hint for free |
| `src/components/sidebar.tsx` | Premium nav item + accept `billingTier` prop |
| `src/app/layout.tsx` | Fetch `getBillingState` + forward to Sidebar |

---

## Task 1: DB migration + schema extension

**Files:**
- Create: `drizzle/0003_<generated>.sql` (via `pnpm db:generate`)
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add Stripe columns to schema**

Edit `src/db/schema.ts`. In the `users` table definition, add these 4 columns (after `deletedAt`):

```ts
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  premiumStatus: text("premium_status"),
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
```

Then extend `ProfileSettings`:

```ts
export type ProfileSettings = {
  background?: "mesh" | "wall" | "noir" | "mauve";
  accent?: "violet" | "blue" | "rose" | "green" | "orange" | "mono";
  // Existing keys remain (theme, pinnedSections were placeholders in spec)
};
```

- [ ] **Step 2: Create branch + generate migration**

```bash
git checkout -b feat/stripe-premium
pnpm db:generate
```

Expected output : a new file `drizzle/0003_<name>.sql` (e.g. `0003_pink_hellfire_club.sql`) with `ALTER TABLE "users" ADD COLUMN ...` for each new column.

- [ ] **Step 3: Apply migration**

```bash
pnpm db:migrate
```

Expected : "migrations applied successfully!".

- [ ] **Step 4: Verify schema**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND column_name LIKE 'stripe%' OR column_name LIKE 'premium%';"
```

Expected : 4 rows (`stripe_customer_id text`, `stripe_subscription_id text`, `premium_status text`, `premium_until timestamp with time zone`).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/0003_*.sql drizzle/meta/0003_*.json drizzle/meta/_journal.json
git commit -m "$(cat <<'EOF'
feat(db): Stripe billing columns + ProfileSettings extension

Adds stripe_customer_id (unique), stripe_subscription_id,
premium_status (trialing|active|past_due|canceled), and
premium_until (timestamptz) on users. All nullable so existing
rows keep behaving as free users until they pay.

Extends ProfileSettings jsonb type with background and accent
keys for the customizable profile feature (no migration needed,
column was already jsonb).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Stripe SDK + .env.example + Dashboard setup doc

**Files:**
- Create: `src/lib/stripe.ts`
- Modify: `.env.example`, `package.json` (via pnpm)
- Create: `docs/stripe-setup.md` (manual Dashboard checklist)

- [ ] **Step 1: Install the Stripe SDK**

```bash
pnpm add stripe
```

Expected: `stripe@^17.x` added to `dependencies` in package.json.

- [ ] **Step 2: Create the Stripe client wrapper**

Create `src/lib/stripe.ts`:

```ts
import Stripe from "stripe";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

// `null` in dev when not configured — guards in API routes early-return.
export const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2025-09-30.clover" })
  : null;

/**
 * Get the persisted Stripe customer id for a user, or create one and
 * persist it. Email is best-effort (DB column may be null for older
 * accounts). Throws if Stripe is not configured.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      stripeCustomerId: true,
      email: true,
      displayName: true,
      spotifyId: true,
    },
  });
  if (!row) throw new Error(`User ${userId} not found`);
  if (row.stripeCustomerId) return row.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: row.email ?? undefined,
    name: row.displayName ?? row.spotifyId,
    metadata: { userId },
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, userId));

  return customer.id;
}
```

- [ ] **Step 3: Add Stripe vars to `.env.example`**

Append to `.env.example`:

```
# Stripe — https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
```

- [ ] **Step 4: Document the manual Stripe Dashboard setup**

Create `docs/stripe-setup.md`:

```markdown
# Stripe Dashboard setup (one-time)

Before the first run, configure Stripe (test mode first, replicate for live):

## 1. Create the product + 2 prices

- Dashboard → Products → + Add product
- Name: `loopstat Premium`
- Add Price #1 :
  - Pricing model: Standard pricing
  - Amount: 3.00 EUR
  - Billing period: Monthly
  - Save → note the `price_test_...` → put it in `STRIPE_PRICE_ID_MONTHLY`
- Add Price #2 :
  - Amount: 20.00 EUR, period: Yearly
  - Save → `price_test_...` → `STRIPE_PRICE_ID_YEARLY`

## 2. Enable Stripe Tax

- Settings → Tax → Get started
- Origin: France
- Enable Stripe Tax → Save

## 3. Configure the Customer Portal

- Settings → Billing → Customer portal
- Features:
  - Allow customers to cancel subscriptions ✓
  - Allow switching plans (between monthly & yearly) ✓
  - Allow customers to update payment methods ✓
  - Allow customers to view invoices ✓
- Save

## 4. Create the webhook endpoint

- Developers → Webhooks → + Add endpoint
- URL: `https://loopstat.tech/api/stripe/webhook` (prod)
  - Local : run `stripe listen --forward-to localhost:3000/api/stripe/webhook` to get a temporary tunnel
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Save → reveal signing secret `whsec_...` → put it in `STRIPE_WEBHOOK_SECRET`

## 5. Local dev workflow

Two terminals:
- T1: `pnpm dev` (Next on port 3000)
- T2: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  - Copy the displayed `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET` for the duration of the session

Test card: `4242 4242 4242 4242`, any future date, any CVC, any ZIP.

## 6. Production deploy

- Switch Stripe Dashboard to live mode → recreate Products / Prices / Webhook with prod URL
- Update Hetzner secrets (`STRIPE_*` env vars) with live keys
- Rebuild + restart the loopstat container
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: clean (no errors). `stripe` package types should resolve.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/stripe.ts .env.example docs/stripe-setup.md
git commit -m "$(cat <<'EOF'
feat(stripe): SDK + client lib + Dashboard setup doc

Adds the official stripe npm package and a thin client wrapper
that exposes a singleton (or null in dev when STRIPE_SECRET_KEY is
absent) and a get-or-create Stripe customer helper that persists
the id on the users table.

Documents the one-time Stripe Dashboard configuration required
before first run (products, prices, Stripe Tax, Customer Portal,
webhook endpoint).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Billing helpers (`isPremium`, `getBillingState`, `updateBillingFromWebhook`)

**Files:**
- Create: `src/db/queries/billing.ts`

- [ ] **Step 1: Create the helper file**

Create `src/db/queries/billing.ts`:

```ts
import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

export type BillingState =
  | { tier: "free" }
  | { tier: "trial"; trialEndsAt: Date }
  | { tier: "active"; renewsAt: Date }
  | { tier: "past_due"; expiresAt: Date }
  | { tier: "canceled"; expiresAt: Date };

/**
 * True if the user currently has any Premium entitlement
 * (trialing or active or canceled-but-still-in-period).
 * Cached per request via React.cache.
 */
export const isPremium = cache(async (userId: string): Promise<boolean> => {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { premiumStatus: true, premiumUntil: true },
  });
  if (!row?.premiumUntil) return false;
  if (row.premiumUntil <= new Date()) return false;
  return (
    row.premiumStatus === "trialing" ||
    row.premiumStatus === "active" ||
    row.premiumStatus === "canceled"
  );
});

/**
 * Full billing state for the /settings/billing page UI.
 */
export const getBillingState = cache(
  async (userId: string): Promise<BillingState> => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { premiumStatus: true, premiumUntil: true },
    });
    if (!row?.premiumStatus || !row.premiumUntil) return { tier: "free" };
    const expiry = row.premiumUntil;
    if (expiry <= new Date()) return { tier: "free" };
    switch (row.premiumStatus) {
      case "trialing":
        return { tier: "trial", trialEndsAt: expiry };
      case "active":
        return { tier: "active", renewsAt: expiry };
      case "past_due":
        return { tier: "past_due", expiresAt: expiry };
      case "canceled":
        return { tier: "canceled", expiresAt: expiry };
      default:
        return { tier: "free" };
    }
  },
);

/**
 * Webhook sync. Looks up the user by stripe_customer_id and updates
 * the billing-related columns. Idempotent (Stripe retries on 5xx).
 */
export async function updateBillingFromWebhook(
  stripeCustomerId: string,
  patch: {
    subscriptionId?: string | null;
    status?: string;
    periodEnd?: Date;
  },
): Promise<void> {
  const set: Partial<{
    stripeSubscriptionId: string | null;
    premiumStatus: string;
    premiumUntil: Date;
  }> = {};
  if (patch.subscriptionId !== undefined) {
    set.stripeSubscriptionId = patch.subscriptionId;
  }
  if (patch.status !== undefined) set.premiumStatus = patch.status;
  if (patch.periodEnd !== undefined) set.premiumUntil = patch.periodEnd;
  if (Object.keys(set).length === 0) return;

  await db
    .update(users)
    .set(set)
    .where(eq(users.stripeCustomerId, stripeCustomerId));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/billing.ts
git commit -m "$(cat <<'EOF'
feat(billing): isPremium + getBillingState + updateBillingFromWebhook

isPremium is the boolean gate used everywhere Premium features
need to be checked (share-card route, opengraph-image, settings
form, sidebar nav). getBillingState returns a 5-variant discriminated
union for the /settings/billing page UI. updateBillingFromWebhook
is the idempotent writer called by the Stripe webhook handler.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `<PremiumGate>` component

**Files:**
- Create: `src/components/premium-gate.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/premium-gate.tsx`:

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

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/premium-gate.tsx
git commit -m "$(cat <<'EOF'
feat(ui): PremiumGate component (overlay + CTA)

Renders children unchanged when isPremium is true, otherwise wraps
them in a non-interactive, 30%-opacity layer with a centred
"Débloquer Premium" CTA that links to /pricing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `POST /api/checkout`

**Files:**
- Create: `src/app/api/checkout/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/checkout/route.ts`:

```ts
import { auth } from "@/auth";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";

const PRICE_BY_TIER = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  yearly: process.env.STRIPE_PRICE_ID_YEARLY,
} as const;

type CheckoutBody = { priceTier?: "monthly" | "yearly" };

export async function POST(req: Request) {
  if (!stripe) {
    return new Response(
      JSON.stringify({ error: "stripe_not_configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "unauthenticated" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutBody;
  const tier = body.priceTier === "yearly" ? "yearly" : "monthly";
  const priceId = PRICE_BY_TIER[tier];
  if (!priceId) {
    return new Response(
      JSON.stringify({ error: "price_not_configured" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

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
    customer_update: { name: "auto", address: "auto" },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
  });

  return Response.json({ url: checkoutSession.url });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "$(cat <<'EOF'
feat(checkout): POST /api/checkout creates Stripe Checkout Session

Auth-gated. Reads priceTier from JSON body (defaults to monthly),
resolves to a Stripe price id from env vars, calls
getOrCreateStripeCustomer, then opens a Stripe Checkout Session
with a 14-day trial, automatic_tax enabled, and a userId metadata
breadcrumb. Returns { url } for the client to redirect to.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `POST /api/stripe/webhook`

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/stripe/webhook/route.ts`:

```ts
import type Stripe from "stripe";

import { updateBillingFromWebhook } from "@/db/queries/billing";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripe) {
    return new Response("stripe not configured", { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("webhook secret missing", { status: 503 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("missing signature", { status: 400 });
  }

  // Raw body is required for signature verification in Next 16 App Router.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] invalid signature", err);
    return new Response("invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const periodEndSec = sub.trial_end ?? sub.current_period_end;
      await updateBillingFromWebhook(sub.customer as string, {
        subscriptionId: sub.id,
        status: sub.status,
        periodEnd: new Date(periodEndSec * 1000),
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
      if (typeof inv.customer === "string") {
        await updateBillingFromWebhook(inv.customer, { status: "past_due" });
      }
      break;
    }
    // checkout.session.completed and invoice.paid are no-ops — the
    // subscription.{created,updated} that follows carries the canonical
    // state.
    case "checkout.session.completed":
    case "invoice.paid":
      break;
    default:
      // Ignore unrecognised events.
      break;
  }

  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "$(cat <<'EOF'
feat(webhook): POST /api/stripe/webhook syncs subscription state

Verifies the signature against STRIPE_WEBHOOK_SECRET (raw body via
req.text()), dispatches subscription.{created,updated,deleted} and
invoice.payment_failed to updateBillingFromWebhook. Idempotent so
Stripe retries on 5xx are safe.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `POST /api/portal`

**Files:**
- Create: `src/app/api/portal/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/portal/route.ts`:

```ts
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!stripe) {
    return new Response(
      JSON.stringify({ error: "stripe_not_configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "unauthenticated" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { stripeCustomerId: true },
  });
  if (!row?.stripeCustomerId) {
    return new Response(
      JSON.stringify({ error: "no_customer" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const origin = new URL(req.url).origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/settings/billing`,
  });

  return Response.json({ url: portalSession.url });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portal/route.ts
git commit -m "$(cat <<'EOF'
feat(billing): POST /api/portal opens Stripe Customer Portal

Auth-gated. Looks up the user's stripe_customer_id, creates a
billing portal session with a return_url back to /settings/billing,
returns { url } for client redirect. Refuses with 400 no_customer
when the user has never checked out (defensive — UI should not
expose the button in that case).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `/pricing` page + pricing-toggle client

**Files:**
- Create: `src/app/pricing/page.tsx`
- Create: `src/app/pricing/pricing-toggle.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/pricing/page.tsx`:

```tsx
import Link from "next/link";

import { auth } from "@/auth";
import { PricingToggle } from "@/app/pricing/pricing-toggle";
import { getBillingState } from "@/db/queries/billing";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await auth();
  const state = session?.user?.id
    ? await getBillingState(session.user.id)
    : { tier: "free" as const };

  const isPremium = state.tier !== "free";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-16 max-w-3xl mx-auto w-full">
      <header className="mb-12 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">
          Soutiens loopstat, débloque les bonus.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Sans engagement. Annule en 1 click. Apple Pay accepté.
        </p>
      </header>

      <PricingToggle
        isAuthenticated={Boolean(session?.user?.id)}
        isPremium={isPremium}
      />

      <section className="mt-16 grid gap-6">
        <h2 className="text-lg font-semibold">Questions fréquentes</h2>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Comment annuler ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            En 1 click dans tes réglages → Abonnement → Gérer mon abonnement.
            Pas de questions, pas de friction. Tu gardes l&apos;accès jusqu&apos;à
            la fin de la période payée.
          </p>
        </details>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Quand suis-je charged ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            À la fin de tes 14 jours d&apos;essai gratuit. Tu reçois un email
            de rappel 3 jours avant.
          </p>
        </details>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Apple Pay ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Oui, via Stripe Checkout. CB, Google Pay et prélèvement SEPA
            aussi.
          </p>
        </details>
      </section>

      {!session?.user?.id ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          <Link href="/login?next=/pricing" className="underline">
            Se connecter
          </Link>{" "}
          pour démarrer l&apos;essai.
        </p>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Create the toggle client component**

Create `src/app/pricing/pricing-toggle.tsx`:

```tsx
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
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Smoke test the page**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:3000/pricing"
```

Expected: `HTTP 200` (public page, no auth required).

- [ ] **Step 5: Commit**

```bash
git add src/app/pricing
git commit -m "$(cat <<'EOF'
feat(pricing): /pricing page + Mensuel/Annuel toggle

Server-rendered hero + 3-question FAQ + client toggle component
that POSTs to /api/checkout and redirects to Stripe. CTA adapts
to session: "Se connecter pour essayer" when anonymous,
"Essayer 14 jours gratuit" when authenticated + free, "Tu es
Premium · Gérer mon abo" when authenticated + premium.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/checkout/success` + `/checkout/cancel` landings

**Files:**
- Create: `src/app/checkout/success/page.tsx`
- Create: `src/app/checkout/cancel/page.tsx`

- [ ] **Step 1: Create success landing**

Create `src/app/checkout/success/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Create cancel landing**

Create `src/app/checkout/cancel/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Smoke test**

```bash
curl -s -o /dev/null -w "success: HTTP %{http_code}\n" "http://127.0.0.1:3000/checkout/success"
curl -s -o /dev/null -w "cancel:  HTTP %{http_code}\n" "http://127.0.0.1:3000/checkout/cancel"
```

Expected: both `HTTP 200`.

- [ ] **Step 5: Commit**

```bash
git add src/app/checkout
git commit -m "$(cat <<'EOF'
feat(checkout): success + cancel landing pages

Generic landings (no DB lookup, no isPremium dependency) — the
real Premium activation happens via the Stripe webhook. Success
page sends the user back to /dashboard; cancel page back to
/pricing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `/settings/billing` page + portal-form

**Files:**
- Create: `src/app/settings/billing/page.tsx`
- Create: `src/app/settings/billing/portal-form.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/settings/billing/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { getBillingState } from "@/db/queries/billing";
import { OpenPortalButton } from "@/app/settings/billing/portal-form";

export const dynamic = "force-dynamic";

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/billing");

  const state = await getBillingState(session.user.id);

  return (
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full"
    >
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Abonnement</h1>
      </header>

      {state.tier === "free" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">Tu n&apos;es pas encore Premium.</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
          >
            Découvrir Premium →
          </Link>
        </section>
      ) : null}

      {state.tier === "trial" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Essai gratuit
            </span>{" "}
            jusqu&apos;au {FR_DATE.format(state.trialEndsAt)}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Annule à tout moment, sans frais.
          </p>
          <OpenPortalButton className="mt-4" />
        </section>
      ) : null}

      {state.tier === "active" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Premium actif
            </span>{" "}
            renouvellement le {FR_DATE.format(state.renewsAt)}.
          </p>
          <OpenPortalButton className="mt-4" />
        </section>
      ) : null}

      {state.tier === "past_due" ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm font-medium text-red-400">
            Paiement échoué. Mets à jour ta CB pour conserver Premium.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Accès maintenu jusqu&apos;au {FR_DATE.format(state.expiresAt)}.
          </p>
          <OpenPortalButton className="mt-4" label="Régler →" />
        </section>
      ) : null}

      {state.tier === "canceled" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            Abonnement annulé. Accès Premium maintenu jusqu&apos;au{" "}
            {FR_DATE.format(state.expiresAt)}.
          </p>
          <OpenPortalButton className="mt-4" label="Réactiver →" />
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Create the portal button client**

Create `src/app/settings/billing/portal-form.tsx`:

```tsx
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
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Smoke test auth redirect**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:3000/settings/billing"
```

Expected: `HTTP 307` (redirect to `/login?next=/settings/billing`).

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/billing
git commit -m "$(cat <<'EOF'
feat(billing): /settings/billing page with 5 states

Server component dispatching on getBillingState: free, trial,
active, past_due, canceled. Each state shows the relevant info
(renewal date, trial end, etc.) and a single client button that
POSTs to /api/portal and redirects to the Stripe Customer Portal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Feature A — no-watermark gating

**Files:**
- Modify: `src/app/api/share-card/route.tsx`
- Modify: `src/app/u/[username]/opengraph-image.tsx`
- Modify: `src/app/api/share-card/templates/shared.tsx`
- Modify: `src/app/api/share-card/templates/twitter.tsx`, `post.tsx`, `story.tsx`

- [ ] **Step 1: Update the Watermark component to accept `hidden`**

Edit `src/app/api/share-card/templates/shared.tsx`. Replace the existing `Watermark` function with:

```tsx
export function Watermark({
  username,
  scale = 1,
  hidden = false,
}: {
  username: string;
  scale?: number;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        justifyContent: "flex-end",
        fontSize: Math.round(20 * scale),
        color: COLORS.textMuted,
      }}
    >
      loopstat.tech/u/{username}
    </div>
  );
}
```

- [ ] **Step 2: Propagate `hideWatermark` in each template**

For each of `src/app/api/share-card/templates/twitter.tsx`, `post.tsx`, `story.tsx`:

1. Add `hideWatermark?: boolean` to the props type.
2. Pass it through to every `<Watermark username={...} ... />` call as `hidden={hideWatermark}`.

Example for `story.tsx` (replace the existing `StoryProps` and the `<Watermark>` calls):

```tsx
export type StoryProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
  hideWatermark?: boolean;
};
```

And the `<Watermark>` invocation:

```tsx
<Watermark username={username} scale={1.2} hidden={hideWatermark} />
```

Do the same in `twitter.tsx` (scale=1.0) and `post.tsx` (scale=1.0).

- [ ] **Step 3: Update the share-card route to compute + pass `hideWatermark`**

Edit `src/app/api/share-card/route.tsx`. Add import:

```ts
import { isPremium } from "@/db/queries/billing";
```

In the `GET` handler, after the `getPublicProfileByUsername(username)` call and the null-guard, add:

```ts
const hideWatermark = await isPremium(profile.id);
```

Then in the `props` object that's spread into the templates, add the field:

```ts
const props = {
  config,
  username: profile.username,
  displayName,
  avatarUrl: inlinedAvatar,
  covers: inlinedCovers,
  data: inlinedData,
  hideWatermark,
};
```

- [ ] **Step 4: Update the auto OG image likewise**

Edit `src/app/u/[username]/opengraph-image.tsx`. Add import:

```ts
import { isPremium } from "@/db/queries/billing";
```

After the `getPublicProfileByUsername` + null-guard, compute the flag and use it where the watermark text is rendered. Replace the existing `<Watermark>` (or the inline watermark `<div>`) with the conditional render — `if (!hideWatermark) { /* render watermark */ }`.

If the file uses its own inline watermark rather than the shared `<Watermark>` component, the same gating applies — wrap that JSX in `{!hideWatermark ? (...) : null}`.

- [ ] **Step 5: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean, all tests pass.

- [ ] **Step 6: Smoke test (with judescha not yet Premium)**

```bash
curl -s -o /tmp/wm.png "http://127.0.0.1:3000/api/share-card?username=judescha&format=story&n=5&period=4w&bg=mesh&v=$(date +%s)"
file /tmp/wm.png
```

Expected: PNG 1080×1920, watermark visible (`open /tmp/wm.png` to inspect on macOS).

Manually flip judescha to Premium in DB and re-fetch:

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET premium_status='active', premium_until=NOW() + INTERVAL '1 year' WHERE username='judescha';"
curl -s -o /tmp/no-wm.png "http://127.0.0.1:3000/api/share-card?username=judescha&format=story&n=5&period=4w&bg=mesh&v=$(date +%s)"
file /tmp/no-wm.png
# Restore:
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET premium_status=NULL, premium_until=NULL WHERE username='judescha';"
```

Expected: second PNG has NO watermark (`open /tmp/no-wm.png`).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/share-card src/app/u/'[username]'/opengraph-image.tsx
git commit -m "$(cat <<'EOF'
feat(premium): no-watermark on share cards + OG image when Premium

Gating is on the PROFILE OWNER, not the visitor: a Premium user's
cards are clean for anyone downloading them; a free user's cards
stay watermarked even if a Premium user grabs them. This keeps
the incentive aligned with "pay to share clean cards of YOUR
stats".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Feature B Part 1 — appearance lib + server action

**Files:**
- Create: `src/lib/profile/appearance.ts`
- Modify: `src/app/settings/actions.ts`

- [ ] **Step 1: Create the appearance constants**

Create `src/lib/profile/appearance.ts`:

```ts
export const BACKGROUNDS = ["mesh", "wall", "noir", "mauve"] as const;
export const ACCENTS = [
  "violet",
  "blue",
  "rose",
  "green",
  "orange",
  "mono",
] as const;

export type Background = (typeof BACKGROUNDS)[number];
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_HEX: Record<Accent, string> = {
  violet: "#7c3aed",
  blue: "#3b82f6",
  rose: "#ec4899",
  green: "#10b981",
  orange: "#f59e0b",
  mono: "#fafafa",
};

export const BACKGROUND_LABELS: Record<Background, string> = {
  mesh: "Nébuleuse (default)",
  wall: "Mur de pochettes",
  noir: "Noir profond",
  mauve: "Mauve sombre",
};

export function isBackground(v: unknown): v is Background {
  return typeof v === "string" && (BACKGROUNDS as readonly string[]).includes(v);
}

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && (ACCENTS as readonly string[]).includes(v);
}
```

- [ ] **Step 2: Add the server action**

Edit `src/app/settings/actions.ts`. Append:

```ts
import { eq } from "drizzle-orm";

import { isPremium } from "@/db/queries/billing";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { isAccent, isBackground } from "@/lib/profile/appearance";

export type AppearanceFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; error: string };

export async function updateAppearanceAction(
  _prev: AppearanceFormState,
  formData: FormData,
): Promise<AppearanceFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", error: "Tu dois être connecté." };
  }

  if (!(await isPremium(session.user.id))) {
    return {
      status: "error",
      error: "Cette personnalisation est réservée Premium.",
    };
  }

  const background = formData.get("background");
  const accent = formData.get("accent");
  if (!isBackground(background) || !isAccent(accent)) {
    return { status: "error", error: "Choix invalides." };
  }

  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { profileSettings: true, username: true },
  });
  if (!row) return { status: "error", error: "Compte introuvable." };

  await db
    .update(users)
    .set({
      profileSettings: {
        ...(row.profileSettings ?? {}),
        background,
        accent,
      },
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  if (row.username) revalidatePath(`/u/${row.username}`);

  return { status: "ok", message: "Apparence mise à jour." };
}
```

(Assumes `auth` and `revalidatePath` are already imported at the top of the file. If not, add them.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/profile src/app/settings/actions.ts
git commit -m "$(cat <<'EOF'
feat(profile): appearance constants + updateAppearanceAction

ACCENT_HEX maps each accent name to a hex; BACKGROUND_LABELS gives
human-readable French strings; isBackground/isAccent are the
validation guards. The server action is Premium-gated (UI gate +
defensive server-side check) and updates the profile_settings
jsonb without clobbering other keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Feature B Part 2 — appearance form + preview

**Files:**
- Create: `src/components/profile/appearance-form.tsx`
- Create: `src/components/profile/profile-preview.tsx`

- [ ] **Step 1: Create the preview component**

Create `src/components/profile/profile-preview.tsx`:

```tsx
"use client";

import { ACCENT_HEX, type Accent, type Background } from "@/lib/profile/appearance";

const BG_STYLE: Record<Background, React.CSSProperties> = {
  mesh: {
    background:
      "radial-gradient(circle at 30% 30%, rgba(124,58,237,0.55), transparent 50%), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.4), transparent 55%), #070710",
  },
  wall: { background: "#1a0d2e" /* placeholder; live render is on /u/<username> */ },
  noir: { background: "#070710" },
  mauve: {
    background: "linear-gradient(135deg, #2a1a40 0%, #070710 100%)",
  },
};

export function ProfilePreview({
  username,
  displayName,
  background,
  accent,
}: {
  username: string;
  displayName: string;
  background: Background;
  accent: Accent;
}) {
  const accentHex = ACCENT_HEX[accent];
  return (
    <div
      className="aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border p-4 text-xs text-white"
      style={BG_STYLE[background]}
    >
      <div className="flex items-center gap-2">
        <div
          className="size-8 rounded-full"
          style={{ background: accentHex }}
        />
        <div>
          <div className="font-semibold">{displayName}</div>
          <div className="font-mono opacity-60">@{username}</div>
        </div>
      </div>
      <div
        className="mt-3 inline-flex rounded-full px-2 py-0.5 text-[10px]"
        style={{ background: `${accentHex}22`, color: accentHex }}
      >
        Public
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the appearance form**

Create `src/components/profile/appearance-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";

import {
  type AppearanceFormState,
  updateAppearanceAction,
} from "@/app/settings/actions";
import { ProfilePreview } from "@/components/profile/profile-preview";
import {
  ACCENTS,
  ACCENT_HEX,
  BACKGROUNDS,
  BACKGROUND_LABELS,
  type Accent,
  type Background,
} from "@/lib/profile/appearance";

const INITIAL: AppearanceFormState = { status: "idle" };

export function AppearanceForm({
  username,
  displayName,
  initialBackground = "mesh",
  initialAccent = "violet",
}: {
  username: string;
  displayName: string;
  initialBackground?: Background;
  initialAccent?: Accent;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAppearanceAction,
    INITIAL,
  );
  const [background, setBackground] = useState<Background>(initialBackground);
  const [accent, setAccent] = useState<Accent>(initialAccent);

  return (
    <form action={formAction} className="grid gap-6 sm:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Background
          </legend>
          <div className="flex flex-wrap gap-2">
            {BACKGROUNDS.map((b) => (
              <label key={b} className="cursor-pointer">
                <input
                  type="radio"
                  name="background"
                  value={b}
                  checked={background === b}
                  onChange={() => setBackground(b)}
                  className="peer sr-only"
                />
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition peer-checked:border-[#7c3aed] peer-checked:bg-[#7c3aed] peer-checked:text-white">
                  {BACKGROUND_LABELS[b]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Couleur d&apos;accent
          </legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <label key={a} className="cursor-pointer">
                <input
                  type="radio"
                  name="accent"
                  value={a}
                  checked={accent === a}
                  onChange={() => setAccent(a)}
                  className="peer sr-only"
                />
                <span
                  aria-label={a}
                  className="block size-9 rounded-full border-2 border-transparent transition peer-checked:border-white"
                  style={{ background: ACCENT_HEX[a] }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        {state.status === "error" ? (
          <p role="alert" className="text-xs text-red-500">
            {state.error}
          </p>
        ) : null}
        {state.status === "ok" ? (
          <p role="status" className="text-xs text-emerald-500">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-[#7c3aed] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9] disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer l'apparence"}
        </button>
      </div>

      <div className="flex items-start justify-center">
        <ProfilePreview
          username={username}
          displayName={displayName}
          background={background}
          accent={accent}
        />
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/appearance-form.tsx src/components/profile/profile-preview.tsx
git commit -m "$(cat <<'EOF'
feat(profile): AppearanceForm + ProfilePreview

Radio-based picker for background (4 options) and accent (6 colour
swatches), with a live mini preview to the right. Submits via the
updateAppearanceAction server action and shows inline ok/error
state. The form is meant to be wrapped in <PremiumGate> by the
caller.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Feature B render — apply background + accent on `/u/[username]`

**Files:**
- Modify: `src/app/u/[username]/page.tsx`

- [ ] **Step 1: Wire the appearance settings into the page render**

Edit `src/app/u/[username]/page.tsx`.

1. Add imports:

```ts
import { ACCENT_HEX, isAccent, isBackground } from "@/lib/profile/appearance";
import { AlbumWall } from "@/components/album-wall";
import { getWallCovers } from "@/db/queries/wall-covers";
import { periodSince } from "@/lib/stats/period";
```

2. After fetching `profile` (and verifying it's not null), look up `profileSettings` :

```ts
// `getPublicProfileByUsername` returns the short summary used by the rest of the
// page — we need a fresh DB hit for the appearance settings.
const settingsRow = await db.query.users.findFirst({
  where: eq(users.id, profile.id),
  columns: { profileSettings: true },
});
const settings = settingsRow?.profileSettings ?? {};
const background = isBackground(settings.background) ? settings.background : "mesh";
const accent = isAccent(settings.accent) ? settings.accent : "violet";
const accentHex = ACCENT_HEX[accent];
```

(Add `import { db } from "@/db/client";`, `import { users } from "@/db/schema";`, `import { eq } from "drizzle-orm";` if not already present.)

3. If `background === "wall"`, fetch covers (reuse the same query the share-card route uses):

```ts
const wallCovers =
  background === "wall"
    ? await getWallCovers(profile.id, periodSince("1y"), 40)
    : [];
const paddedCovers: (string | null)[] = [
  ...wallCovers,
  ...Array<string | null>(Math.max(0, 40 - wallCovers.length)).fill(null),
];
```

4. Set the inline style on the `<main>` element to apply background + accent:

```tsx
const mainStyle: React.CSSProperties = {
  // Allow children to read the accent via var(--ls-accent, #7c3aed)
  ["--ls-accent" as string]: accentHex,
  ...(background === "mesh"
    ? {
        background:
          "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.55), transparent 50%), radial-gradient(circle at 80% 30%, rgba(236,72,153,0.35), transparent 55%), #070710",
      }
    : background === "noir"
      ? { background: "#070710" }
      : background === "mauve"
        ? { background: "linear-gradient(135deg, #2a1a40 0%, #070710 100%)" }
        : { background: "#070710" }),
};
```

5. Render the `<AlbumWall>` if `background === "wall"`, before the existing content :

```tsx
{background === "wall" ? <AlbumWall covers={paddedCovers} /> : null}
<main id="main" className="..." style={mainStyle}>
  ...
</main>
```

6. Replace hardcoded `#7c3aed` colour references in this page (notably the "Public" badge background, the "Tu visites ton propre profil" banner border/background, and the "Modifier mes réglages" link colour) with the `--ls-accent` CSS variable. Two CSS techniques :

- **Solid uses** (text colour, full opacity background, border) → `style={{ color: "var(--ls-accent, #7c3aed)" }}` works directly.
- **Translucent uses** (a soft 10%-alpha background pill) → CSS `color-mix()` mixes the CSS var with transparent : `style={{ background: "color-mix(in srgb, var(--ls-accent, #7c3aed) 15%, transparent)" }}`. Widely supported in modern browsers.

Example for the "Public" pill (replace the existing `bg-[#7c3aed]/10 text-[#c4b5fd]` Tailwind classes with inline style) :

```tsx
<span
  style={{
    background: "color-mix(in srgb, var(--ls-accent, #7c3aed) 15%, transparent)",
    color: "var(--ls-accent, #7c3aed)",
  }}
  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
>
  Public
</span>
```

Same `color-mix()` pattern for the banner background (`30%` alpha border, `10%` alpha background). Anywhere a Tailwind arbitrary `bg-[#7c3aed]/10` was used, swap to inline style — Tailwind arbitrary classes can't read CSS variables at build time.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Smoke test**

Set custom appearance for judescha in DB :

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET profile_settings = jsonb_build_object('background', 'wall', 'accent', 'rose') WHERE username='judescha';"
```

Visit `/u/judescha` in a browser → expect wall background + rose accent on the badge.

Restore default :

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET profile_settings = '{}'::jsonb WHERE username='judescha';"
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/u/[username]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(profile): apply background + accent on /u/<username>

Reads profile_settings.background and .accent on every page render
(falling back to mesh/violet for free / unconfigured profiles).
Sets the --ls-accent CSS variable on <main> so all colour-bound
elements inherit. background=wall renders the existing <AlbumWall>
collage using the same wall-covers query the share cards use.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Sidebar Premium nav + layout `billingState`

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add Crown to lucide imports**

Edit `src/components/sidebar.tsx`. Append `Crown` to the lucide-react import (alphabetically):

```ts
import {
  Album,
  Clock,
  Crown,
  Download,
  Home,
  Music2,
  Settings,
  Users,
  UserSearch,
} from "lucide-react";
```

- [ ] **Step 2: Accept a `billingTier` prop and render the dynamic nav item**

Extend the Sidebar signature:

```ts
import type { BillingState } from "@/db/queries/billing";

export function Sidebar({
  hasImported,
  username,
  isPublic,
  billingTier,
  premiumExpiresAt,
}: {
  hasImported: boolean;
  username?: string;
  isPublic?: boolean;
  billingTier?: BillingState["tier"];
  premiumExpiresAt?: Date;
}) {
```

Inside the function (above the `return` and after the existing pathname read), compute the trial countdown for label:

```ts
const trialDaysLeft =
  billingTier === "trial" && premiumExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (premiumExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;
```

In the `<nav>` block, AFTER the rendered `NAV_ITEMS` map and BEFORE the closing `</nav>`, insert a fixed Premium item :

```tsx
<Link
  href={billingTier && billingTier !== "free" ? "/settings/billing" : "/pricing"}
  aria-current={
    pathname === "/pricing" || pathname.startsWith("/settings/billing")
      ? "page"
      : undefined
  }
  className={cn(
    "mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
    pathname === "/pricing" || pathname.startsWith("/settings/billing")
      ? "bg-[#7c3aed] text-white font-medium"
      : billingTier === "free" || !billingTier
        ? "text-[#c4b5fd] hover:bg-white/5"
        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
  )}
>
  <Crown className="size-4 shrink-0" />
  {billingTier === "trial" && trialDaysLeft !== null
    ? `Essai · J-${trialDaysLeft}`
    : billingTier === "active"
      ? "Mon Premium"
      : billingTier === "past_due"
        ? "Paiement échoué"
        : billingTier === "canceled"
          ? "Premium · annulé"
          : "Premium"}
</Link>
```

- [ ] **Step 3: Update the root layout to pass billing state**

Edit `src/app/layout.tsx`. Add import:

```ts
import { getBillingState } from "@/db/queries/billing";
```

Update the `Promise.all` to also fetch `getBillingState`:

```ts
const [hasImported, profile, billingState] = userId
  ? await Promise.all([
      hasCompletedImport(userId),
      getProfile(userId),
      getBillingState(userId),
    ])
  : ([false, null, { tier: "free" as const }] as const);
```

And update the `<Sidebar>` call:

```tsx
<Sidebar
  hasImported={hasImported}
  username={profile?.username ?? undefined}
  isPublic={profile?.isPublic ?? false}
  billingTier={billingState.tier}
  premiumExpiresAt={
    billingState.tier === "trial"
      ? billingState.trialEndsAt
      : billingState.tier === "active"
        ? billingState.renewsAt
        : billingState.tier === "past_due" || billingState.tier === "canceled"
          ? billingState.expiresAt
          : undefined
  }
/>
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): dynamic Premium nav item

The new sidebar entry shows one of five labels depending on the
authenticated user's billing tier (free / trial · J-N / Mon Premium /
Paiement échoué / Premium · annulé) and links to either /pricing
(free) or /settings/billing (any subscribed tier). Root layout
fetches getBillingState in the same Promise.all as the existing
hasImported + profile reads.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: OwnProfileCard Premium badge + watermark hint + self-visit Premium banner

**Files:**
- Modify: `src/components/profile/own-profile-card.tsx`
- Modify: `src/app/u/[username]/page.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Pass `isPremium` to OwnProfileCard**

Edit `src/components/profile/own-profile-card.tsx`. Replace the props signature:

```ts
export function OwnProfileCard({
  profile,
  isPremium,
}: {
  profile: ProfileRow | null;
  isPremium: boolean;
}) {
```

In the **public** branch (the one with the green Public pill), inside the existing badge container, append:

```tsx
{isPremium ? (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed]/15 px-2.5 py-0.5 text-xs font-medium text-[#c4b5fd]">
    <Crown className="size-3" />
    Premium
  </span>
) : null}
```

(Add `import { Crown } from "lucide-react";` next to the existing `ExternalLink` import.)

In the same public branch, AFTER the URL `<p>` and BEFORE the action buttons row, if `!isPremium` add a discreet hint:

```tsx
{!isPremium ? (
  <p className="text-xs text-muted-foreground">
    💡 Passe Premium pour retirer le watermark des cartes téléchargées ·{" "}
    <Link href="/pricing" className="underline hover:text-foreground">
      Découvrir →
    </Link>
  </p>
) : null}
```

- [ ] **Step 2: Update the dashboard to pass the new prop**

Edit `src/app/dashboard/page.tsx`. Add to the imports:

```ts
import { isPremium } from "@/db/queries/billing";
```

In the `Promise.all`, add a 6th fetch :

```ts
const [totals, topTracks, topArtists, topTracks1y, profile, premium] =
  await Promise.all([
    getListeningTotals(userId),
    fetchTopTracks(userId, "4w").catch(() => []),
    fetchTopArtists(userId, "4w").catch(() => []),
    fetchTopTracks(userId, "1y").catch(() => []),
    getProfile(userId),
    isPremium(userId),
  ]);
```

Update the `<OwnProfileCard>` call:

```tsx
<OwnProfileCard profile={profile} isPremium={premium} />
```

- [ ] **Step 3: Upgrade the self-visit banner on `/u/[username]`**

Edit `src/app/u/[username]/page.tsx`. Add import:

```ts
import { isPremium } from "@/db/queries/billing";
```

After the `const isOwnProfile = ...` line, add:

```ts
const ownerIsPremium = await isPremium(profile.id);
```

Update the existing self-visit `<aside>` to show a Premium variant when applicable:

```tsx
{isOwnProfile ? (
  ownerIsPremium ? (
    <aside
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-3 text-sm"
    >
      <span>
        👑 Profil Premium · c&apos;est ce que voient les autres.
      </span>
      <Link
        href="/settings"
        className="font-medium text-[#c4b5fd] hover:underline"
      >
        Modifier mes réglages →
      </Link>
    </aside>
  ) : (
    <aside
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-3 text-sm"
    >
      <span>
        👤 Tu visites ton propre profil — c&apos;est ce que voient les autres.
      </span>
      <Link
        href="/settings"
        className="font-medium text-[#c4b5fd] hover:underline"
      >
        Modifier mes réglages →
      </Link>
    </aside>
  )
) : null}
```

- [ ] **Step 4: Wire the Apparence section + Abonnement link in /settings**

Edit `src/app/settings/page.tsx`. Add imports:

```ts
import Link from "next/link";

import { AppearanceForm } from "@/components/profile/appearance-form";
import { PremiumGate } from "@/components/premium-gate";
import { isPremium } from "@/db/queries/billing";
import { isAccent, isBackground } from "@/lib/profile/appearance";
```

In the `SettingsPage` server component, after the existing user row fetch, add:

```ts
const premium = await isPremium(session.user.id);
const settings = userRow?.profileSettings ?? {};
const initialBackground = isBackground(settings.background) ? settings.background : "mesh";
const initialAccent = isAccent(settings.accent) ? settings.accent : "violet";
```

(Make sure `userRow` includes `profileSettings` in its `columns: { … }` selection — add it if not.)

In the JSX, BETWEEN the "Profil public" section and the "Compte" section, add:

```tsx
<section>
  <h2 className="mb-2 text-lg font-semibold">Apparence du profil</h2>
  <p className="mb-4 text-sm text-muted-foreground">
    Customise le fond et la couleur d&apos;accent de ton profil public.
  </p>
  <PremiumGate isPremium={premium}>
    {userRow?.username ? (
      <AppearanceForm
        username={userRow.username}
        displayName={displayName}
        initialBackground={initialBackground}
        initialAccent={initialAccent}
      />
    ) : (
      <p className="text-sm text-muted-foreground">
        Choisis d&apos;abord un pseudo dans la section &quot;Profil public&quot;
        ci-dessus.
      </p>
    )}
  </PremiumGate>
</section>
```

In the existing "Compte" section, BELOW the `<DeleteAccountForm />`, add the abonnement link:

```tsx
<Link
  href="/settings/billing"
  className="self-start text-sm text-[#c4b5fd] hover:underline"
>
  Mon abonnement →
</Link>
```

- [ ] **Step 5: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/own-profile-card.tsx src/app/dashboard/page.tsx 'src/app/u/[username]/page.tsx' src/app/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(profile,settings): Premium-aware UI touches

OwnProfileCard gains a "Premium" pill and a "passe Premium pour
retirer le watermark" hint (free only). /u/<self> banner switches
copy between the generic and "👑 Profil Premium" variant.
/settings gains a PremiumGate-wrapped Apparence section (using
AppearanceForm) and a "Mon abonnement →" link to /settings/billing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: End-to-end manual verification

No new files. Walk through the full flow.

- [ ] **Step 1: Pre-requisites**

- Stripe Dashboard set up per `docs/stripe-setup.md` (test mode).
- `.env.local` updated with `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`.
- In a separate terminal: `stripe listen --forward-to localhost:3000/api/stripe/webhook` (copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`).

- [ ] **Step 2: Public unauth flow**

- Visit `/pricing` not logged in → page renders, CTA says "Se connecter pour essayer →".
- Click → lands on `/login?next=/pricing` (Spotify OAuth).

- [ ] **Step 3: Authenticated free flow**

- Log in as judescha. Sidebar shows "Premium" (violet accent) → click → lands `/pricing`. CTA now "Essayer 14 jours gratuit".
- Toggle Mensuel ↔ Annuel → prix change. Annuel default.
- Click "Essayer 14 jours gratuit" → redirects to `checkout.stripe.com` with the loopstat Premium product, 14-day trial line, 20€/an line.
- Enter test card `4242 4242 4242 4242` + any future date + any CVC, validate.
- Browser redirected to `/checkout/success` (`session_id=...` in URL).
- `stripe listen` terminal shows the webhook events arrived.
- Click "Retour au dashboard" → sidebar Premium item now reads "Essai · J-14" → click → `/settings/billing` shows the trial card.

- [ ] **Step 4: Verify Premium gating live**

- `/dashboard` OwnProfileCard now shows the Premium pill, watermark hint is GONE.
- `/settings` → "Apparence du profil" no longer greyed. Pick `wall` background + `rose` accent → Enregistrer → ok message.
- Visit `/u/judescha` → wall background appears, "Public" badge is rose, banner says "👑 Profil Premium…".
- Download a card from `/share` (any format) → PNG has no watermark.
- Inspect OG meta: `curl -s http://127.0.0.1:3000/u/judescha | grep -oE '<meta property="og:image"[^>]+>'` → confirm the og:image URL exists (the actual rendered PNG won't have a watermark thanks to Task 11's gating in opengraph-image.tsx).

- [ ] **Step 5: Customer Portal**

- `/settings/billing` → click "Gérer mon abonnement" → redirects to Stripe Customer Portal.
- From the portal: cancel the subscription.
- Stripe sends `customer.subscription.updated` (cancel_at_period_end=true). Webhook logs in `stripe listen` show event received.
- Back on `/settings/billing` → state now "Premium · annulé · accès maintenu jusqu'au …".
- Sidebar item label changes to "Premium · annulé".

- [ ] **Step 6: Anti-leak smoke test**

- DB: confirm judescha is canceled but `premium_until` is in the future → isPremium still returns true → cards still clean ✓.
- Force expiry to simulate downgrade :
  ```bash
  docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
    "UPDATE users SET premium_until = NOW() - INTERVAL '1 day' WHERE username='judescha';"
  ```
- Refresh `/dashboard` → OwnProfileCard back to "Premium hint" message; Apparence section is greyed out again.
- BUT: `/u/judescha` still shows the wall+rose visuals (we preserve persisted config — downgrade UX).
- Download a card → watermark BACK.

- [ ] **Step 7: Restore + final state**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET premium_status=NULL, premium_until=NULL, stripe_subscription_id=NULL, profile_settings='{}'::jsonb WHERE username='judescha';"
```

(Keep `stripe_customer_id` — that's fine, will be reused if the user re-subscribes.)

- [ ] **Step 8: Branch hygiene**

```bash
git status
git log --oneline main..feat/stripe-premium | wc -l
pnpm typecheck && pnpm lint && pnpm test
```

Expected: clean working tree (apart from unrelated Dockerfile + .superpowers + scripts untracked), 16 commits on the feature branch, all checks green.

---

## Out-of-scope (do NOT add)

- Page upgrade-prompts contextuelles (modal "cette feature est Premium" on specific actions)
- Multi-currency (USD/GBP)
- Cadeau d'abonnement (gift)
- Promo codes manuels (au-delà du free trial 14j)
- Referral / parrainage
- Plusieurs tiers (Basic/Pro)
- Annual savings calculator interactif
- Pricing page testimonials
- Exports HD sans watermark (séparé du no-watermark générique)
- Custom couleurs/polices DANS les share cards (l'éditeur /share existant ne change pas dans ce spec)
- Notifications custom (rappel J-3 fin de trial : déjà géré par Stripe, pas de code app)
