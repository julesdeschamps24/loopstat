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
