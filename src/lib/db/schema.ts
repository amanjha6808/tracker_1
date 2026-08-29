import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── food_logs table ───
export const foodLogs = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  log_date: text("log_date").notNull(),
  food_name: text("food_name").notNull(),
  calories: integer("calories").notNull(),
  protein_g: integer("protein_g").notNull(),
  carbs_g: integer("carbs_g").notNull(),
  fat_g: integer("fat_g").notNull(),
  verification_summary: text("verification_summary"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FoodLog = typeof foodLogs.$inferSelect;
export type NewFoodLog = typeof foodLogs.$inferInsert;