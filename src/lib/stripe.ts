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
  ? new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" })
  : null;

/**
 * Get the persisted Stripe customer id for a user, or create one and
 * persist it. Email is best-effort (DB column may be null for older
 * accounts). Throws if Stripe is not configured.
 *
 * Handles the concurrent-checkout race: if two requests both pass the
 * "no existing customer" check and both call stripe.customers.create,
 * only one UPDATE will land thanks to the UNIQUE constraint on
 * stripe_customer_id. The other catches the unique violation, re-reads
 * the now-persisted customer id, and discards its own orphan Stripe
 * customer (best-effort delete — Stripe doesn't bill on orphan customers
 * so a delete failure is acceptable).
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
    name: row.displayName ?? row.spotifyId ?? undefined,
    metadata: { userId },
  });

  try {
    await db
      .update(users)
      .set({ stripeCustomerId: customer.id })
      .where(eq(users.id, userId));
    return customer.id;
  } catch (err) {
    // Postgres unique_violation = 23505 — another request beat us.
    const isUniqueViolation =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505";
    if (!isUniqueViolation) throw err;

    // Re-read the winning customer id, and clean up our orphan Stripe customer.
    const reread = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { stripeCustomerId: true },
    });
    void stripe.customers.del(customer.id).catch(() => {
      /* orphan cleanup is best-effort */
    });
    if (!reread?.stripeCustomerId) {
      throw new Error("Race lost but no persisted customer id");
    }
    return reread.stripeCustomerId;
  }
}
