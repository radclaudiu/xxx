import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertEmployeeSchema, insertShiftSchema, insertScheduleSchema, insertCompanySchema, insertScheduleTemplateSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticación
  setupAuth(app);
  
  // Rutas para empresas - Solo administradores pueden crear/editar empresas
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      // Si es administrador, devolver todas las empresas
      // Si es un usuario normal, devolver solo las empresas a las que pertenece
      const companies = await storage.getCompanies(
        req.user?.role === "admin" ? undefined : req.user?.id
      );
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener empresas" });
    }
  });
  
  app.post("/api/companies", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });
      
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos de empresa inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error al crear empresa" });
      }
    }
  });
  
  app.put("/api/companies/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCompanySchema.partial().parse(req.body);
      
      const company = await storage.updateCompany(id, validatedData);
      
      if (!company) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }
      
      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos de empresa inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error al actualizar empresa" });
      }
    }
  });
  
  app.delete("/api/companies/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCompany(id);
      
      if (!success) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar empresa" });
    }
  });
  
  // Asignar usuario a empresa (solo administradores)
  app.post("/api/companies/:companyId/users", isAdmin, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const { userId, role } = req.body;
      
      // Verificar que la empresa existe
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }
      
      // Verificar que el usuario existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      const userCompany = await storage.assignUserToCompany(userId, companyId, role);
      res.status(201).json(userCompany);
    } catch (error) {
      res.status(500).json({ message: "Error al asignar usuario a empresa" });
    }
  });
  
  // Plantillas de horario
  app.get("/api/schedule-templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getScheduleTemplates(
        req.user?.role === "admin" ? undefined : req.user?.id
      );
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener plantillas" });
    }
  });
  
  app.post("/api/schedule-templates", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertScheduleTemplateSchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });
      
      const template = await storage.createScheduleTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos de plantilla inválidos", errors: error.errors });
      } else {
        res.status(500).json({ message: "Error al crear plantilla" });
      }
    }
  });
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create employee" });
      }
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      const employee = await storage.updateEmployee(id, validatedData);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update employee" });
      }
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployee(id);
      
      if (!success) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Shift routes
  app.get("/api/shifts", async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
      
      const shifts = await storage.getShifts(date, employeeId);
      res.json(shifts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post("/api/shifts", async (req, res) => {
    try {
      const validatedData = insertShiftSchema.parse(req.body);
      
      // Verify employee exists
      const employee = await storage.getEmployee(validatedData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      const shift = await storage.createShift(validatedData);
      res.status(201).json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create shift" });
      }
    }
  });

  app.put("/api/shifts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertShiftSchema.partial().parse(req.body);
      
      if (validatedData.employeeId) {
        // Verify employee exists if updating employeeId
        const employee = await storage.getEmployee(validatedData.employeeId);
        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }
      }
      
      const shift = await storage.updateShift(id, validatedData);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update shift" });
      }
    }
  });

  app.delete("/api/shifts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteShift(id);
      
      if (!success) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete shift" });
    }
  });

  // Schedule routes (for saving/loading)
  app.get("/api/schedules", async (req, res) => {
    try {
      const schedules = await storage.getSchedules();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const validatedData = insertScheduleSchema.parse(req.body);
      const schedule = await storage.createSchedule(validatedData);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid schedule data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create schedule" });
      }
    }
  });

  app.post("/api/schedules/:id/save", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { employees, shifts } = req.body;
      
      // Verify schedule exists
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      const success = await storage.saveScheduleData(id, employees, shifts);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to save schedule data" });
      }
      
      res.json({ message: "Schedule data saved successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to save schedule data" });
    }
  });

  app.get("/api/schedules/:id/load", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verify schedule exists
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      const data = await storage.loadScheduleData(id);
      
      if (!data) {
        return res.status(404).json({ message: "No data found for this schedule" });
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to load schedule data" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSchedule(id);
      
      if (!success) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
