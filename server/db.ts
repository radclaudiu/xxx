import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Esto es necesario para Neon Serverless
neonConfig.webSocketConstructor = ws;

// Verificar que la URL de la base de datos está definida
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL debe estar definida. ¿Olvidaste aprovisionar una base de datos?"
  );
}

// Crear pool de conexiones
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Crear cliente Drizzle
export const db = drizzle(pool, { schema });