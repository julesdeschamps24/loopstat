import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

export type ProfileSettings = {
  background?: "mesh" | "wall" | "noir" | "mauve";
  accent?: "violet" | "blue" | "rose" | "green" | "orange" | "mono";
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  spotifyId: text("spotify_id"),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  country: text("country"),
  product: text("product"),
  // Stocké en lowercase (validation côté server action). Nullable : seuls les
  // users qui activent leur profil public en choisissent un.
  username: text("username").unique(),
  isPublic: boolean("is_public").notNull().default(false),
  profileSettings: jsonb("profile_settings")
    .$type<ProfileSettings>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  premiumStatus: text("premium_status"),
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
});

export const spotifyTokens = pgTable("spotify_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: bytea("access_token").notNull(),
  refreshToken: bytea("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope"),
});

export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  genres: jsonb("genres").$type<string[]>().default([]).notNull(),
  popularity: smallint("popularity"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const albums = pgTable("albums", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  releaseDate: date("release_date"),
  imageUrl: text("image_url"),
  totalTracks: smallint("total_tracks"),
  albumType: text("album_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  albumId: text("album_id").references(() => albums.id, { onDelete: "set null" }),
  durationMs: integer("duration_ms"),
  popularity: smallint("popularity"),
  explicit: boolean("explicit"),
  previewUrl: text("preview_url"),
  isrc: text("isrc"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const trackArtists = pgTable(
  "track_artists",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.trackId, t.artistId] }),
    artistIdx: index("track_artists_artist_idx").on(t.artistId),
  }),
);

export const albumArtists = pgTable(
  "album_artists",
  {
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.albumId, t.artistId] }),
  }),
);

export const streams = pgTable(
  "streams",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    msPlayed: integer("ms_played"),
    source: text("source").notNull(),
  },
  (t) => ({
    userPlayedAtIdx: index("streams_user_played_at_idx").on(t.userId, t.playedAt.desc()),
    userTrackIdx: index("streams_user_track_idx").on(t.userId, t.trackId),
    uniqStream: uniqueIndex("streams_uniq_idx").on(t.userId, t.playedAt, t.trackId),
  }),
);

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    filesCount: integer("files_count").notNull().default(0),
    rowsImported: integer("rows_imported").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (t) => ({
    // Sert hasCompletedImport() : SELECT ... WHERE user_id = ? AND status = ? LIMIT 1.
    userStatusIdx: index("imports_user_status_idx").on(t.userId, t.status),
  }),
);

export const topCache = pgTable(
  "top_cache",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    period: text("period").notNull(),
    payload: jsonb("payload").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.kind, t.period] }),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Stream = typeof streams.$inferSelect;
export type NewStream = typeof streams.$inferInsert;
export type Track = typeof tracks.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type Album = typeof albums.$inferSelect;
