-- Reset catalog (sub-projet C : Jules ré-importera son JSON Spotify)
TRUNCATE TABLE streams, track_artists, album_artists, tracks, albums, artists RESTART IDENTITY CASCADE;
--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "duration_ms";
--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "popularity";
--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "explicit";
--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "preview_url";
--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN "isrc";
--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "mbid" uuid;
--> statement-breakpoint
CREATE INDEX "albums_mbid_idx" ON "albums" USING btree ("mbid");
--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "mbid" uuid;
--> statement-breakpoint
CREATE INDEX "artists_mbid_idx" ON "artists" USING btree ("mbid");
--> statement-breakpoint
ALTER TABLE "artists" DROP COLUMN "popularity";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "spotify_id";
--> statement-breakpoint
DROP TABLE "spotify_tokens";
