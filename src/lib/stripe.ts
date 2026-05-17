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
