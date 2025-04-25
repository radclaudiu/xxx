# Sincronización CreaTurno con Productiva

Este documento describe el sistema de sincronización entre Productiva y CreaTurno, permitiendo que CreaTurno opere como una extensión que utiliza los datos de Productiva.

## Características principales

- **Sincronización unidireccional**: Los datos fluyen solo desde Productiva hacia CreaTurno.
- **Entidades sincronizadas**: 
  - Usuarios
  - Empresas
  - Empleados
  - Relaciones usuario-empresa
- **Autenticación compatible**: Los usuarios pueden usar las mismas credenciales que en Productiva.
- **Gestión de secuencias**: Actualización automática de secuencias PostgreSQL para evitar conflictos.
- **Manejo robusto de errores**: Validación de datos y manejo de casos límite.

## Configuración

Para configurar la sincronización, es necesario definir la variable de entorno `PRODUCTIVA_DB_URL` en el archivo `.env` de CreaTurno:

```
PRODUCTIVA_DB_URL="postgresql://usuario:contraseña@host:puerto/productiva"
```

> **⚠️ Importante**: Esta conexión necesita permisos de solo lectura en la base de datos de Productiva.

## Endpoints de sincronización

Todos los endpoints requieren autenticación de administrador.

### Verificar estado de conexión

```
GET /api/sync/status
```

Comprueba si la conexión con Productiva está funcionando correctamente.

### Sincronización completa

```
POST /api/sync
```

Limpia todas las tablas de CreaTurno y sincroniza todos los datos desde Productiva.

### Sincronizaciones individuales

```
POST /api/sync/users          # Sincroniza solo usuarios
POST /api/sync/companies      # Sincroniza solo empresas
POST /api/sync/employees      # Sincroniza solo empleados
POST /api/sync/relations      # Sincroniza solo relaciones usuario-empresa
```

### Limpiar tablas

```
POST /api/sync/truncate
```

Limpia todas las tablas de CreaTurno sin realizar sincronización.

## Verificación de contraseñas de Werkzeug

CreaTurno puede verificar las contraseñas generadas por Werkzeug (Python Flask) en Productiva. Esto permite que los usuarios inicien sesión con las mismas credenciales en ambos sistemas.

## Manejo de nulos y datos inconsistentes

El sistema está diseñado para manejar valores nulos y datos potencialmente inconsistentes de la base de datos de Productiva:

- Uso de `COALESCE` para proporcionar valores predeterminados a campos que podrían ser nulos
- Validación de datos obligatorios antes de la inserción
- Omisión de registros con datos críticos incompletos
- Mensajes de log detallados para facilitar el diagnóstico de problemas

## Aspectos de seguridad

- Las credenciales de conexión no se exponen en el front-end
- Solo los administradores pueden iniciar y monitorizar el proceso de sincronización
- Mecanismos de timeout para consultas largas
- Cierre limpio de conexiones cuando la aplicación se cierra

## Mantenimiento

Para un rendimiento óptimo, se recomienda:

1. Programar sincronizaciones completas periódicas (ej: diarias)
2. Monitorizar los logs para detectar posibles problemas
3. Mantener actualizada la configuración de conexión a Productiva

## Estadísticas y monitoreo

Cada operación de sincronización proporciona estadísticas detalladas:

- Número total de registros procesados
- Registros importados exitosamente
- Errores encontrados
- Tiempo de ejecución