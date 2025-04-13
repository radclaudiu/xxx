import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertEmployeeSchema, insertShiftSchema, insertScheduleSchema, insertCompanySchema, insertScheduleTemplateSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticación
  setupAuth(app);
  
  // Rutas para usuarios - Solo administradores pueden ver todos los usuarios
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error al obtener usuarios" });
    }
  });
  
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
  app.get("/api/employees", isAuthenticated, async (req, res) => {
    try {
      // Si el usuario es administrador y no especifica una empresa, devolver todos los empleados
      // Si el usuario es de una empresa específica, solo devolver los empleados de esa empresa
      let companyId: number | undefined = undefined;
      
      if (req.query.companyId) {
        companyId = parseInt(req.query.companyId as string);
      } else if (req.user?.role !== "admin") {
        // Para usuarios no-admin, verificar si pertenecen solo a una empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        
        if (userCompanies.length === 1) {
          // Si solo pertenece a una empresa, usar esa
          companyId = userCompanies[0].companyId;
        } else if (userCompanies.length === 0) {
          // Si no pertenece a ninguna empresa, devolver lista vacía
          return res.json([]);
        }
        // Si pertenece a varias empresas, req.query.companyId debería especificar cuál
      }
      
      const employees = await storage.getEmployees(companyId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", isAuthenticated, async (req, res) => {
    try {
      // Determinar la compañía del usuario si no es administrador
      let companyId = req.body.companyId;
      
      if (!companyId && req.user?.role !== "admin") {
        // Para usuarios no-admin, verificar si pertenecen solo a una empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        
        if (userCompanies.length === 1) {
          // Si solo pertenece a una empresa, usar esa
          companyId = userCompanies[0].companyId;
        } else if (userCompanies.length === 0) {
          // Si no pertenece a ninguna empresa, no puede crear empleados
          return res.status(403).json({ message: "No tiene permisos para crear empleados" });
        } else {
          // Si pertenece a varias empresas, debe especificar a cuál
          return res.status(400).json({ message: "Debe especificar companyId cuando pertenece a múltiples empresas" });
        }
      }
      
      const validatedData = insertEmployeeSchema.parse({
        ...req.body,
        companyId
      });
      
      const employee = await storage.createEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        console.error("Error creating employee:", error);
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
  app.get("/api/shifts", isAuthenticated, async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined;
      let companyId: number | undefined = undefined;
      
      if (req.query.companyId) {
        companyId = parseInt(req.query.companyId as string);
      } else if (req.user?.role !== "admin") {
        // Para usuarios no-admin, verificar si pertenecen solo a una empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        
        if (userCompanies.length === 1) {
          // Si solo pertenece a una empresa, usar esa
          companyId = userCompanies[0].companyId;
        } else if (userCompanies.length === 0) {
          // Si no pertenece a ninguna empresa, devolver lista vacía
          return res.json([]);
        }
        // Si pertenece a varias empresas, req.query.companyId debería especificar cuál
      }
      
      const shifts = await storage.getShifts(date, employeeId, companyId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post("/api/shifts", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertShiftSchema.parse(req.body);
      
      // Verificar que el empleado existe
      const employee = await storage.getEmployee(validatedData.employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Verificar que el usuario tenga permiso para crear turnos para este empleado
      if (req.user?.role !== "admin") {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const userCompanyIds = userCompanies.map(uc => uc.companyId);
        
        if (!userCompanyIds.includes(employee.companyId)) {
          return res.status(403).json({ message: "No tiene permisos para crear turnos para este empleado" });
        }
      }
      
      const shift = await storage.createShift(validatedData);
      res.status(201).json(shift);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid shift data", errors: error.errors });
      } else {
        console.error("Error creating shift:", error);
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
  app.get("/api/schedules", isAuthenticated, async (req, res) => {
    try {
      let companyId: number | undefined = undefined;
      
      if (req.query.companyId) {
        companyId = parseInt(req.query.companyId as string);
      } else if (req.user?.role !== "admin") {
        // Para usuarios no-admin, verificar si pertenecen solo a una empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        
        if (userCompanies.length === 1) {
          // Si solo pertenece a una empresa, usar esa
          companyId = userCompanies[0].companyId;
        } else if (userCompanies.length === 0) {
          // Si no pertenece a ninguna empresa, devolver lista vacía
          return res.json([]);
        }
        // Si pertenece a varias empresas, req.query.companyId debería especificar cuál
      }
      
      const schedules = await storage.getSchedules(companyId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.post("/api/schedules", isAuthenticated, async (req, res) => {
    try {
      // Determinar la compañía del usuario si no es administrador
      let companyId = req.body.companyId;
      
      if (!companyId && req.user?.role !== "admin") {
        // Para usuarios no-admin, verificar si pertenecen solo a una empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        
        if (userCompanies.length === 1) {
          // Si solo pertenece a una empresa, usar esa
          companyId = userCompanies[0].companyId;
        } else if (userCompanies.length === 0) {
          // Si no pertenece a ninguna empresa, no puede crear horarios
          return res.status(403).json({ message: "No tiene permisos para crear horarios" });
        } else {
          // Si pertenece a varias empresas, debe especificar a cuál
          return res.status(400).json({ message: "Debe especificar companyId cuando pertenece a múltiples empresas" });
        }
      } else if (companyId && req.user?.role !== "admin") {
        // Verificar que el usuario tenga permiso para crear horarios para esta empresa
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const userCompanyIds = userCompanies.map(uc => uc.companyId);
        
        if (!userCompanyIds.includes(companyId)) {
          return res.status(403).json({ message: "No tiene permisos para crear horarios para esta empresa" });
        }
      }
      
      const validatedData = insertScheduleSchema.parse({
        ...req.body,
        companyId,
        createdBy: req.user?.id
      });
      
      const schedule = await storage.createSchedule(validatedData);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid schedule data", errors: error.errors });
      } else {
        console.error("Error creating schedule:", error);
        res.status(500).json({ message: "Failed to create schedule" });
      }
    }
  });

  app.post("/api/schedules/:id/save", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { employees, shifts } = req.body;
      
      // Verificar que el horario existe
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Verificar que el usuario tenga permiso para editar este horario
      if (req.user?.role !== "admin") {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const userCompanyIds = userCompanies.map(uc => uc.companyId);
        
        if (!userCompanyIds.includes(schedule.companyId)) {
          return res.status(403).json({ message: "No tiene permisos para editar este horario" });
        }
      }
      
      const success = await storage.saveScheduleData(id, employees, shifts);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to save schedule data" });
      }
      
      res.json({ message: "Schedule data saved successfully" });
    } catch (error) {
      console.error("Error saving schedule data:", error);
      res.status(500).json({ message: "Failed to save schedule data" });
    }
  });

  app.get("/api/schedules/:id/load", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el horario existe
      const schedule = await storage.getSchedule(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // Verificar que el usuario tenga permiso para ver este horario
      if (req.user?.role !== "admin") {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const userCompanyIds = userCompanies.map(uc => uc.companyId);
        
        if (!userCompanyIds.includes(schedule.companyId)) {
          return res.status(403).json({ message: "No tiene permisos para ver este horario" });
        }
      }
      
      const data = await storage.loadScheduleData(id);
      
      if (!data) {
        return res.status(404).json({ message: "No data found for this schedule" });
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error loading schedule data:", error);
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
