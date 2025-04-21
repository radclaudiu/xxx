# Instrucciones de Instalación y Ejecución Local

Este documento proporciona las instrucciones necesarias para configurar y ejecutar el Sistema de Turnos de Trabajo de forma local.

## Requisitos del Sistema

- Node.js (versión 18 o superior)
- npm (versión 8 o superior) 
- PostgreSQL (versión 14 o superior)

## Pasos para la Instalación

### 1. Clonar el Repositorio

```bash
git clone [URL_DEL_REPOSITORIO]
cd [NOMBRE_DEL_DIRECTORIO]
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Base de Datos PostgreSQL

1. Instalar PostgreSQL si aún no está instalado
2. Crear una nueva base de datos para el proyecto:

```bash
createdb sistema_turnos
```

3. Importar el esquema de la base de datos:

```bash
psql -d sistema_turnos -f database_schema.sql
```

### 4. Configurar Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
# Conexión a la Base de Datos
DATABASE_URL=postgresql://[usuario]:[contraseña]@localhost:5432/sistema_turnos

# Seguridad
SESSION_SECRET=un_secreto_seguro_y_aleatorio

# Entorno
NODE_ENV=development
```

### 5. Compilar y Ejecutar la Aplicación

Para entorno de desarrollo:

```bash
npm run dev
```

Para producción:

```bash
npm run build
npm start
```

La aplicación estará disponible en: http://localhost:5000

## Dependencias Principales

### Frontend
- React 18
- React Query (Tanstack Query)
- Tailwind CSS
- Shadcn UI Components
- React Hook Form + Zod
- Wouter (para enrutamiento)
- date-fns (manipulación de fechas)

### Backend
- Express
- Drizzle ORM
- PostgreSQL
- Passport.js (autenticación)

## Estructura de la Base de Datos

La aplicación utiliza las siguientes tablas principales:

- `users`: Usuarios del sistema
- `companies`: Empresas/negocios
- `user_companies`: Relación entre usuarios y empresas
- `employees`: Empleados
- `shifts`: Turnos asignados
- `schedules`: Horarios completos
- `schedule_templates`: Plantillas de horarios

## Solución de Problemas Comunes

### Error de Conexión a la Base de Datos

Verificar:
- Que PostgreSQL esté en ejecución
- Los datos de conexión en el archivo `.env`
- Permisos de usuario en PostgreSQL

### Errores de Instalación de Dependencias

Si hay problemas con la instalación de dependencias:

```bash
rm -rf node_modules
npm cache clean --force
npm install
```

### Errores de Compilación

Para problemas con TypeScript:

```bash
npm run lint
npm run typecheck
```

## Contacto y Soporte

Para soporte o preguntas, contactar a:
- Email: [correo_de_soporte]
- GitHub: [enlace_al_repositorio]