import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db as firestore } from "./firebase";

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

// --- Firestore Types ---

export interface FoodLog {
  id: string;
  created_at: string;
  log_date: string; // YYYY-MM-DD (fitness day)
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  verification_summary: string;
}

/** Shape of documents stored in Firestore (no client-side `id` field). */
interface FoodLogDoc {
  created_at: string;
  log_date: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  verification_summary: string;
}

// --- Firestore CRUD ---

const FOOD_LOGS = "foodLogs";

/**
 * Subscribe to real-time updates for a given fitness date.
 * Returns an unsubscribe function. `onChange` is called with the latest list
 * of FoodLog entries (newest-first by `created_at`).
 */
export function subscribeFoodLogs(
  logDate: string,
  onChange: (logs: FoodLog[]) => void
): () => void {
  const q = query(
    collection(firestore, FOOD_LOGS),
    where("log_date", "==", logDate),
    orderBy("created_at", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const logs: FoodLog[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as FoodLogDoc),
    }));
    onChange(logs);
  });
}

/**
 * Add a new food log entry to Firestore.
 */
export async function addFoodLog(
  entry: Omit<FoodLogDoc, "created_at"> & { created_at?: string }
): Promise<string> {
  const docRef = await addDoc(collection(firestore, FOOD_LOGS), {
    ...entry,
    created_at: entry.created_at ?? new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Delete a food log entry by its Firestore document ID.
 */
export async function deleteFoodLog(id: string): Promise<void> {
  await deleteDoc(doc(firestore, FOOD_LOGS, id));
}
