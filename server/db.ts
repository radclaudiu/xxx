import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Esto es necesario para Neon Serverless
neonConfig.webSocketConstructor = ws;

// Crear equivalente a __dirname para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archivo para almacenar la configuración de la base de datos
const dbConfigPath = path.join(__dirname, '..', 'db-config.json');

// Estructura de configuración de la base de datos
interface DbConfig {
  DATABASE_URL: string;
  PGDATABASE?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGPASSWORD?: string;
  PGUSER?: string;
}

// Función para obtener la configuración actual de la base de datos
export function getDbConfig(): DbConfig {
  // Configuración por defecto
  const defaultConfig: DbConfig = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    PGDATABASE: process.env.PGDATABASE,
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGPASSWORD: process.env.PGPASSWORD,
    PGUSER: process.env.PGUSER,
  };

  // Intentar leer la configuración guardada
  try {
    if (existsSync(dbConfigPath)) {
      const savedConfig = JSON.parse(readFileSync(dbConfigPath, 'utf8'));
      return savedConfig;
    }
  } catch (error) {
    console.error('Error al leer la configuración de la base de datos:', error);
  }

  return defaultConfig;
}

// Función para guardar la configuración de la base de datos
export function saveDbConfig(config: DbConfig): void {
  try {
    writeFileSync(dbConfigPath, JSON.stringify(config, null, 2));
    // Actualizar variables de entorno para la sesión actual
    process.env.DATABASE_URL = config.DATABASE_URL;
    if (config.PGDATABASE) process.env.PGDATABASE = config.PGDATABASE;
    if (config.PGHOST) process.env.PGHOST = config.PGHOST;
    if (config.PGPORT) process.env.PGPORT = config.PGPORT;
    if (config.PGPASSWORD) process.env.PGPASSWORD = config.PGPASSWORD;
    if (config.PGUSER) process.env.PGUSER = config.PGUSER;
  } catch (error) {
    console.error('Error al guardar la configuración de la base de datos:', error);
  }
}

// Función para reinicializar las conexiones de la base de datos
export function initializeDbConnection() {
  // Obtener la configuración actual
  const config = getDbConfig();

  // Verificar que la URL de la base de datos está definida
  if (!config.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL debe estar definida. ¿Olvidaste aprovisionar una base de datos?"
    );
  }

  // Crear nuevo pool de conexiones
  const newPool = new Pool({ connectionString: config.DATABASE_URL });
  
  // Crear nuevo cliente Drizzle
  const newDb = drizzle(newPool, { schema });
  
  return { pool: newPool, db: newDb };
}

// Inicializar conexiones
const connection = initializeDbConnection();
export const pool = connection.pool;
export const db = connection.db;