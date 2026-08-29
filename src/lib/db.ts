// Re-export the Neon/Drizzle-backed database layer.
export { db } from "@/lib/db/index";
export { foodLogs } from "@/lib/db/schema";
export type { FoodLog, NewFoodLog } from "@/lib/db/schema";

// ─── Utility Functions ───

export function calculateLeanBulkTargets(weightKg: number) {
  return {
    calories: Math.round(weightKg * 33),
    protein: Math.round(weightKg * 2),
    carbs: Math.round(weightKg * 4),
    fat: Math.round(weightKg * 0.9),
  };
}

export function getCustomFitnessDate(date: Date = new Date()): string {
  const d = new Date(date);
  if (d.getHours() < 3) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayFitnessDate(): string {
  return getCustomFitnessDate(new Date());
}

export function shiftFitnessDate(dateStr: string, days: number): string {
  if (!dateStr) return getTodayFitnessDate();
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}