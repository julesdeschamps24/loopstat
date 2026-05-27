DROP INDEX "albums_mbid_idx";--> statement-breakpoint
DROP INDEX "artists_mbid_idx";--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "album_type";--> statement-breakpoint
ALTER TABLE "albums" DROP COLUMN "mbid";--> statement-breakpoint
ALTER TABLE "artists" DROP COLUMN "mbid";