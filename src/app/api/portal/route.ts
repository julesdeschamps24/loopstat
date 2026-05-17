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
