import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const wishesTable = pgTable("wishes", {
  id: serial("id").primaryKey(),
  wishText: text("wish_text").notNull(),
  songId: text("song_id").notNull(),
  songTitle: text("song_title").notNull(),
  worldId: text("world_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Wish = typeof wishesTable.$inferSelect;
export type InsertWish = typeof wishesTable.$inferInsert;
