CREATE TABLE "album_artists" (
	"album_id" text NOT NULL,
	"artist_id" text NOT NULL,
	CONSTRAINT "album_artists_album_id_artist_id_pk" PRIMARY KEY("album_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"release_date" date,
	"image_url" text,
	"total_tracks" smallint,
	"album_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"popularity" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"files_count" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "spotify_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" "bytea" NOT NULL,
	"refresh_token" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"ms_played" integer,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_cache" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "top_cache_user_id_kind_period_pk" PRIMARY KEY("user_id","kind","period")
);
--> statement-breakpoint
CREATE TABLE "track_artists" (
	"track_id" text NOT NULL,
	"artist_id" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "track_artists_track_id_artist_id_pk" PRIMARY KEY("track_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"album_id" text,
	"duration_ms" integer,
	"popularity" smallint,
	"explicit" boolean,
	"preview_url" text,
	"isrc" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"country" text,
	"product" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_spotify_id_unique" UNIQUE("spotify_id")
);
--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_artists" ADD CONSTRAINT "album_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_tokens" ADD CONSTRAINT "spotify_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_cache" ADD CONSTRAINT "top_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "streams_user_played_at_idx" ON "streams" USING btree ("user_id","played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "streams_user_track_idx" ON "streams" USING btree ("user_id","track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_uniq_idx" ON "streams" USING btree ("user_id","played_at","track_id");--> statement-breakpoint
CREATE INDEX "track_artists_artist_idx" ON "track_artists" USING btree ("artist_id");