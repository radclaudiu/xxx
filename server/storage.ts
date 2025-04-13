import { eq, and, desc, asc, isNull, not, or, inArray } from "drizzle-orm";
import { 
  Employee, InsertEmployee, 
  Shift, InsertShift,
  Schedule, InsertSchedule,
  User, InsertUser,
  Company, InsertCompany,
  UserCompany, InsertUserCompany,
  ScheduleTemplate, InsertScheduleTemplate,
  employees, shifts, schedules, 
  users, companies, userCompanies, scheduleTemplates
} from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // Company operations
  getCompanies(userId?: number): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  
  // User-Company relations
  getUserCompanies(userId: number): Promise<UserCompany[]>;
  getCompanyUsers(companyId: number): Promise<UserCompany[]>;
  assignUserToCompany(userId: number, companyId: number, role: string): Promise<UserCompany>;
  removeUserFromCompany(userId: number, companyId: number): Promise<boolean>;
  
  // Schedule Templates
  getScheduleTemplates(userId?: number): Promise<ScheduleTemplate[]>;
  getScheduleTemplate(id: number): Promise<ScheduleTemplate | undefined>;
  createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate>;
  updateScheduleTemplate(id: number, template: Partial<InsertScheduleTemplate>): Promise<ScheduleTemplate | undefined>;
  deleteScheduleTemplate(id: number): Promise<boolean>;
  
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const [result] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return !!result;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(asc(users.username));
  }
  
  // Company operations
  async getCompanies(userId?: number): Promise<Company[]> {
    try {
      console.log("getCompanies llamado con userId:", userId);
      
      if (userId) {
        // Obtener empresas a las que pertenece el usuario
        console.log("Buscando empresas para usuario específico:", userId);
        const userCompanyEntries = await db
          .select({
            companyId: userCompanies.companyId
          })
          .from(userCompanies)
          .where(eq(userCompanies.userId, userId));
        
        console.log("Relaciones de usuario-empresa encontradas:", userCompanyEntries);
        const companyIds = userCompanyEntries.map(entry => entry.companyId);
        
        if (companyIds.length === 0) {
          console.log("No se encontraron empresas para este usuario");
          return [];
        }
        
        // Si solo hay una empresa, usar eq en lugar de inArray
        if (companyIds.length === 1) {
          console.log("Usando eq para una sola empresa:", companyIds[0]);
          return await db
            .select()
            .from(companies)
            .where(eq(companies.id, companyIds[0]))
            .orderBy(asc(companies.name));
        }
        
        console.log("Usando inArray para múltiples empresas:", companyIds);
        return await db
          .select()
          .from(companies)
          .where(inArray(companies.id, companyIds))
          .orderBy(asc(companies.name));
      } else {
        // Obtener todas las empresas (para administradores)
        console.log("Obteniendo todas las empresas (admin)");
        const allCompanies = await db
          .select()
          .from(companies)
          .orderBy(asc(companies.name));
        
        console.log("Total de empresas encontradas:", allCompanies.length);
        return allCompanies;
      }
    } catch (error) {
      console.error("Error en getCompanies:", error);
      throw error;
    }
  }
  
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }
  
  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }
  
  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(companies)
      .set(company)
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }
  
  async deleteCompany(id: number): Promise<boolean> {
    const [result] = await db
      .delete(companies)
      .where(eq(companies.id, id))
      .returning({ id: companies.id });
    return !!result;
  }
  
  // User-Company relations
  async getUserCompanies(userId: number): Promise<UserCompany[]> {
    return await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.userId, userId));
  }
  
  async getCompanyUsers(companyId: number): Promise<UserCompany[]> {
    return await db
      .select()
      .from(userCompanies)
      .where(eq(userCompanies.companyId, companyId));
  }
  
  async assignUserToCompany(userId: number, companyId: number, role: string): Promise<UserCompany> {
    // Verificar si ya existe la relación
    const existingRelation = await db
      .select()
      .from(userCompanies)
      .where(
        and(
          eq(userCompanies.userId, userId),
          eq(userCompanies.companyId, companyId)
        )
      );
    
    if (existingRelation.length > 0) {
      // Actualizar el rol si ya existe
      const [updated] = await db
        .update(userCompanies)
        .set({ role })
        .where(
          and(
            eq(userCompanies.userId, userId),
            eq(userCompanies.companyId, companyId)
          )
        )
        .returning();
      return updated;
    } else {
      // Crear una nueva relación
      const [newRelation] = await db
        .insert(userCompanies)
        .values({ userId, companyId, role })
        .returning();
      return newRelation;
    }
  }
  
  async removeUserFromCompany(userId: number, companyId: number): Promise<boolean> {
    const [result] = await db
      .delete(userCompanies)
      .where(
        and(
          eq(userCompanies.userId, userId),
          eq(userCompanies.companyId, companyId)
        )
      )
      .returning({ id: userCompanies.id });
    return !!result;
  }
  
  // Schedule Templates
  async getScheduleTemplates(userId?: number): Promise<ScheduleTemplate[]> {
    if (userId) {
      // Obtener plantillas creadas por el usuario o de sus empresas
      const userCompanyEntries = await db
        .select({
          companyId: userCompanies.companyId
        })
        .from(userCompanies)
        .where(eq(userCompanies.userId, userId));
      
      const companyIds = userCompanyEntries.map(entry => entry.companyId);
      
      return await db
        .select()
        .from(scheduleTemplates)
        .where(
          or(
            eq(scheduleTemplates.createdBy, userId),
            companyIds.length > 0 ? inArray(scheduleTemplates.companyId, companyIds) : isNull(scheduleTemplates.id)
          )
        )
        .orderBy(desc(scheduleTemplates.createdAt));
    } else {
      // Obtener todas las plantillas (para administradores)
      return await db
        .select()
        .from(scheduleTemplates)
        .orderBy(desc(scheduleTemplates.createdAt));
    }
  }
  
  async getScheduleTemplate(id: number): Promise<ScheduleTemplate | undefined> {
    const [template] = await db.select().from(scheduleTemplates).where(eq(scheduleTemplates.id, id));
    return template;
  }
  
  async createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate> {
    const [newTemplate] = await db.insert(scheduleTemplates).values(template).returning();
    return newTemplate;
  }
  
  async updateScheduleTemplate(id: number, template: Partial<InsertScheduleTemplate>): Promise<ScheduleTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(scheduleTemplates)
      .set(template)
      .where(eq(scheduleTemplates.id, id))
      .returning();
    return updatedTemplate;
  }
  
  async deleteScheduleTemplate(id: number): Promise<boolean> {
    const [result] = await db
      .delete(scheduleTemplates)
      .where(eq(scheduleTemplates.id, id))
      .returning({ id: scheduleTemplates.id });
    return !!result;
  }
  
  // Employee operations
  async getEmployees(companyId?: number): Promise<Employee[]> {
    if (companyId) {
      return await db
        .select()
        .from(employees)
        .where(eq(employees.companyId, companyId))
        .orderBy(asc(employees.name));
    } else {
      return await db
        .select()
        .from(employees)
        .orderBy(asc(employees.name));
    }
  }
  
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
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
    
    // Condiciones para el filtrado
    const conditions = [];
    
    if (date) {
      conditions.push(eq(shifts.date, date));
    }
    
    if (employeeId) {
      conditions.push(eq(shifts.employeeId, employeeId));
    }
    
    if (companyId) {
      // Para filtrar por compañía, necesitamos unir con la tabla de empleados
      // ya que los turnos están asociados a empleados que pertenecen a empresas
      query = query
        .leftJoin(employees, eq(shifts.employeeId, employees.id))
        .where(eq(employees.companyId, companyId));
      
      // Si también hay otras condiciones, las añadimos
      if (conditions.length > 0) {
        for (const condition of conditions) {
          query = query.where(condition);
        }
      }
      
      return await query;
    } else if (conditions.length > 0) {
      // Si no hay filtro por compañía pero sí hay otras condiciones
      if (conditions.length === 1) {
        query = query.where(conditions[0]);
      } else {
        query = query.where(and(...conditions));
      }
    }
    
    return await query;
  }
  
  async getShift(id: number): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift;
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
  async getSchedules(companyId?: number): Promise<Schedule[]> {
    if (companyId) {
      return await db
        .select()
        .from(schedules)
        .where(eq(schedules.companyId, companyId))
        .orderBy(desc(schedules.createdAt));
    } else {
      return await db
        .select()
        .from(schedules)
        .orderBy(desc(schedules.createdAt));
    }
  }
  
  async getSchedule(id: number): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule;
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
