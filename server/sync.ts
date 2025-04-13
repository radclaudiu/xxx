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
import { eq } from "drizzle-orm";

// Sincroniza datos desde la base de datos remota a la memoria local
export async function syncRemoteDataToLocal(): Promise<void> {
  console.log("Iniciando sincronización de datos remotos a locales...");
  
  try {
    // 1. Obtener usuarios de la base de datos
    const remoteUsers = await db.select().from(users);
    console.log(`Sincronizando ${remoteUsers.length} usuarios...`);
    
    // 2. Obtener empresas de la base de datos
    const remoteCompanies = await db.select().from(companies);
    console.log(`Sincronizando ${remoteCompanies.length} empresas...`);
    
    // 3. Obtener relaciones usuario-empresa de la base de datos
    const remoteUserCompanies = await db.select().from(userCompanies);
    console.log(`Sincronizando ${remoteUserCompanies.length} relaciones usuario-empresa...`);
    
    // 4. Obtener empleados de la base de datos
    const remoteEmployees = await db.select().from(employees);
    console.log(`Sincronizando ${remoteEmployees.length} empleados...`);
    
    // 5. Obtener turnos de la base de datos
    const remoteShifts = await db.select().from(shifts);
    console.log(`Sincronizando ${remoteShifts.length} turnos...`);
    
    // 6. Almacenar todos los datos en la memoria local
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