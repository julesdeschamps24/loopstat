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
