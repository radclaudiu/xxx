# Instrucciones de Despliegue

Este documento proporciona instrucciones detalladas sobre cómo desplegar el Sistema de Turnos de Trabajo en diferentes entornos.

## Requisitos previos

- Node.js (versión 18 o superior)
- PostgreSQL (versión 14 o superior)
- npm o yarn
- Un servidor Linux, Windows o macOS

## Despliegue local para desarrollo

### 1. Clonar el repositorio

```bash
git clone [url-del-repositorio]
cd sistema-turnos-trabajo
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
# Base de datos
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nombre_base_datos

# Seguridad
SESSION_SECRET=un_secreto_seguro_aleatorio_largo
```

### 4. Configurar la base de datos

**Opción 1**: Usar el archivo SQL para crear manualmente la estructura:

```bash
psql -U tu_usuario -d nombre_base_datos -f database_schema.sql
```

**Opción 2**: Usar Drizzle para sincronizar el esquema:

```bash
npm run db:push
```

### 5. Iniciar la aplicación en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5000`

## Despliegue en entorno de producción

### 1. Preparar el entorno

Asegúrate de tener instalado Node.js y PostgreSQL en el servidor.

### 2. Clonar y configurar el proyecto

```bash
git clone [url-del-repositorio]
cd sistema-turnos-trabajo
npm install --production
```

### 3. Configurar variables de entorno

Crea un archivo `.env` similar al de desarrollo, pero con configuraciones específicas de producción:

```
# Base de datos
DATABASE_URL=postgresql://usuario:contraseña@host-produccion:5432/db_produccion

# Seguridad
SESSION_SECRET=secreto_unico_para_produccion
NODE_ENV=production
PORT=4000  # El puerto donde se ejecutará la aplicación
```

### 4. Construir el frontend

```bash
npm run build
```

### 5. Configurar la base de datos

Utiliza el archivo `database_schema.sql` para crear la estructura de la base de datos:

```bash
psql -U tu_usuario -d nombre_base_datos -h host-bd -f database_schema.sql
```

### 6. Iniciar el servidor

**Opción 1**: Directamente con Node.js

```bash
node server/index.js
```

**Opción 2**: Con PM2 (recomendado para producción)

```bash
npm install -g pm2
pm2 start server/index.js --name "turnos-trabajo"
pm2 save
pm2 startup
```

## Despliegue en contenedores Docker

### 1. Construir la imagen Docker

Asegúrate de tener un `Dockerfile` en la raíz del proyecto:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["node", "server/index.js"]
```

Construye la imagen:

```bash
docker build -t sistema-turnos:latest .
```

### 2. Ejecutar con Docker Compose

Crea un archivo `docker-compose.yml`:

```yaml
version: '3'

services:
  app:
    image: sistema-turnos:latest
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:contraseña@db:5432/sistema_turnos
      - SESSION_SECRET=secreto_para_docker
      - NODE_ENV=production
    depends_on:
      - db
    restart: always

  db:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=contraseña
      - POSTGRES_DB=sistema_turnos
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database_schema.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  postgres_data:
```

Inicia los contenedores:

```bash
docker-compose up -d
```

## Mantenimiento de la base de datos

### Respaldos regulares

Configura respaldos periódicos de la base de datos:

```bash
pg_dump -U usuario -d nombre_base_datos > backup_$(date +%Y%m%d).sql
```

### Escalabilidad

Para bases de datos más grandes, considera:

1. Configurar índices adicionales para mejoras de rendimiento
2. Implementar particionamiento para tablas grandes (especialmente shifts)
3. Configurar replicación para alta disponibilidad

## Solución de problemas comunes

### Error de conexión a la base de datos

Verifica:
- La URL de conexión en la variable de entorno DATABASE_URL
- Que PostgreSQL esté ejecutándose
- Que las credenciales sean correctas
- Los permisos del usuario en la base de datos

### Problemas con la sesión de usuario

- Asegúrate de que SESSION_SECRET esté configurado correctamente
- Verifica la configuración de cookies y sesiones en el servidor

### Errores en el cliente

Si el frontend no carga correctamente:
- Verifica que el build se haya completado correctamente
- Asegúrate de que el servidor esté sirviendo los archivos estáticos
- Comprueba los logs del navegador para errores específicos

## Contacto y soporte

Para soporte técnico:
- Email: soporte@example.com
- Teléfono: +XX XXX XXX XXX