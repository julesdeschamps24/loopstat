ALTER TABLE "users" DROP CONSTRAINT "users_spotify_id_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "spotify_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");