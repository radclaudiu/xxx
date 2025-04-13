-- SQL Script para crear la estructura de la base de datos del Sistema de Turnos de Trabajo
-- Este script debe ejecutarse en PostgreSQL

-- Crear tablas en el orden correcto para respetar las dependencias

-- Tabla de usuarios
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de empresas
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_id TEXT,
  start_hour INTEGER DEFAULT 9,
  end_hour INTEGER DEFAULT 22,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Tabla de relación usuario-empresa
CREATE TABLE user_companies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de plantillas de horario
CREATE TABLE schedule_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  start_hour INTEGER NOT NULL DEFAULT 8,
  end_hour INTEGER NOT NULL DEFAULT 20,
  time_increment INTEGER NOT NULL DEFAULT 15,
  is_global BOOLEAN DEFAULT FALSE,
  company_id INTEGER REFERENCES companies(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de empleados
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  address TEXT,
  hire_date DATE,
  contract_type TEXT,
  hourly_rate INTEGER,
  max_hours_per_week INTEGER,
  preferred_days TEXT,
  unavailable_days TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de habilidades
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
  level INTEGER
);

-- Tabla de horarios (schedules)
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES schedule_templates(id),
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'draft',
  department TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Tabla de turnos (shifts)
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled',
  break_time INTEGER,
  actual_start_time TEXT,
  actual_end_time TEXT,
  total_hours INTEGER,
  schedule_id INTEGER REFERENCES schedules(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Añadir índices para mejorar el rendimiento

-- Índices para búsquedas frecuentes por empresa
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_schedules_company ON schedules(company_id);

-- Índices para búsquedas de turnos por fecha y empleado
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_employee ON shifts(employee_id);

-- Índices para relaciones usuario-empresa
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);

-- Crear usuario administrador por defecto (contraseña se debe cambiar)
INSERT INTO users (username, password, email, full_name, role)
VALUES ('admin', 'c45e8697d40ea7bc3f576421d143b070d752bac56a7d03017cb32e97632149fd.4813177185efec8f918c7d811974c9a0', 'admin@example.com', 'Administrador', 'admin');

-- Nota: La contraseña en el ejemplo está hasheada. La contraseña original es "admin123"
-- En producción, se recomienda cambiar esta contraseña inmediatamente después de la instalación