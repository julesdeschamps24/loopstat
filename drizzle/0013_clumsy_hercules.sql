ALTER TABLE "users" DROP CONSTRAINT "users_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "premium_status";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "premium_until";