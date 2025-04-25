# Instrucciones de Instalación y Configuración de CreaTurno

Este documento detalla el proceso de instalación y configuración de CreaTurno, incluyendo la conexión con la base de datos de Productiva para la sincronización de datos.

## Requisitos previos

- Node.js versión 16 o superior
- PostgreSQL 12 o superior
- Acceso a la base de datos de Productiva

## 1. Instalación básica

### Clonar el repositorio

```bash
git clone [url_del_repositorio]
cd CreaTurno
```

### Instalar dependencias

```bash
npm install
```

## 2. Configuración de base de datos

### Configurar archivo .env

Crea un archivo `.env` en la raíz del proyecto usando `.env.example` como plantilla:

```bash
cp .env.example .env
```

Edita el archivo `.env` y configura las siguientes variables:

```
# Conexión a la base de datos local de CreaTurno
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/creaturno"

# Conexión a la base de datos de Productiva (fundamental para la sincronización)
PRODUCTIVA_DB_URL="postgresql://usuario:contraseña@servidor:5432/productiva"

# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de JWT para autenticación
JWT_SECRET=un_secreto_muy_seguro_y_largo
JWT_EXPIRY=7d
```

Reemplaza los siguientes valores:
- `usuario` y `contraseña` con las credenciales correctas para cada base de datos
- `servidor` con la dirección IP o nombre de host donde se ejecuta la base de datos de Productiva
- `5432` con el puerto correcto si es diferente al predeterminado
- `productiva` con el nombre correcto de la base de datos
- `un_secreto_muy_seguro_y_largo` con una cadena aleatoria para cifrar los tokens JWT

### Crear la base de datos local

Crea una base de datos PostgreSQL para CreaTurno:

```bash
psql -U postgres -c "CREATE DATABASE creaturno;"
psql -U postgres -c "CREATE USER creaturno_user WITH ENCRYPTED PASSWORD 'tu_contraseña';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE creaturno TO creaturno_user;"
```

## 3. Permisos de base de datos para Productiva

El usuario que utilices para conectar a Productiva debe tener permisos de LECTURA en las siguientes tablas:

- `users`
- `companies`
- `employees`
- `user_company_access`

Ejemplo de cómo configurar un usuario de solo lectura en Productiva:

```bash
psql -U postgres -d productiva -c "CREATE USER creaturno_sync WITH ENCRYPTED PASSWORD 'contraseña_segura';"
psql -U postgres -d productiva -c "GRANT CONNECT ON DATABASE productiva TO creaturno_sync;"
psql -U postgres -d productiva -c "GRANT USAGE ON SCHEMA public TO creaturno_sync;"
psql -U postgres -d productiva -c "GRANT SELECT ON users, companies, employees, user_company_access TO creaturno_sync;"
```

## 4. Configuración de red

### Acceso remoto

Si Productiva está en un servidor diferente:

1. Modifica `pg_hba.conf` en el servidor de Productiva para permitir conexiones desde la IP del servidor de CreaTurno
2. Asegúrate de que el firewall permita conexiones al puerto PostgreSQL (generalmente 5432)

### Docker (Opcional)

Si utilizas Docker, modifica tu `docker-compose.yml` para incluir las variables de entorno:

```yaml
services:
  creaturno:
    image: creaturno
    environment:
      - DATABASE_URL=postgresql://usuario:contraseña@postgres:5432/creaturno
      - PRODUCTIVA_DB_URL=postgresql://usuario:contraseña@host_externo:5432/productiva
      - JWT_SECRET=tu_secreto_jwt
      - JWT_EXPIRY=7d
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    # ... otras configuraciones

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_USER=usuario
      - POSTGRES_PASSWORD=contraseña
      - POSTGRES_DB=creaturno
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # ... otras configuraciones

volumes:
  postgres_data:
```

## 5. Inicializar la base de datos

Ejecuta las migraciones para crear las tablas necesarias:

```bash
npm run db:push
```

## 6. Iniciar el servidor

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## 7. Iniciar la sincronización

1. Accede a la aplicación en `http://localhost:3000` (o la URL correspondiente)
2. Inicia sesión como administrador
3. Ve a la sección de administración
4. Accede al panel de sincronización
5. Primero verifica la conexión con el botón "Verificar conexión"
6. Si todo está correcto, inicia la sincronización con "Sincronizar todo"

## 8. Verificación

Después de la sincronización, los usuarios de Productiva deberían poder:

1. Iniciar sesión con sus mismas credenciales
2. Ver las mismas empresas a las que tienen acceso en Productiva
3. Ver los mismos empleados en cada empresa

## Solución de problemas

### Problemas de conexión

Si no puedes conectar a la base de datos de Productiva:

1. Verifica que la URL de conexión sea correcta
2. Asegúrate de que los permisos del usuario sean correctos
3. Comprueba que el firewall permita la conexión
4. Revisa los logs de CreaTurno para ver errores específicos

### Errores de sincronización

Si la sincronización falla:

1. Verifica los logs del servidor
2. Comprueba que todas las tablas necesarias existan en Productiva
3. Verifica que el usuario tenga permisos de lectura en todas las tablas necesarias

## Mantenimiento

Se recomienda programar una sincronización diaria para mantener actualizados los datos.