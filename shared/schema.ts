import { pgTable, text, serial, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Usuario básico para autenticación
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Definición de tabla de empresas
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  logo: text("logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Relación entre usuarios y empresas (muchos a muchos)
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  company_id: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  role: text("role").default("user").notNull(), // 'admin', 'user', etc.
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Schema de empleados con campos adicionales
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").default(""),
  // Relación con empresa
  companyId: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
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

// Habilidades (Skills)
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

// Relación entre empleados y habilidades
export const employeeSkills = pgTable("employee_skills", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  skillId: integer("skill_id").notNull().references(() => skills.id, { onDelete: 'cascade' }),
  level: integer("level"), // Nivel de habilidad 1-5
});

// Schema para turnos con campos adicionales
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
  scheduleId: integer("schedule_id"), // Relación con horarios
  companyId: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }), // Relación con empresa
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Schema para horarios (guardar/cargar horarios completos)
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  startDate: text("start_date"), // Format: YYYY-MM-DD
  endDate: text("end_date"), // Format: YYYY-MM-DD
  status: text("status").default("draft"), // "draft", "published", "active", "archived"
  department: text("department"), // Departamento al que aplica el horario
  companyId: integer("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Definiciones de relaciones
export const userRelations = relations(users, ({ many }) => ({
  userCompanies: many(userCompanies),
  schedulesCreated: many(schedules, { relationName: "createdByUser" })
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  employees: many(employees),
  userCompanies: many(userCompanies),
  schedules: many(schedules),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
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
  company: one(companies, {
    fields: [shifts.companyId],
    references: [companies.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  company: one(companies, {
    fields: [schedules.companyId],
    references: [companies.id],
  }),
  shifts: many(shifts),
  createdByUser: one(users, {
    fields: [schedules.createdBy],
    references: [users.id],
    relationName: "createdByUser"
  }),
}));

// Schemas para inserciones
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCompanySchema = createInsertSchema(companies, {
  email: z.string().email().optional(),
}).pick({
  name: true,
  description: true,
  logo: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  active: true,
}).partial({
  description: true,
  logo: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  active: true,
});

export const insertUserCompanySchema = createInsertSchema(userCompanies).pick({
  user_id: true,
  company_id: true,
  role: true,
}).partial({
  role: true,
});

export const insertEmployeeSchema = createInsertSchema(employees, {
  email: z.string().email().optional(),
  phone: z.string().optional(),
  hireDate: z.string().optional(), // Aceptar string para facilitar la entrada desde el frontend
}).pick({
  name: true,
  role: true,
  companyId: true,
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
  companyId: true,
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
  companyId: true,
}).partial({
  notes: true,
  status: true,
  breakTime: true,
  scheduleId: true,
  companyId: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).pick({
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  department: true,
  companyId: true,
  createdBy: true,
}).partial({
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  department: true,
  companyId: true,
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

// Tipos de exportación
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type UserCompany = typeof userCompanies.$inferSelect;
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;

export type EmployeeSkill = typeof employeeSkills.$inferSelect;
export type InsertEmployeeSkill = z.infer<typeof insertEmployeeSkillSchema>;