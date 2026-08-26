import Dexie, { type EntityTable } from "dexie";

// --- Fitness Date Helper (3:00 AM Cutoff) ---

/**
 * Returns the YYYY-MM-DD date string for the "fitness day" that contains
 * the given Date. A fitness day runs from 3:00 AM to 2:59 AM next day.
 * If the current time is before 3 AM, the date belongs to the previous day.
 */
export function getCustomFitnessDate(date: Date): string {
  const adjusted = new Date(date);
  if (adjusted.getHours() < 3) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get today's fitness date string.
 */
export function getTodayFitnessDate(): string {
  return getCustomFitnessDate(new Date());
}

/**
 * Shift a YYYY-MM-DD date string by `offset` days and return the new string.
 */
export function shiftFitnessDate(dateStr: string, offset: number): string {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid DST edge cases
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

/**
 * Format a YYYY-MM-DD date string for display (e.g. "Mon, Aug 25").
 */
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// --- Lean Bulk Macro Calculator ---

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Calculate daily macro targets for a lean bulk based on body weight (kg).
 * Uses ~35 kcal/kg, 2.2g protein/kg, remainder split ~50/20 carbs/fat.
 */
export function calculateLeanBulkTargets(weightKg: number): MacroTargets {
  const calories = Math.round(weightKg * 35);
  const protein = Math.round(weightKg * 2.2);
  const fat = Math.round((calories * 0.2) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { calories, protein, carbs, fat };
}

// --- Dexie Database ---

export interface FoodLog {
  id?: number;
  created_at: string;
  log_date: string; // YYYY-MM-DD (fitness day)
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  verification_summary: string;
}

export interface FoodCacheEntry {
  key: string; // trimmed lowercased input
  macros: string; // JSON string of ParsedFood
  created_at: string;
}

class MacroDatabase extends Dexie {
  foodLogs!: EntityTable<FoodLog, "id">;
  foodCache!: EntityTable<FoodCacheEntry, "key">;

  constructor() {
    super("MacroTrackerDB");

    this.version(1).stores({
      foodLogs: "++id, log_date, created_at",
    });

    this.version(2)
      .stores({
        foodLogs: "++id, log_date, created_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("foodLogs")
          .toCollection()
          .modify((log: any) => {
            log.verification_summary = log.verification_summary ?? "";
          });
      });

    this.version(3).stores({
      foodLogs: "++id, log_date, created_at",
      foodCache: "key",
    });
  }
}

// Only instantiate Dexie when running in the browser.
// On the server (SSR / Turbopack evaluation) window is undefined and
// IndexedDB does not exist, so we export an empty object instead.
export const db: MacroDatabase =
  typeof window !== "undefined"
    ? new MacroDatabase()
    : ({} as MacroDatabase);
