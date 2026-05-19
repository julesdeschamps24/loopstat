ALTER TABLE "artists" ADD COLUMN "tadb_id" integer;--> statement-breakpoint
CREATE INDEX "artists_tadb_id_idx" ON "artists" USING btree ("tadb_id");
