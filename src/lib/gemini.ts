import { GoogleGenAI, Type } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ParsedFood {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  verification_summary: string;
}

const foodSchema = {
  type: Type.OBJECT,
  properties: {
    food_name: {
      type: Type.STRING,
      description: "Comma-separated list of food items",
    },
    calories: {
      type: Type.NUMBER,
      description: "Estimated total calories",
    },
    protein_g: {
      type: Type.NUMBER,
      description: "Estimated protein in grams",
    },
    carbs_g: {
      type: Type.NUMBER,
      description: "Estimated carbohydrates in grams",
    },
    fat_g: {
      type: Type.NUMBER,
      description: "Estimated fat in grams",
    },
    verification_summary: {
      type: Type.STRING,
      description:
        "A brief explanation of how the macros were calculated, referencing standard USDA nutritional data. Explain the breakdown per food item.",
    },
  },
  required: [
    "food_name",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "verification_summary",
  ],
};

export async function parseFoodWithGemini(text: string): Promise<ParsedFood> {
  const response = await genai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: `You are a deterministic nutritional calculator. Using standardized USDA average nutritional data, parse the following food description into exact macro values. Do not estimate wildly — use well-known averages per item. Provide a verification summary explaining the source of each number.\n\nFood description: "${text}"`,
    config: {
      temperature: 0.0,
      responseMimeType: "application/json",
      responseSchema: foodSchema,
    },
  });

  const raw = response.text ?? "";
  const parsed = JSON.parse(raw) as ParsedFood;
  return {
    food_name: String(parsed.food_name),
    calories: Number(parsed.calories),
    protein_g: Number(parsed.protein_g),
    carbs_g: Number(parsed.carbs_g),
    fat_g: Number(parsed.fat_g),
    verification_summary: String(parsed.verification_summary),
  };
}
