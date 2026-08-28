import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Interfaces ───
export interface FoodLog {
  id: string;
  log_date: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  verification_summary?: string;
  created_at?: string;
}

// ─── Firestore Subscriptions & Mutations ───
export function subscribeFoodLogs(
  dateString: string,
  callback: (logs: FoodLog[]) => void
) {
  // Query ONLY by log_date — no orderBy (bypasses index requirement)
  const q = query(
    collection(db, "foodLogs"),
    where("log_date", "==", dateString)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FoodLog, "id">),
      }));

      // Sort client-side by created_at (newest first)
      logs.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      callback(logs);
    },
    (error) => {
      console.error("Firestore subscription error:", error);
    }
  );
}

export async function addFoodLog(log: Omit<FoodLog, "id">) {
  return await addDoc(collection(db, "foodLogs"), {
    ...log,
    created_at: new Date().toISOString(),
  });
}

export async function deleteFoodLog(id: string) {
  return await deleteDoc(doc(db, "foodLogs", id));
}

// ─── Missing Exports & Utility Functions ───

export function calculateLeanBulkTargets(weightKg: number) {
  return {
    calories: Math.round(weightKg * 33),
    protein: Math.round(weightKg * 2),
    carbs: Math.round(weightKg * 4),
    fat: Math.round(weightKg * 0.9),
  };
}

// ✅ CORRECT:
export function getCustomFitnessDate(date: Date = new Date()): string {
  const d = new Date(date);
  if (d.getHours() < 3) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0"); // <-- MUST be getDate()
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