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
      // In Stripe API v22 (dahlia), current_period_end is on
      // SubscriptionItem, not the Subscription itself. Fall through:
      //   trial → first item's period → omit periodEnd entirely so
      //   updateBillingFromWebhook only patches the columns we have.
      const periodEndSec =
        sub.trial_end ?? sub.items.data[0]?.current_period_end;
      await updateBillingFromWebhook(sub.customer as string, {
        subscriptionId: sub.id,
        status: sub.status,
        periodEnd: periodEndSec ? new Date(periodEndSec * 1000) : undefined,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const endSec = sub.items.data[0]?.current_period_end;
      await updateBillingFromWebhook(sub.customer as string, {
        status: "canceled",
        // No-op periodEnd if Stripe omitted it on the deleted event —
        // the previously-persisted premiumUntil keeps governing access.
        periodEnd: endSec ? new Date(endSec * 1000) : undefined,
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
