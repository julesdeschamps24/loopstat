ALTER TABLE "albums" ADD COLUMN "deezer_id" integer;--> statement-breakpoint
CREATE INDEX "albums_deezer_id_idx" ON "albums" USING btree ("deezer_id");