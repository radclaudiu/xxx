-- SQL Script para crear la estructura de la base de datos del Sistema de Turnos de Trabajo "CreaTurno"
-- Este script debe ejecutarse en PostgreSQL

-- Crear tablas en el orden correcto para respetar las dependencias

-- Tabla de usuarios (autenticación y permisos)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'user',      -- 'admin', 'user'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de empresas (entidad principal de organización)
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_id TEXT,
  start_hour INTEGER DEFAULT 9,      -- Hora de inicio de operaciones (por defecto 9:00)
  end_hour INTEGER DEFAULT 22,       -- Hora de fin de operaciones (por defecto 22:00)
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Tabla de relación usuario-empresa (permisos por empresa)
CREATE TABLE user_companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',     -- 'owner', 'admin', 'manager', 'member'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de plantillas de horario (para crear horarios predefinidos)
CREATE TABLE schedule_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,         -- Indica si es la plantilla por defecto
  start_hour INTEGER NOT NULL DEFAULT 8,    -- Hora de inicio por defecto (8am)
  end_hour INTEGER NOT NULL DEFAULT 20,     -- Hora de fin por defecto (8pm)
  time_increment INTEGER NOT NULL DEFAULT 15, -- Incremento de tiempo en minutos
  is_global BOOLEAN DEFAULT FALSE,          -- Si está disponible para todas las empresas
  company_id INTEGER REFERENCES companies(id), -- Nulo para plantillas globales
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de empleados (gestión del personal)
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  -- Identificación de empresa
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Información de contacto
  email TEXT,
  phone TEXT,
  address TEXT,
  -- Información laboral
  hire_date DATE,
  contract_type TEXT,                   -- Tiempo completo, medio tiempo, etc.
  hourly_rate INTEGER,                  -- Tarifa por hora
  max_hours_per_week INTEGER,           -- Máximo de horas que puede trabajar
  -- Preferencias y restricciones
  preferred_days TEXT,                  -- Días que prefiere trabajar (formato JSON)
  unavailable_days TEXT,                -- Días que no puede trabajar (formato JSON)
  is_active BOOLEAN DEFAULT TRUE,       -- Si el empleado está activo
  notes TEXT,                           -- Notas adicionales
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de habilidades (catálogo de habilidades)
CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Tabla de relación empleado-habilidad
CREATE TABLE employee_skills (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level INTEGER                        -- Nivel de habilidad 1-5
);

-- Tabla de ventas diarias estimadas (para planificación)
CREATE TABLE daily_sales (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                  -- Formato: YYYY-MM-DD
  estimated_sales NUMERIC,             -- Venta estimada para ese día
  hourly_employee_cost NUMERIC,        -- Coste por empleado por hora
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de horarios (para guardar/cargar horarios completos)
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  -- Relaciones de pertenencia
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES schedule_templates(id),
  -- Fechas y rango de aplicación
  start_date TEXT,                     -- Formato: YYYY-MM-DD
  end_date TEXT,                       -- Formato: YYYY-MM-DD
  -- Metadata
  status TEXT DEFAULT 'draft',         -- "draft", "published", "active", "archived"
  department TEXT,                     -- Departamento al que aplica el horario
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de turnos (shifts - asignaciones específicas de horarios)
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                  -- Formato: YYYY-MM-DD
  start_time TEXT NOT NULL,            -- Formato: HH:MM
  end_time TEXT NOT NULL,              -- Formato: HH:MM
  notes TEXT DEFAULT '',
  -- Campos adicionales
  status TEXT DEFAULT 'scheduled',     -- "scheduled", "completed", "cancelled", etc.
  break_time INTEGER,                  -- Tiempo de descanso en minutos
  actual_start_time TEXT,              -- Hora real de inicio
  actual_end_time TEXT,                -- Hora real de término
  total_hours INTEGER,                 -- Horas totales trabajadas
  schedule_id INTEGER REFERENCES schedules(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de sesiones (para gestión de sesiones en Express con connect-pg-simple)
CREATE TABLE session (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Añadir índices para mejorar el rendimiento

-- Índice para sesiones expiradas (para limpieza automática)
CREATE INDEX "IDX_session_expire" ON session(expire);

-- Índices para búsquedas frecuentes por empresa
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_schedules_company ON schedules(company_id);
CREATE INDEX idx_daily_sales_company ON daily_sales(company_id);

-- Índices para búsquedas de turnos por fecha y empleado
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_employee ON shifts(employee_id);
CREATE INDEX idx_daily_sales_date ON daily_sales(date);

-- Índices para relaciones usuario-empresa
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);

-- Crear usuario administrador por defecto (contraseña se debe cambiar)
INSERT INTO users (username, password, email, full_name, role)
VALUES ('admin', 'c45e8697d40ea7bc3f576421d143b070d752bac56a7d03017cb32e97632149fd.4813177185efec8f918c7d811974c9a0', 'admin@example.com', 'Administrador', 'admin');

-- Nota: La contraseña en el ejemplo está hasheada. La contraseña original es "admin123"
-- En producción, se recomienda cambiar esta contraseña inmediatamente después de la instalación