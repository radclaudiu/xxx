import { db } from "./db";
import { storage } from "./storage";
import {
  users,
  companies,
  userCompanies,
  employees,
  shifts,
  User,
  Company,
  Employee,
  Shift,
  UserCompany
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// Sincroniza datos desde la base de datos remota a la memoria local
export async function syncRemoteDataToLocal(userId?: number): Promise<void> {
  console.log("Iniciando sincronización de datos remotos a locales...");
  
  try {
    // 1. Obtener usuarios de la base de datos
    let remoteUsers: typeof users.$inferSelect[] = [];
    let remoteCompanies: typeof companies.$inferSelect[] = [];
    let remoteUserCompanies: typeof userCompanies.$inferSelect[] = [];
    let remoteEmployees: typeof employees.$inferSelect[] = [];
    let remoteShifts: typeof shifts.$inferSelect[] = [];
    
    // Si se proporciona un userId, sincronizamos datos específicos de ese usuario
    if (userId) {
      console.log(`Sincronizando datos para el usuario con ID ${userId}`);
      
      // Obtener el usuario específico desde la BD remota
      const userFromDb = await db.select().from(users).where(eq(users.id, userId));
      if (userFromDb && userFromDb.length > 0) {
        remoteUsers = userFromDb;
        
        // Obtener empresas asociadas al usuario
        const userCompaniesFromDb = await db.select().from(userCompanies)
          .where(eq(userCompanies.user_id, userId));
        
        if (userCompaniesFromDb && userCompaniesFromDb.length > 0) {
          remoteUserCompanies = userCompaniesFromDb;
          
          // Obtener todas las compañías asociadas al usuario
          const companyIds = userCompaniesFromDb.map(uc => uc.company_id);
          if (companyIds.length > 0) {
            const companiesFromDb = await db.select().from(companies)
              .where(inArray(companies.id, companyIds));
            
            if (companiesFromDb && companiesFromDb.length > 0) {
              remoteCompanies = companiesFromDb;
              
              // Obtener empleados de esas compañías
              const employeesFromDb = await db.select().from(employees)
                .where(inArray(employees.companyId, companyIds));
              
              if (employeesFromDb && employeesFromDb.length > 0) {
                remoteEmployees = employeesFromDb;
                
                // Obtener turnos de esos empleados
                const employeeIds = employeesFromDb.map(e => e.id);
                const shiftsFromDb = await db.select().from(shifts)
                  .where(inArray(shifts.employeeId, employeeIds));
                
                if (shiftsFromDb && shiftsFromDb.length > 0) {
                  remoteShifts = shiftsFromDb;
                }
              }
            }
          }
        }
      }
    } else {
      // Comportamiento original para inicialización inicial
      remoteUsers = await db.select().from(users);
      remoteCompanies = await db.select().from(companies);
      
      // Log detallado para depuración
      if (remoteUsers.length > 0) {
        console.log(`Sincronizando ${remoteUsers.length} usuarios...`);
        // Mostrar usuario sin revelar contraseña
        for (const user of remoteUsers) {
          const { password, ...userInfo } = user;
          console.log('Usuario encontrado:', userInfo);
        }
      } else {
        console.log('No se encontraron usuarios en la base de datos remota');
        
        // Datos de ejemplo para desarrollo (solo crear si no existen usuarios)
        console.log('Creando usuario de prueba en memoria: lucia');
        
        // Importamos la función para hashear contraseñas
        const { scrypt, randomBytes } = await import('crypto');
        const { promisify } = await import('util');
        const scryptAsync = promisify(scrypt);
        
        // Crear hash de contraseña en el formato correcto
        const password = 'Cory1234';
        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync(password, salt, 64)) as Buffer;
        const hashedPassword = `${buf.toString("hex")}.${salt}`;
        
        // Este usuario se crea sólo en memoria, no en la base de datos remota
        console.log('Creando usuario con contraseña formateada correctamente');
        const newUser = await storage.createUser({
          username: 'lucia',
          password: hashedPassword,
        });
        
        // Si no hay empresas, crear una empresa de ejemplo y asignarla al usuario
        if (remoteCompanies.length === 0) {
          console.log('No se encontraron empresas en la base de datos remota, creando empresa de ejemplo');
          const newCompany = await storage.createCompany({
            name: 'Empresa de Ejemplo',
            description: 'Esta empresa se crea automáticamente para fines de desarrollo',
            active: true
          });
          
          console.log('Asignando empresa de ejemplo al usuario de prueba');
          await storage.assignUserToCompany({
            user_id: newUser.id,
            company_id: newCompany.id,
            role: 'admin'
          });
        }
      }
      
      // Obtener relaciones usuario-empresa, empleados y turnos de la base de datos
      remoteUserCompanies = await db.select().from(userCompanies);
      remoteEmployees = await db.select().from(employees);
      remoteShifts = await db.select().from(shifts);
    }
    
    // Mostrar conteos
    console.log(`Sincronizando ${remoteCompanies.length} empresas...`);
    console.log(`Sincronizando ${remoteUserCompanies.length} relaciones usuario-empresa...`);
    console.log(`Sincronizando ${remoteEmployees.length} empleados...`);
    console.log(`Sincronizando ${remoteShifts.length} turnos...`);
    
    // Almacenar todos los datos en la memoria local
    await storeLocalData(
      remoteUsers,
      remoteCompanies,
      remoteUserCompanies,
      remoteEmployees,
      remoteShifts
    );
    
    console.log("Sincronización completada con éxito.");
  } catch (error) {
    console.error("Error durante la sincronización:", error);
    throw error;
  }
}

// Almacena todos los datos en el almacenamiento local
async function storeLocalData(
  users: User[],
  companies: Company[],
  userCompanies: UserCompany[],
  employees: Employee[],
  shifts: Shift[]
): Promise<void> {
  // Almacenar usuarios (solo actualizamos los existentes o añadimos nuevos, no eliminamos)
  for (const user of users) {
    const existingUser = await storage.getUserByUsername(user.username);
    if (!existingUser) {
      await storage.createUser(user);
    }
  }
  
  // Almacenar empresas
  for (const company of companies) {
    const existingCompany = await storage.getCompany(company.id);
    if (!existingCompany) {
      await storage.createCompany(company);
    }
  }
  
  // Almacenar relaciones usuario-empresa
  for (const userCompany of userCompanies) {
    // Verificar si la relación ya existe
    const userCompanies = await storage.getUserCompanies(userCompany.user_id);
    const exists = userCompanies.some(uc => uc.company_id === userCompany.company_id);
    
    if (!exists) {
      await storage.assignUserToCompany(userCompany);
    }
  }
  
  // Almacenar empleados
  for (const employee of employees) {
    const existingEmployee = await storage.getEmployee(employee.id);
    if (!existingEmployee) {
      await storage.createEmployee(employee);
    }
  }
  
  // Almacenar turnos
  for (const shift of shifts) {
    const existingShift = await storage.getShift(shift.id);
    if (!existingShift) {
      await storage.createShift(shift);
    }
  }
}