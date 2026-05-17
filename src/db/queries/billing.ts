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
