ALTER TABLE "artists" ADD COLUMN "deezer_id" integer;--> statement-breakpoint
CREATE INDEX "artists_deezer_id_idx" ON "artists" USING btree ("deezer_id");
