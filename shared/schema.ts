import { pgTable, text, serial, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Schema for employees with additional fields
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").default(""),
  // Información de contacto
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  // Información laboral
  hireDate: date("hire_date"),
  contractType: text("contract_type"), // Tiempo completo, medio tiempo, etc.
  hourlyRate: integer("hourly_rate"), // Tarifa por hora
  maxHoursPerWeek: integer("max_hours_per_week"), // Máximo de horas que puede trabajar
  // Preferencias y restricciones
  preferredDays: text("preferred_days"), // Días que prefiere trabajar (formato JSON)
  unavailableDays: text("unavailable_days"), // Días que no puede trabajar (formato JSON)
  isActive: boolean("is_active").default(true), // Si el empleado está activo
  notes: text("notes"), // Notas adicionales
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Habilidades (Skills) - Nueva tabla
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

// Relación entre empleados y habilidades - Nueva tabla
export const employeeSkills = pgTable("employee_skills", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  skillId: integer("skill_id").notNull().references(() => skills.id, { onDelete: 'cascade' }),
  level: integer("level"), // Nivel de habilidad 1-5
});

// Schema for shifts with additional fields
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  startTime: text("start_time").notNull(), // Format: HH:MM
  endTime: text("end_time").notNull(), // Format: HH:MM
  notes: text("notes").default(""),
  // Campos adicionales
  status: text("status").default("scheduled"), // "scheduled", "completed", "cancelled", etc.
  breakTime: integer("break_time"), // Tiempo de descanso en minutos
  actualStartTime: text("actual_start_time"), // Hora real de inicio
  actualEndTime: text("actual_end_time"), // Hora real de término
  totalHours: integer("total_hours"), // Horas totales trabajadas
  scheduleId: integer("schedule_id"), // Relación se agregará más tarde
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Schema for schedules (for saving/loading entire schedules)
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  startDate: text("start_date"), // Format: YYYY-MM-DD
  endDate: text("end_date"), // Format: YYYY-MM-DD
  status: text("status").default("draft"), // "draft", "published", "active", "archived"
  department: text("department"), // Departamento al que aplica el horario
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Relaciones
export const employeesRelations = relations(employees, ({ many }) => ({
  shifts: many(shifts),
  skills: many(employeeSkills),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  employees: many(employeeSkills),
}));

export const employeeSkillsRelations = relations(employeeSkills, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeSkills.employeeId],
    references: [employees.id],
  }),
  skill: one(skills, {
    fields: [employeeSkills.skillId],
    references: [skills.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
  schedule: one(schedules, {
    fields: [shifts.scheduleId],
    references: [schedules.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ many, one }) => ({
  shifts: many(shifts),
  createdByUser: one(users, {
    fields: [schedules.createdBy],
    references: [users.id],
  }),
}));

// Exportar schemas para inserciones
export const insertEmployeeSchema = createInsertSchema(employees, {
  email: z.string().email().optional(),
  phone: z.string().optional(),
  hireDate: z.string().optional(), // Aceptar string para facilitar la entrada desde el frontend
}).pick({
  name: true,
  role: true,
  email: true,
  phone: true,
  address: true,
  hireDate: true,
  contractType: true,
  hourlyRate: true,
  maxHoursPerWeek: true,
  preferredDays: true,
  unavailableDays: true,
  isActive: true,
  notes: true,
}).partial({
  role: true,
  email: true,
  phone: true,
  address: true,
  hireDate: true,
  contractType: true,
  hourlyRate: true,
  maxHoursPerWeek: true,
  preferredDays: true,
  unavailableDays: true,
  isActive: true,
  notes: true,
});

export const insertShiftSchema = createInsertSchema(shifts).pick({
  employeeId: true,
  date: true,
  startTime: true,
  endTime: true,
  notes: true,
  status: true,
  breakTime: true,
  scheduleId: true,
}).partial({
  notes: true,
  status: true,
  breakTime: true,
  scheduleId: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).pick({
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  department: true,
  createdBy: true,
}).partial({
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  department: true,
  createdBy: true,
});

export const insertSkillSchema = createInsertSchema(skills).pick({
  name: true,
  description: true,
}).partial({
  description: true,
});

export const insertEmployeeSkillSchema = createInsertSchema(employeeSkills).pick({
  employeeId: true,
  skillId: true,
  level: true,
}).partial({
  level: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Skill = typeof skills.$inferSelect;

export type InsertEmployeeSkill = z.infer<typeof insertEmployeeSkillSchema>;
export type EmployeeSkill = typeof employeeSkills.$inferSelect;
