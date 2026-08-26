import { NextResponse } from "next/server";
import { parseFoodWithGemini } from "@/lib/gemini";
import { db } from "@/lib/db";

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

    const cacheKey = normalizeInput(text);

    // Check local cache first (only available in the browser via IndexedDB)
    if (db?.foodCache) {
      const cached = await db.foodCache.get(cacheKey);
      if (cached) {
        const macros = JSON.parse(cached.macros);
        return NextResponse.json(macros);
      }
    }

    // Cache miss — call Gemini
    const parsed = await parseFoodWithGemini(text.trim());

    // Store in cache (only available in the browser via IndexedDB)
    if (db?.foodCache) {
      await db.foodCache.put({
        key: cacheKey,
        macros: JSON.stringify(parsed),
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("parse-food error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to parse food.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
