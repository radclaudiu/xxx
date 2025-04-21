# Configuración de la Base de Datos PostgreSQL

Este documento proporciona instrucciones detalladas para configurar la base de datos PostgreSQL para el Sistema de Turnos de Trabajo.

## Requisitos

- PostgreSQL 14 o superior
- Permisos de administrador para crear bases de datos y usuarios

## Instalación de PostgreSQL

### Windows

1. Descargar el instalador desde [postgresql.org](https://www.postgresql.org/download/windows/)
2. Ejecutar el instalador y seguir las instrucciones
3. Anotar la contraseña del usuario `postgres` durante la instalación
4. Seleccionar el puerto predeterminado (5432)

### macOS

Con Homebrew:
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Configuración de la Base de Datos

### 1. Crear Base de Datos y Usuario

Conéctate al servidor PostgreSQL con el usuario postgres:

```bash
sudo -u postgres psql
```

Crea un usuario para la aplicación:

```sql
CREATE USER app_user WITH PASSWORD 'tu_contraseña_segura';
```

Crea la base de datos:

```sql
CREATE DATABASE sistema_turnos;
```

Asigna permisos al usuario:

```sql
GRANT ALL PRIVILEGES ON DATABASE sistema_turnos TO app_user;
```

Sal de la consola de postgres:

```sql
\q
```

### 2. Importar Esquema de Base de Datos

Utiliza el archivo `database_schema.sql` para crear las tablas:

```bash
psql -U app_user -d sistema_turnos -f database_schema.sql
```

Si prefieres usar Drizzle ORM para sincronizar el esquema:

```bash
npm run db:push
```

## Estructura de la Base de Datos

El esquema incluye las siguientes tablas:

- **users**: Usuarios del sistema
- **companies**: Empresas/negocios
- **user_companies**: Relación entre usuarios y empresas
- **schedule_templates**: Plantillas de horarios
- **employees**: Empleados
- **skills**: Habilidades de empleados
- **employee_skills**: Relación entre empleados y habilidades
- **schedules**: Programaciones de horarios
- **shifts**: Turnos asignados

## Variables de Entorno

Configura la variable `DATABASE_URL` en tu archivo `.env` con el siguiente formato:

```
DATABASE_URL=postgresql://app_user:tu_contraseña_segura@localhost:5432/sistema_turnos
```

## Mantenimiento

### Respaldo de Base de Datos

Para crear un respaldo:

```bash
pg_dump -U app_user -d sistema_turnos > backup_$(date +%Y%m%d).sql
```

Para restaurar un respaldo:

```bash
psql -U app_user -d sistema_turnos < backup_archivo.sql
```

### Optimización

Para bases de datos más grandes, considera:

1. Configurar índices adicionales para mejoras de rendimiento
2. Implementar particionamiento para tablas grandes (especialmente shifts)
3. Configurar replicación para alta disponibilidad

## Solución de Problemas

### Error de Conexión

Verifica:
- El servicio de PostgreSQL está en ejecución
- Las credenciales son correctas
- El formato de la URL de conexión es correcto
- Los permisos del firewall permiten conexiones al puerto 5432

### Problema de Permisos

Si encuentras errores de permisos:

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### Rendimiento Lento

Si la base de datos tiene un rendimiento lento:

1. Actualiza las estadísticas:
```sql
VACUUM ANALYZE;
```

2. Verifica los índices:
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'shifts';
```

3. Considera añadir índices adicionales en campos frecuentemente consultados