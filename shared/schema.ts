import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// New schema for employees
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").default(""),
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  name: true,
  role: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// Schema for shifts
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: text("date").notNull(), // Format: YYYY-MM-DD
  startTime: text("start_time").notNull(), // Format: HH:MM
  endTime: text("end_time").notNull(), // Format: HH:MM
  notes: text("notes").default(""),
});

export const insertShiftSchema = createInsertSchema(shifts).pick({
  employeeId: true,
  date: true,
  startTime: true,
  endTime: true,
  notes: true,
});

export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// Schema for schedules (for saving/loading entire schedules)
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(schedules).pick({
  name: true,
  description: true,
});

export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;
