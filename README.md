# Sistema de Turnos de Trabajo

Este proyecto es una plataforma de gestión de horarios laborales que permite planificar turnos de trabajo para empleados en diferentes empresas.

## Descripción

El sistema cuenta con las siguientes características:

- Autenticación de usuarios con roles (admin, manager, employee)
- Gestión de múltiples empresas
- Gestión de empleados por empresa
- Programación de turnos con interfaz tipo Excel
- Cálculo de costes de personal basado en horas trabajadas
- Exportación de horarios a PDF
- Interfaz optimizada para dispositivos táctiles y de escritorio

## Requisitos técnicos

- Node.js (versión 18 o superior)
- PostgreSQL (versión 14 o superior)
- NPM o Yarn

## Instalación

### 1. Clonar el repositorio

```bash
git clone [url-del-repositorio]
cd sistema-turnos-trabajo
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la base de datos

Crea una base de datos PostgreSQL y configura las variables de entorno:

```
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nombre_base_datos
SESSION_SECRET=tu_session_secret_seguro
```

### 4. Ejecutar el script de creación de base de datos

Utiliza el archivo `database_schema.sql` para crear la estructura de la base de datos:

```bash
psql -U tu_usuario -d nombre_base_datos -f database_schema.sql
```

O utiliza Drizzle para sincronizar el esquema:

```bash
npm run db:push
```

### 5. Iniciar la aplicación

```bash
npm run dev
```

## Credenciales por defecto

- Usuario: admin
- Contraseña: admin123

**IMPORTANTE**: Cambiar la contraseña por defecto después del primer inicio de sesión.

## Estructura del proyecto

- `/client`: Frontend React/TypeScript
- `/server`: Servidor Express
- `/shared`: Código y tipos compartidos entre cliente y servidor

## Tecnologías utilizadas

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Node.js, Express
- **Base de datos**: PostgreSQL
- **ORM**: Drizzle ORM
- **Autenticación**: Passport.js

## Funciones principales

1. **Gestión de empresas**: Crea y administra múltiples empresas
2. **Gestión de empleados**: Agrega, edita y elimina empleados por empresa
3. **Programación de turnos**: Interfaz visual para asignar horarios
4. **Exportación**: Genera reportes en PDF de los horarios semanales
5. **Cálculo de costes**: Visualiza el coste de personal y su porcentaje sobre ventas

## Despliegue en producción

Para desplegar en producción:

1. Ajusta las variables de entorno para el entorno de producción
2. Compila el frontend: `npm run build`
3. Inicia el servidor: `npm start`

## Licencia

Este proyecto es propiedad de su autor y está protegido por las leyes de propiedad intelectual.