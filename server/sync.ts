import { db } from './db';
import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { companies, employees, users, userCompanies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync } from 'crypto';

// Configuración mejorada para la conexión a Productiva
const PRODUCTIVA_CONNECTION_OPTIONS = {
  connectionString: process.env.PRODUCTIVA_DB_URL,
  connectionTimeoutMillis: 10000,  // 10 segundos timeout para conexión
  idleTimeoutMillis: 30000,        // 30 segundos antes de desconectar conexiones inactivas
  max: 10,                         // máximo 10 clientes en el pool
  statement_timeout: 60000,        // timeout para consultas (60 segundos)
};

// Verifica que la URL de conexión esté definida
if (!process.env.PRODUCTIVA_DB_URL) {
  console.error("ADVERTENCIA: No se ha definido PRODUCTIVA_DB_URL. La sincronización con Productiva no funcionará.");
}

// Conexión a Productiva
export const productivaDb = new Pool(PRODUCTIVA_CONNECTION_OPTIONS);

// Función de limpieza de tablas para reinicio completo
export async function truncateTables() {
  await db.execute(sql`TRUNCATE TABLE user_companies CASCADE`);
  await db.execute(sql`TRUNCATE TABLE shifts CASCADE`);
  await db.execute(sql`TRUNCATE TABLE employees CASCADE`);
  await db.execute(sql`TRUNCATE TABLE companies CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users CASCADE`);
  return { success: true, message: "Tablas limpiadas" };
}

// Función principal de sincronización
export async function syncAll() {
  console.log("Iniciando sincronización completa...");
  const startTime = Date.now();
  
  try {
    // Limpiar tablas existentes
    console.log("Limpiando tablas existentes...");
    await truncateTables();
    
    // Sincronizar en el orden correcto
    console.log("Sincronizando usuarios...");
    const userStats = await syncUsers();
    
    console.log("Sincronizando empresas...");
    const companyStats = await syncCompanies();
    
    console.log("Sincronizando empleados...");
    const employeeStats = await syncEmployees();
    
    console.log("Sincronizando relaciones usuario-empresa...");
    const relationStats = await syncUserCompanies();
    
    // Actualizar secuencias
    console.log("Actualizando secuencias de base de datos...");
    await updateSequences();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const totalStats = {
      total: userStats.total + companyStats.total + employeeStats.total + relationStats.total,
      added: userStats.added + companyStats.added + employeeStats.added + relationStats.added,
      errors: userStats.errors + companyStats.errors + employeeStats.errors + relationStats.errors,
      duration: `${duration}s`
    };
    
    console.log(`Sincronización completada en ${duration} segundos.`);
    console.log(`Total elementos: ${totalStats.total}, Añadidos: ${totalStats.added}, Errores: ${totalStats.errors}`);
    
    return {
      users: userStats,
      companies: companyStats,
      employees: employeeStats,
      userCompanies: relationStats,
      summary: totalStats
    };
  } catch (error) {
    console.error("Error crítico durante la sincronización:", error);
    throw new Error(`Error en el proceso de sincronización: ${error.message}`);
  }
}

// Sincronizar usuarios
export async function syncUsers() {
  const stats = { added: 0, errors: 0, total: 0 };
  
  try {
    const { rows: productivaUsers } = await productivaDb.query(`
      SELECT id, username, password_hash as password, email, 
             TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) as full_name, 
             COALESCE(role, 'user') as role
      FROM users
      WHERE COALESCE(is_active, TRUE) = TRUE
    `);
    
    for (const user of productivaUsers) {
      if (!user.id || !user.username || !user.password || !user.email) {
        console.warn(`Usuario con datos incompletos, omitiendo: ${JSON.stringify(user)}`);
        continue;
      }
      
      stats.total++;
      try {
        await db.insert(users).values({
          id: user.id,
          username: user.username,
          password: user.password,
          email: user.email,
          fullName: user.full_name || '',
          role: user.role === 'admin' ? 'admin' : 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        stats.added++;
      } catch (error) {
        console.error(`Error al sincronizar usuario ${user.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al obtener usuarios de Productiva:', error);
    throw new Error(`Error crítico en sincronización de usuarios: ${error.message}`);
  }
  
  return stats;
}

// Sincronizar empresas
export async function syncCompanies() {
  const stats = { added: 0, errors: 0, total: 0 };
  
  try {
    const { rows: productivaCompanies } = await productivaDb.query(`
      SELECT id, name, address, phone, email, website, tax_id
      FROM companies
      WHERE COALESCE(is_active, TRUE) = TRUE
    `);
    
    for (const company of productivaCompanies) {
      if (!company.id || !company.name) {
        console.warn(`Empresa con datos incompletos, omitiendo: ${JSON.stringify(company)}`);
        continue;
      }
      
      stats.total++;
      try {
        await db.insert(companies).values({
          id: company.id,
          name: company.name,
          address: company.address || null,
          phone: company.phone || null,
          email: company.email || null,
          website: company.website || null,
          taxId: company.tax_id || null,
          isActive: true,
          startHour: 9, // Valores por defecto
          endHour: 18,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        stats.added++;
      } catch (error) {
        console.error(`Error al sincronizar empresa ${company.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al obtener empresas de Productiva:', error);
    throw new Error(`Error crítico en sincronización de empresas: ${error.message}`);
  }
  
  return stats;
}

// Sincronizar empleados
export async function syncEmployees() {
  const stats = { added: 0, errors: 0, total: 0 };
  
  try {
    const { rows: productivaEmployees } = await productivaDb.query(`
      SELECT id, first_name, last_name, company_id, position, 
             email, phone_number as phone, address, hire_date,
             COALESCE(is_active, TRUE) as is_active, notes
      FROM employees
      WHERE COALESCE(is_active, TRUE) = TRUE
    `);
    
    for (const emp of productivaEmployees) {
      if (!emp.id || !emp.company_id) {
        console.warn(`Empleado con datos incompletos, omitiendo: ${JSON.stringify(emp)}`);
        continue;
      }
      
      stats.total++;
      try {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Sin nombre';
        
        await db.insert(employees).values({
          id: emp.id,
          name: fullName,
          role: emp.position || "",
          companyId: emp.company_id,
          email: emp.email || null,
          phone: emp.phone || null,
          address: emp.address || null,
          hireDate: emp.hire_date ? new Date(emp.hire_date) : null,
          isActive: true,
          notes: emp.notes || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        stats.added++;
      } catch (error) {
        console.error(`Error al sincronizar empleado ${emp.id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al obtener empleados de Productiva:', error);
    throw new Error(`Error crítico en sincronización de empleados: ${error.message}`);
  }
  
  return stats;
}

// Sincronizar relaciones usuario-empresa
export async function syncUserCompanies() {
  const stats = { added: 0, errors: 0, total: 0 };
  
  try {
    const { rows: productivaRelations } = await productivaDb.query(`
      SELECT user_id, company_id, COALESCE(access_level, 'user') as role
      FROM user_company_access
      WHERE COALESCE(is_active, TRUE) = TRUE
    `);
    
    for (const rel of productivaRelations) {
      if (!rel.user_id || !rel.company_id) {
        console.warn(`Relación usuario-empresa con datos incompletos, omitiendo: ${JSON.stringify(rel)}`);
        continue;
      }
      
      stats.total++;
      try {
        // Mapear roles: admin, manager o member
        let role = "member";
        if (rel.role === "admin") role = "owner";
        else if (rel.role === "manager") role = "manager";
        
        await db.insert(userCompanies).values({
          userId: rel.user_id,
          companyId: rel.company_id,
          role: role,
          createdAt: new Date()
        });
        stats.added++;
      } catch (error) {
        console.error(`Error al sincronizar relación ${rel.user_id}-${rel.company_id}:`, error);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error al obtener relaciones usuario-empresa de Productiva:', error);
    throw new Error(`Error crítico en sincronización de relaciones usuario-empresa: ${error.message}`);
  }
  
  return stats;
}

// Actualizar secuencias
async function getMaxId(table: string) {
  const result = await db.execute(sql`SELECT COALESCE(MAX(id), 0) as max_id FROM ${sql.raw(table)}`);
  return parseInt(result.rows[0].max_id, 10);
}

export async function updateSequences() {
  const tables = ['users', 'companies', 'employees', 'user_companies'];
  
  for (const table of tables) {
    const maxId = await getMaxId(table);
    if (maxId > 0) {
      await db.execute(sql`
        SELECT setval(pg_get_serial_sequence('${sql.raw(table)}', 'id'), 
        ${maxId + 1}, false)
      `);
    }
  }
}

// Función para cerrar conexiones de base de datos
export async function closeConnections() {
  try {
    console.log("Cerrando conexiones a Productiva...");
    await productivaDb.end();
    console.log("Conexiones a Productiva cerradas correctamente");
    return true;
  } catch (error) {
    console.error("Error al cerrar conexiones:", error);
    return false;
  }
}

// Manejo de cierre limpio de conexiones al apagar la aplicación
process.on('SIGTERM', () => {
  console.log('Recibida señal SIGTERM, cerrando conexiones...');
  closeConnections().then(() => {
    console.log('Conexiones cerradas correctamente, terminando proceso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Recibida señal SIGINT, cerrando conexiones...');
  closeConnections().then(() => {
    console.log('Conexiones cerradas correctamente, terminando proceso');
    process.exit(0);
  });
});