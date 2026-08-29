import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, foodLogs } from "@/lib/db/index";

// GET /api/logs?date=YYYY-MM-DD
// Returns all food logs for the given date, newest first.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "date query parameter is required" },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(foodLogs)
      .where(eq(foodLogs.log_date, date))
      .orderBy(desc(foodLogs.created_at));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/logs error:", err);
    return NextResponse.json(
      { error: "Failed to fetch food logs." },
      { status: 500 }
    );
  }
}

// POST /api/logs
// Inserts a new food log and returns the created row (with its id).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { log_date, food_name, calories, protein_g, carbs_g, fat_g, verification_summary } =
      body ?? {};

    if (
      !log_date ||
      !food_name ||
      calories == null ||
      protein_g == null ||
      carbs_g == null ||
      fat_g == null
    ) {
      return NextResponse.json(
        { error: "Missing required fields: log_date, food_name, calories, protein_g, carbs_g, fat_g" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(foodLogs)
      .values({
        log_date: String(log_date),
        food_name: String(food_name),
        calories: Number(calories),
        protein_g: Number(protein_g),
        carbs_g: Number(carbs_g),
        fat_g: Number(fat_g),
        verification_summary: verification_summary != null ? String(verification_summary) : undefined,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/logs error:", err);
    return NextResponse.json(
      { error: "Failed to create food log." },
      { status: 500 }
    );
  }
}

// DELETE /api/logs?id=XYZ
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json(
        { error: "Invalid id — must be a positive integer." },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(foodLogs)
      .where(eq(foodLogs.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "No food log found with that id." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deleted: deleted.id });
  } catch (err) {
    console.error("DELETE /api/logs error:", err);
    return NextResponse.json(
      { error: "Failed to delete food log." },
      { status: 500 }
    );
  }
}