import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Wire the Neon HTTP driver to use the `ws` package (avoids browser-WS errors).
// We do this at module-evaluation time; the `ws` package is installed.
// The `require` here is safe because this file is only loaded server-side.
// eslint-disable-next-line @typescript-eslint/no-require-imports
neonConfig.webSocketConstructor = require("ws").default;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
export type { FoodLog, NewFoodLog } from "./schema";