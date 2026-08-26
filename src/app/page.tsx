"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type FoodLog,
  calculateLeanBulkTargets,
  getCustomFitnessDate,
  getTodayFitnessDate,
  shiftFitnessDate,
  formatDateDisplay,
} from "@/lib/db";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  Plus,
  Mic,
  MicOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Beef,
  Wheat,
  Droplets,
  UtensilsCrossed,
  Loader2,
  ShieldCheck,
  User,
  Target,
} from "lucide-react";

// ─── Progress Bar ───
const BAR_COLORS: Record<string, { label: string; bar: string }> = {
  orange: { label: "text-orange-400", bar: "bg-orange-400" },
  red: { label: "text-red-400", bar: "bg-red-400" },
  amber: { label: "text-amber-400", bar: "bg-amber-400" },
  blue: { label: "text-blue-400", bar: "bg-blue-400" },
};

function ProgressBar({
  label,
  icon,
  color,
  current,
  target,
  unit,
}: {
  label: string;
  icon: React.ReactNode;
  color: keyof typeof BAR_COLORS;
  current: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;
  const c = BAR_COLORS[color];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <span className={c.label}>{icon}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="text-[11px] tabular-nums text-zinc-400">
          {current}
          <span className="text-zinc-600">/{target}</span>
          {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            over ? "bg-red-500/70" : c.bar
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Meal Log Item ───
function MealItem({
  log,
  onDelete,
}: {
  log: FoodLog;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-3 py-2.5 transition-colors hover:bg-zinc-900/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-200">
          {log.food_name}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
          <span className="text-zinc-300">{log.calories} kcal</span>
          <span>P {log.protein_g}g</span>
          <span>C {log.carbs_g}g</span>
          <span>F {log.fat_g}g</span>
        </div>
      </div>
      <button
        onClick={() => log.id != null && onDelete(log.id)}
        className="mt-0.5 shrink-0 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete meal"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Main Page ───
export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayFitnessDate);
  const [todayDate, setTodayDate] = useState(getTodayFitnessDate);
  const [weightKg, setWeightKg] = useState(61);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (transcript) {
      setInputText((prev) => (prev ? prev + " " + transcript : transcript));
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Live query logs for the selected date
  // Guard: skip IndexedDB during SSR so Dexie never touches window.indexedDB
  const logs =
    useLiveQuery<FoodLog[]>(
      () => {
        if (typeof window === "undefined" || !db?.foodLogs) return [];
        return db.foodLogs
          .where("log_date")
          .equals(selectedDate)
          .reverse()
          .sortBy("id");
      },
      [selectedDate]
    ) ?? [];

  // Compute totals
  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein_g,
      carbs: acc.carbs + log.carbs_g,
      fat: acc.fat + log.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const targets = calculateLeanBulkTargets(weightKg);
  const latestLog = logs.length > 0 ? logs[0] : null;

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayDate(getTodayFitnessDate());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isToday = selectedDate === todayDate;
  const displayDate = isMounted
    ? isToday
      ? `Today · ${formatDateDisplay(selectedDate)}`
      : formatDateDisplay(selectedDate)
    : "";

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setLoadingMsg("Analyzing your meal...");

    try {
      const res = await fetch("/api/parse-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse food.");
      const parsed = data;

      if (typeof window !== "undefined" && db?.foodLogs) {
        await db.foodLogs.add({
          created_at: new Date().toISOString(),
          log_date: getCustomFitnessDate(new Date()),
          food_name: parsed.food_name,
          calories: parsed.calories,
          protein_g: parsed.protein_g,
          carbs_g: parsed.carbs_g,
          fat_g: parsed.fat_g,
          verification_summary: parsed.verification_summary ?? "",
        });
      }

      setInputText("");
      setSelectedDate(getCustomFitnessDate(new Date()));
    } catch (err) {
      console.error(err);
      setLoadingMsg("Something went wrong. Try again.");
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      setIsLoading(false);
      setLoadingMsg("");
    }
  }, [inputText, isLoading]);

  const handleDelete = useCallback(async (id: number) => {
    if (typeof window !== "undefined" && db?.foodLogs) {
      await db.foodLogs.delete(id);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // ─── Skeleton for SSR (avoids hydration mismatch) ───
  if (!isMounted) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-8">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-[#09090b]/90 py-4 backdrop-blur-md">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            MacroTrack
          </h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-8">
      {/* ─── Global Header ─── */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#09090b]/90 py-4 backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
          MacroTrack
        </h1>
        <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-0.5">
          <button
            onClick={() => setSelectedDate((d) => shiftFitnessDate(d, -1))}
            className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[6rem] text-center text-xs font-medium text-zinc-300">
            {isToday ? "Today" : formatDateDisplay(selectedDate)}
          </span>
          <button
            onClick={() =>
              setSelectedDate((d) =>
                shiftFitnessDate(d, 1) <= todayDate
                  ? shiftFitnessDate(d, 1)
                  : d
              )
            }
            disabled={isToday}
            className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* ─── Date subtitle (mobile only) ─── */}
      <p className="mb-4 text-[11px] text-zinc-500 lg:hidden">{displayDate}</p>

      {/* ─── 3-Column Dashboard ─── */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ═══ LEFT COLUMN — Profile & Targets ═══ */}
        <aside className="flex flex-col gap-4 lg:col-span-3">
          {/* Profile Card */}
          <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            {/* Avatar */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-700/50">
              <User size={28} className="text-zinc-500" />
            </div>

            {/* User Info */}
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-200">Athlete</p>
              <span className="mt-1 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Lean Bulk
              </span>
            </div>

            {/* Stats */}
            <div className="w-full space-y-2">
              {/* Height */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2">
                <span className="text-[11px] text-zinc-500">Height</span>
                <span className="text-xs font-medium text-zinc-300">
                  5&apos;11&quot;
                </span>
              </div>

              {/* Weight (adjustable) */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2">
                <span className="text-[11px] text-zinc-500">Weight</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="h-1 w-20 cursor-pointer accent-emerald-500"
                  />
                  <span className="min-w-[3rem] text-right text-xs font-medium tabular-nums text-zinc-300">
                    {weightKg} kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Target Macro Progress */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <Target size={13} className="text-emerald-500" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Daily Targets
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <ProgressBar
                label="Calories"
                icon={<Flame size={12} />}
                color="orange"
                current={totals.calories}
                target={targets.calories}
                unit=" kcal"
              />
              <ProgressBar
                label="Protein"
                icon={<Beef size={12} />}
                color="red"
                current={totals.protein}
                target={targets.protein}
                unit="g"
              />
              <ProgressBar
                label="Carbs"
                icon={<Wheat size={12} />}
                color="amber"
                current={totals.carbs}
                target={targets.carbs}
                unit="g"
              />
              <ProgressBar
                label="Fat"
                icon={<Droplets size={12} />}
                color="blue"
                current={totals.fat}
                target={targets.fat}
                unit="g"
              />
            </div>
          </div>
        </aside>

        {/* ═══ CENTER COLUMN — Food Tracker ═══ */}
        <main className="flex flex-col gap-4 lg:col-span-6">
          {/* Date subtitle (desktop) */}
          <p className="hidden text-[11px] text-zinc-500 lg:block">
            {displayDate}
          </p>

          {/* Input Section */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What did you eat?"
                rows={1}
                className="min-h-[40px] max-h-24 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />

              {isSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isListening
                      ? "bg-red-500/20 text-red-400"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                  aria-label={
                    isListening ? "Stop recording" : "Start voice input"
                  }
                >
                  {isListening && (
                    <span className="absolute inset-0 animate-pulse-ring rounded-lg bg-red-500/20" />
                  )}
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}

              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() || isLoading}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-3 text-xs font-semibold text-[#09090b] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                <span className="hidden sm:inline">Log Meal</span>
              </button>
            </div>

            {isListening && interimTranscript && (
              <p className="mt-1.5 px-1 text-xs italic text-zinc-600">
                {interimTranscript}…
              </p>
            )}

            {isLoading && loadingMsg && (
              <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-zinc-500">
                <Loader2 size={12} className="animate-spin" />
                {loadingMsg}
              </p>
            )}
          </div>

          {/* Meal History */}
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2">
              <UtensilsCrossed size={14} className="text-zinc-600" />
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Meals
              </h2>
              {logs.length > 0 && (
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {logs.length}
                </span>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800/60 py-12 text-center">
                <UtensilsCrossed size={24} className="text-zinc-700" />
                <p className="text-sm text-zinc-600">No meals logged yet</p>
                <p className="text-xs text-zinc-700">
                  Type or speak to log your first meal
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {logs.map((log) => (
                  <MealItem key={log.id} log={log} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ═══ RIGHT COLUMN — Gemini Verification ═══ */}
        <aside className="flex flex-col gap-4 lg:col-span-3">
          {/* Verification Card */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-violet-400" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Verified by Gemini
              </h2>
            </div>

            {latestLog && latestLog.verification_summary ? (
              <div className="space-y-3">
                {/* Latest meal label */}
                <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Latest meal
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">
                    {latestLog.food_name}
                  </p>
                </div>

                {/* Verification text */}
                <p className="text-xs leading-relaxed text-zinc-400">
                  {latestLog.verification_summary}
                </p>

                {/* Confidence badge */}
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <ShieldCheck size={10} />
                    Verified
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    Based on standard nutritional data
                  </span>
                </div>

                {/* Macro breakdown */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      label: "Calories",
                      value: latestLog.calories,
                      unit: "kcal",
                      color: "text-orange-400",
                    },
                    {
                      label: "Protein",
                      value: latestLog.protein_g,
                      unit: "g",
                      color: "text-red-400",
                    },
                    {
                      label: "Carbs",
                      value: latestLog.carbs_g,
                      unit: "g",
                      color: "text-amber-400",
                    },
                    {
                      label: "Fat",
                      value: latestLog.fat_g,
                      unit: "g",
                      color: "text-blue-400",
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg bg-zinc-800/40 px-2.5 py-1.5"
                    >
                      <p className="text-[10px] text-zinc-600">{m.label}</p>
                      <p className={`text-sm font-semibold tabular-nums ${m.color}`}>
                        {m.value}
                        <span className="text-[10px] font-normal text-zinc-600">
                          {" "}
                          {m.unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <ShieldCheck size={24} className="text-zinc-700" />
                <p className="text-xs text-zinc-600">
                  Log a meal to see Gemini&apos;s verification breakdown
                </p>
              </div>
            )}
          </div>

          {/* Today's Summary Card */}
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Today&apos;s Summary
            </h2>
            <div className="space-y-2">
              {[
                {
                  label: "Total Meals",
                  value: logs.length,
                  color: "text-zinc-200",
                },
                {
                  label: "Total Calories",
                  value: `${totals.calories} kcal`,
                  color: "text-orange-400",
                },
                {
                  label: "Protein",
                  value: `${totals.protein}g`,
                  color: "text-red-400",
                },
                {
                  label: "Carbs",
                  value: `${totals.carbs}g`,
                  color: "text-amber-400",
                },
                {
                  label: "Fat",
                  value: `${totals.fat}g`,
                  color: "text-blue-400",
                },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">{s.label}</span>
                  <span
                    className={`text-xs font-medium tabular-nums ${s.color}`}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Footer ─── */}
      <footer className="mt-8 border-t border-zinc-900 pt-4 text-center">
        <p className="text-[10px] text-zinc-700">
          MacroTrack · All data stored locally on your device
        </p>
      </footer>
    </div>
  );
}
