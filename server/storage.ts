import { eq, and, desc, asc } from "drizzle-orm";
import { 
  Employee, InsertEmployee, 
  Shift, InsertShift,
  Schedule, InsertSchedule,
  User, InsertUser,
  Company, InsertCompany,
  UserCompany, InsertUserCompany,
  employees, shifts, schedules,
  users, companies, userCompanies
} from "@shared/schema";
import { db, getDbConfig, saveDbConfig } from "./db";

export interface IStorage {
  // User auth operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Company operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  
  // User-Company operations
  getUserCompanies(userId: number): Promise<(UserCompany & { company: Company })[]>;
  assignUserToCompany(userCompany: InsertUserCompany): Promise<UserCompany>;
  removeUserFromCompany(userId: number, companyId: number): Promise<boolean>;
  
  // Employee operations
  getEmployees(companyId?: number): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  
  // Shift operations
  getShifts(date?: string, employeeId?: number, companyId?: number): Promise<Shift[]>;
  getShift(id: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  
  // Schedule operations (save/load)
  getSchedules(companyId?: number): Promise<Schedule[]>;
  getSchedule(id: number): Promise<Schedule | undefined>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  deleteSchedule(id: number): Promise<boolean>;
  
  // Save and load entire schedule data
  saveScheduleData(scheduleId: number, employees: Employee[], shifts: Shift[]): Promise<boolean>;
  loadScheduleData(scheduleId: number): Promise<{ employees: Employee[], shifts: Shift[] } | undefined>;
  
  // Database configuration
  updateDatabaseConfig(config: {
    DATABASE_URL: string;
    PGDATABASE?: string;
    PGHOST?: string;
    PGPORT?: string;
    PGPASSWORD?: string;
    PGUSER?: string;
  }): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private employees: Map<number, Employee>;
  private shifts: Map<number, Shift>;
  private schedules: Map<number, Schedule>;
  private scheduleData: Map<number, { employees: Employee[], shifts: Shift[] }>;
  
  private employeeId: number;
  private shiftId: number;
  private scheduleId: number;

  constructor() {
    this.employees = new Map();
    this.shifts = new Map();
    this.schedules = new Map();
    this.scheduleData = new Map();
    
    this.employeeId = 1;
    this.shiftId = 1;
    this.scheduleId = 1;
    
    // Add some initial employees for testing
    this.seedInitialData();
  }
  
  private seedInitialData() {
    const initialEmployees = [
      { name: "Juan Pérez", role: "Cajero" },
      { name: "María González", role: "Asistente" },
      { name: "Carlos Rodríguez", role: "Vendedor" },
      { name: "Ana Martínez", role: "Supervisor" },
      { name: "Roberto López", role: "Vendedor" }
    ];
    
    initialEmployees.forEach(emp => this.createEmployee(emp));
    
    // Add some initial shifts
    const today = new Date().toISOString().split('T')[0];
    
    this.createShift({ 
      employeeId: 3, 
      date: today, 
      startTime: "09:00", 
      endTime: "12:00", 
      notes: "" 
    });
    
    this.createShift({ 
      employeeId: 2, 
      date: today, 
      startTime: "11:00", 
      endTime: "13:30", 
      notes: "" 
    });
    
    this.createShift({ 
      employeeId: 3, 
      date: today, 
      startTime: "15:00", 
      endTime: "18:00", 
      notes: "" 
    });
    
    this.createShift({ 
      employeeId: 5, 
      date: today, 
      startTime: "12:00", 
      endTime: "16:00", 
      notes: "" 
    });
  }

  // Employee methods
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const id = this.employeeId++;
    const newEmployee: Employee = { ...employee, id };
    this.employees.set(id, newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const existingEmployee = this.employees.get(id);
    if (!existingEmployee) return undefined;
    
    const updatedEmployee = { ...existingEmployee, ...employee };
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: number): Promise<boolean> {
    // Also delete any shifts associated with this employee
    const employeeShifts = Array.from(this.shifts.values()).filter(
      shift => shift.employeeId === id
    );
    
    for (const shift of employeeShifts) {
      this.shifts.delete(shift.id);
    }
    
    return this.employees.delete(id);
  }

  // Shift methods
  async getShifts(date?: string, employeeId?: number): Promise<Shift[]> {
    let shifts = Array.from(this.shifts.values());
    
    if (date) {
      shifts = shifts.filter(shift => shift.date === date);
    }
    
    if (employeeId) {
      shifts = shifts.filter(shift => shift.employeeId === employeeId);
    }
    
    return shifts;
  }

  async getShift(id: number): Promise<Shift | undefined> {
    return this.shifts.get(id);
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const id = this.shiftId++;
    const newShift: Shift = { ...shift, id };
    this.shifts.set(id, newShift);
    return newShift;
  }

  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    const existingShift = this.shifts.get(id);
    if (!existingShift) return undefined;
    
    const updatedShift = { ...existingShift, ...shift };
    this.shifts.set(id, updatedShift);
    return updatedShift;
  }

  async deleteShift(id: number): Promise<boolean> {
    return this.shifts.delete(id);
  }

  // Schedule methods
  async getSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedule(id: number): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleId++;
    const now = new Date();
    const newSchedule: Schedule = { 
      ...schedule, 
      id, 
      createdAt: now 
    };
    
    this.schedules.set(id, newSchedule);
    return newSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    this.scheduleData.delete(id);
    return this.schedules.delete(id);
  }

  // Save and load entire schedule data
  async saveScheduleData(scheduleId: number, employees: Employee[], shifts: Shift[]): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;
    
    this.scheduleData.set(scheduleId, { employees, shifts });
    return true;
  }

  async loadScheduleData(scheduleId: number): Promise<{ employees: Employee[], shifts: Shift[] } | undefined> {
    return this.scheduleData.get(scheduleId);
  }
}

// Implementación de la base de datos PostgreSQL
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return result;
  }

  // Company operations
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.name));
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [result] = await db.insert(companies).values(company).returning();
    return result;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [result] = await db
      .update(companies)
      .set(company)
      .where(eq(companies.id, id))
      .returning();
    return result;
  }

  async deleteCompany(id: number): Promise<boolean> {
    const [result] = await db
      .delete(companies)
      .where(eq(companies.id, id))
      .returning({ id: companies.id });
    return !!result;
  }

  // User-Company operations
  async getUserCompanies(userId: number): Promise<(UserCompany & { company: Company })[]> {
    // Unir la tabla de relaciones con la tabla de empresas
    const userCompaniesWithDetails = await db
      .select({
        id: userCompanies.id,
        user_id: userCompanies.user_id,
        company_id: userCompanies.company_id,
        role: userCompanies.role,
        created_at: userCompanies.created_at,
        company: companies
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.company_id, companies.id))
      .where(eq(userCompanies.user_id, userId));

    return userCompaniesWithDetails;
  }

  async assignUserToCompany(userCompany: InsertUserCompany): Promise<UserCompany> {
    const [result] = await db.insert(userCompanies).values(userCompany).returning();
    return result;
  }

  async removeUserFromCompany(userId: number, companyId: number): Promise<boolean> {
    const [result] = await db
      .delete(userCompanies)
      .where(
        and(
          eq(userCompanies.user_id, userId),
          eq(userCompanies.company_id, companyId)
        )
      )
      .returning({ id: userCompanies.id });
    return !!result;
  }

  // Database configuration
  async updateDatabaseConfig(config: {
    DATABASE_URL: string;
    PGDATABASE?: string;
    PGHOST?: string;
    PGPORT?: string;
    PGPASSWORD?: string;
    PGUSER?: string;
  }): Promise<boolean> {
    try {
      saveDbConfig(config);
      return true;
    } catch (error) {
      console.error("Error al actualizar la configuración de la base de datos:", error);
      return false;
    }
  }

  // Employee operations
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(asc(employees.name));
  }
  
  async getEmployee(id: number): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    // Asegurarse de que los campos requeridos estén presentes con valores por defecto
    const employeeWithDefaults = {
      ...employee,
      role: employee.role || "", // Valor por defecto para role
      email: employee.email || null, // Valores por defecto para los campos que pueden ser nulos
      phone: employee.phone || null,
      address: employee.address || null,
      hireDate: employee.hireDate || null,
      contractType: employee.contractType || null,
      hourlyRate: employee.hourlyRate || null,
      maxHoursPerWeek: employee.maxHoursPerWeek || null,
      preferredDays: employee.preferredDays || null,
      unavailableDays: employee.unavailableDays || null,
      isActive: employee.isActive === undefined ? true : employee.isActive,
      notes: employee.notes || null,
    };
    
    const [result] = await db.insert(employees).values(employeeWithDefaults).returning();
    return result;
  }
  
  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [result] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return result;
  }
  
  async deleteEmployee(id: number): Promise<boolean> {
    // Las relaciones en cascada de la base de datos manejarán la eliminación de los turnos asociados
    const [result] = await db
      .delete(employees)
      .where(eq(employees.id, id))
      .returning({ id: employees.id });
    return !!result;
  }
  
  // Shift operations
  async getShifts(date?: string, employeeId?: number, companyId?: number): Promise<Shift[]> {
    let query = db.select().from(shifts);
    
    // Construir las condiciones
    let conditions: any[] = [];
    
    if (date) {
      conditions.push(eq(shifts.date, date));
    }
    
    if (employeeId) {
      conditions.push(eq(shifts.employeeId, employeeId));
    }
    
    if (companyId) {
      // Si se proporciona companyId, necesitamos unir con empleados para filtrar
      query = query
        .innerJoin(employees, eq(shifts.employeeId, employees.id))
        .where(eq(employees.companyId, companyId));
    } else if (conditions.length > 0) {
      // Aplicar condiciones normales si no hay companyId
      if (conditions.length === 1) {
        query = query.where(conditions[0]);
      } else {
        query = query.where(and(...conditions));
      }
    }
    
    return await query;
  }
  
  async getShift(id: number): Promise<Shift | undefined> {
    const result = await db.select().from(shifts).where(eq(shifts.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async createShift(shift: InsertShift): Promise<Shift> {
    // Asegurarse de que los campos requeridos estén presentes con valores por defecto
    const shiftWithDefaults = {
      ...shift,
      notes: shift.notes || "",
      status: shift.status || "scheduled",
      breakTime: shift.breakTime || null,
      actualStartTime: null,
      actualEndTime: null,
      totalHours: null,
      scheduleId: shift.scheduleId || null,
    };
    
    const [result] = await db.insert(shifts).values(shiftWithDefaults).returning();
    return result;
  }
  
  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    const [result] = await db
      .update(shifts)
      .set(shift)
      .where(eq(shifts.id, id))
      .returning();
    return result;
  }
  
  async deleteShift(id: number): Promise<boolean> {
    const [result] = await db
      .delete(shifts)
      .where(eq(shifts.id, id))
      .returning({ id: shifts.id });
    return !!result;
  }
  
  // Schedule operations
  async getSchedules(): Promise<Schedule[]> {
    return await db.select().from(schedules).orderBy(desc(schedules.createdAt));
  }
  
  async getSchedule(id: number): Promise<Schedule | undefined> {
    const result = await db.select().from(schedules).where(eq(schedules.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    // Asegurarse de que los campos requeridos estén presentes con valores por defecto
    const scheduleWithDefaults = {
      ...schedule,
      description: schedule.description || "",
      startDate: schedule.startDate || null,
      endDate: schedule.endDate || null,
      status: schedule.status || "draft",
      department: schedule.department || null,
      createdBy: schedule.createdBy || null,
    };
    
    const [result] = await db.insert(schedules).values(scheduleWithDefaults).returning();
    return result;
  }
  
  async deleteSchedule(id: number): Promise<boolean> {
    const [result] = await db
      .delete(schedules)
      .where(eq(schedules.id, id))
      .returning({ id: schedules.id });
    return !!result;
  }
  
  // Save and load entire schedule data
  async saveScheduleData(scheduleId: number, employeesList: Employee[], shiftsList: Shift[]): Promise<boolean> {
    // Verificar que el horario existe
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) return false;
    
    // Implementación simple: actualizar turnos existentes con el ID del horario
    for (const shift of shiftsList) {
      if (shift.id) {
        await db
          .update(shifts)
          .set({ scheduleId })
          .where(eq(shifts.id, shift.id));
      }
    }
    
    return true;
  }
  
  async loadScheduleData(scheduleId: number): Promise<{ employees: Employee[], shifts: Shift[] } | undefined> {
    // Verificar que el horario existe
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) return undefined;
    
    // Obtener todos los turnos asociados a este horario
    const scheduleShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.scheduleId, scheduleId));
    
    if (scheduleShifts.length === 0) {
      return { employees: [], shifts: [] };
    }
    
    // Obtener todos los IDs de empleados de los turnos
    const employeeIdSet = new Set<number>();
    scheduleShifts.forEach(shift => {
      employeeIdSet.add(shift.employeeId);
    });
    
    // Convertir el Set a Array
    const employeeIds = Array.from(employeeIdSet);
    
    // Consultar empleados uno por uno
    const scheduleEmployees: Employee[] = [];
    for (const empId of employeeIds) {
      const emp = await this.getEmployee(empId);
      if (emp) {
        scheduleEmployees.push(emp);
      }
    }
    
    return {
      employees: scheduleEmployees,
      shifts: scheduleShifts
    };
  }
}

// Cambiar el almacenamiento a la base de datos
export const storage = new DatabaseStorage();
