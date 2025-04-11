import { 
  Employee, InsertEmployee, 
  Shift, InsertShift,
  Schedule, InsertSchedule
} from "@shared/schema";

export interface IStorage {
  // Employee operations
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: number): Promise<boolean>;
  
  // Shift operations
  getShifts(date?: string, employeeId?: number): Promise<Shift[]>;
  getShift(id: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  
  // Schedule operations (save/load)
  getSchedules(): Promise<Schedule[]>;
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

export const storage = new MemStorage();
