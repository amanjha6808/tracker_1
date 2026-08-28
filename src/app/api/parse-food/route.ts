import { NextResponse } from "next/server";
import { parseFoodWithGemini } from "@/lib/gemini";

/**
 * Normalize input for consistent cache keying:
 * trim, lowercase, collapse whitespace.
 */
function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body as { text?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a food description." },
        { status: 400 }
      );
    }

    // Call Gemini to parse the food
    const parsed = await parseFoodWithGemini(text.trim());

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("parse-food error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to parse food.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
