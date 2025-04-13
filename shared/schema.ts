import { pgTable, text, serial, integer, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  role: text("role").default("user"), // 'admin', 'user'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  taxId: text("tax_id"),
  startHour: integer("start_hour").default(9), // Hora de inicio (por defecto 9:00)
  endHour: integer("end_hour").default(22), // Hora de fin (por defecto 22:00)
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  createdBy: integer("created_by").references(() => users.id),
});

export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  role: text("role").default("member"), // 'owner', 'admin', 'member'
  createdAt: timestamp("created_at").defaultNow(),
});

// Plantillas de horario - Esta es la funcionalidad nueva
export const scheduleTemplates = pgTable("schedule_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Indica si es la plantilla por defecto para nuevas empresas
  startHour: integer("start_hour").notNull().default(8), // Hora de inicio por defecto (8am)
  endHour: integer("end_hour").notNull().default(20), // Hora de fin por defecto (8pm)
  timeIncrement: integer("time_increment").notNull().default(15), // Incremento de tiempo en minutos
  isGlobal: boolean("is_global").default(false), // Si está disponible para todas las empresas
  companyId: integer("company_id").references(() => companies.id), // Nulo para plantillas globales
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  role: true,
}).partial({
  fullName: true,
  role: true,
});

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  description: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  taxId: true,
  logoUrl: true,
  isActive: true,
  createdBy: true,
  startHour: true,
  endHour: true,
}).partial({
  description: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  taxId: true,
  logoUrl: true,
  isActive: true,
  startHour: true,
  endHour: true,
});

export const insertUserCompanySchema = createInsertSchema(userCompanies).pick({
  userId: true,
  companyId: true,
  role: true,
}).partial({
  role: true,
});

export const insertScheduleTemplateSchema = createInsertSchema(scheduleTemplates).pick({
  name: true,
  description: true,
  isDefault: true,
  startHour: true,
  endHour: true,
  timeIncrement: true,
  isGlobal: true,
  companyId: true,
  createdBy: true,
}).partial({
  description: true,
  isDefault: true,
  startHour: true,
  endHour: true,
  timeIncrement: true,
  isGlobal: true,
  companyId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

export type InsertScheduleTemplate = z.infer<typeof insertScheduleTemplateSchema>;
export type ScheduleTemplate = typeof scheduleTemplates.$inferSelect;

// Schema for employees with additional fields
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").default(""),
  // Identificación de empresa
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
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
  // Relaciones de pertenencia
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  templateId: integer("template_id").references(() => scheduleTemplates.id),
  // Fechas y rango de aplicación
  startDate: text("start_date"), // Format: YYYY-MM-DD
  endDate: text("end_date"), // Format: YYYY-MM-DD
  // Metadata
  status: text("status").default("draft"), // "draft", "published", "active", "archived"
  department: text("department"), // Departamento al que aplica el horario
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Relaciones
export const usersRelations = relations(users, ({ many }) => ({
  companies: many(userCompanies),
  createdCompanies: many(companies, { relationName: "createdCompanies" }),
  createdTemplates: many(scheduleTemplates),
  createdSchedules: many(schedules),
}));

export const companiesRelations = relations(companies, ({ many, one }) => ({
  users: many(userCompanies),
  employees: many(employees),
  schedules: many(schedules),
  templates: many(scheduleTemplates),
  creator: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
    relationName: "createdCompanies",
  }),
}));

export const userCompaniesRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, {
    fields: [userCompanies.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [userCompanies.companyId],
    references: [companies.id],
  }),
}));

export const scheduleTemplatesRelations = relations(scheduleTemplates, ({ many, one }) => ({
  schedules: many(schedules),
  company: one(companies, {
    fields: [scheduleTemplates.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [scheduleTemplates.createdBy],
    references: [users.id],
  }),
}));

export const employeesRelations = relations(employees, ({ many, one }) => ({
  shifts: many(shifts),
  skills: many(employeeSkills),
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
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
  company: one(companies, {
    fields: [schedules.companyId],
    references: [companies.id],
  }),
  template: one(scheduleTemplates, {
    fields: [schedules.templateId],
    references: [scheduleTemplates.id],
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
  companyId: true, // Campo obligatorio - empresa a la que pertenece el empleado
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
  companyId: true, // Campo obligatorio - empresa a la que pertenece el horario
  templateId: true, // Plantilla utilizada (opcional)
  startDate: true,
  endDate: true,
  status: true,
  department: true,
  createdBy: true,
}).partial({
  description: true,
  templateId: true,
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
