import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertEmployeeSchema, insertShiftSchema, insertScheduleSchema, 
  insertCompanySchema, insertScheduleTemplateSchema, insertDailySalesSchema,
  insertLockedWeekSchema
} from "@shared/schema";
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
  
  // Eliminar usuario - Solo administradores pueden eliminar usuarios
  app.delete("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // No permitir eliminar al usuario que está realizando la solicitud
      if (userId === req.user?.id) {
        return res.status(400).json({ message: "No puedes eliminar tu propio usuario" });
      }
      
      // Verificar si el usuario existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // No permitir eliminar al admin principal
      if (user.role === "admin" && user.username === "admin") {
        return res.status(400).json({ message: "No se puede eliminar el usuario administrador principal" });
      }
      
      const success = await storage.deleteUser(userId);
      if (success) {
        res.status(204).end();
      } else {
        res.status(500).json({ message: "Error al eliminar el usuario" });
      }
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      res.status(500).json({ message: "Error al eliminar el usuario" });
    }
  });
  
  // Rutas para empresas - Solo administradores pueden crear/editar empresas
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      // Si es administrador, devolver todas las empresas
      // Si es un usuario normal, devolver solo las empresas a las que pertenece
      const userId = req.user?.role === "admin" ? undefined : req.user?.id;
      console.log("Obteniendo empresas para usuario:", userId);
      
      const companies = await storage.getCompanies(userId);
      console.log("Empresas obtenidas:", companies);
      res.json(companies);
    } catch (error) {
      console.error("Error detallado al obtener empresas:", error);
      res.status(500).json({ 
        message: "Error al obtener empresas", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.post("/api/companies", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse({
        ...req.body,
        createdBy: req.user?.id
      });
      
      console.log("Creando empresa con datos:", validatedData);
      const company = await storage.createCompany(validatedData);
      console.log("Empresa creada:", company);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Error de validación al crear empresa:", error.errors);
        res.status(400).json({ message: "Datos de empresa inválidos", errors: error.errors });
      } else {
        console.error("Error detallado al crear empresa:", error);
        res.status(500).json({ 
          message: "Error al crear empresa", 
          error: error instanceof Error ? error.message : String(error) 
        });
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
  
  // Ruta para actualizar campos específicos de una empresa (accesible para todos los usuarios autenticados)
  app.patch("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Para la actualización parcial, solo permitimos actualizar campos específicos
      // cuando se trata de usuarios regulares
      const isAdminUser = req.user?.role === 'admin';
      
      // Schema específico para actualización de rango horario
      const timeRangeSchema = z.object({
        startHour: z.number().min(0).max(23).optional(),
        endHour: z.number().min(0).max(23).optional(),
      });
      
      // Si es admin, permitimos actualizar todos los campos, de lo contrario solo rangos horarios
      const validatedData = isAdminUser 
        ? insertCompanySchema.partial().parse(req.body)
        : timeRangeSchema.parse(req.body);
      
      // Verificamos que el usuario tenga acceso a esta empresa
      const userCompanies = await storage.getUserCompanies(req.user!.id);
      const hasAccess = isAdminUser || userCompanies.some(uc => uc.companyId === id);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a esta empresa" });
      }
      
      const company = await storage.updateCompany(id, validatedData);
      
      if (!company) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }
      
      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Datos de empresa inválidos", errors: error.errors });
      } else {
        console.error("Error al actualizar empresa:", error);
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
  
  // Middleware para verificar si el usuario es administrador o gerente de la empresa
  const isAdminOrManager = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    // Si el usuario es admin, permitir acceso
    if (req.user.role === "admin") {
      return next();
    }
    
    const companyId = parseInt(req.params.companyId);
    
    // Verificar si el usuario es gerente de la empresa
    const userCompanies = await storage.getUserCompanies(req.user.id);
    const company = userCompanies.find(uc => uc.companyId === companyId && uc.role === "manager");
    
    if (company) {
      return next();
    }
    
    res.status(403).json({ message: "No tiene permiso para realizar esta acción" });
  };
  
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
  
  // Asignar usuario a empresa por correo electrónico (admin o gerentes de la empresa)
  app.post("/api/companies/:companyId/assign-by-email", isAdminOrManager, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const { email, role } = req.body;
      
      // Verificar que la empresa existe
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa no encontrada" });
      }
      
      // Buscar usuario por correo electrónico
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No se encontró ningún usuario con ese correo electrónico" });
      }
      
      // Verificar que el usuario no esté ya asignado a la empresa
      const userCompanies = await storage.getUserCompanies(user.id);
      const existingAssignment = userCompanies.find(uc => uc.companyId === companyId);
      
      if (existingAssignment) {
        return res.status(400).json({ message: "Este usuario ya está asignado a la empresa" });
      }
      
      // No permitir asignar rol de admin por este método
      const finalRole = role === "admin" ? "manager" : role;
      
      const userCompany = await storage.assignUserToCompany(user.id, companyId, finalRole);
      res.status(201).json(userCompany);
    } catch (error) {
      console.error("Error al asignar usuario por email:", error);
      res.status(500).json({ message: "Error al asignar usuario a empresa" });
    }
  });
  
  // Eliminar usuario de empresa (admin o gerentes)
  app.delete("/api/companies/:companyId/users/:userId", isAdminOrManager, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const userId = parseInt(req.params.userId);
      
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
      
      const success = await storage.removeUserFromCompany(userId, companyId);
      if (!success) {
        return res.status(404).json({ message: "Relación no encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar usuario de empresa" });
    }
  });
  
  // Endpoint para obtener relaciones usuario-empresa
  app.get("/api/user-companies", isAuthenticated, async (req, res) => {
    try {
      const allUserCompanies = [];
      
      // Para cada empresa, obtener sus usuarios
      for (const company of await storage.getCompanies()) {
        const companyUsers = await storage.getCompanyUsers(company.id);
        for (const userCompany of companyUsers) {
          // Obtener datos completos del usuario
          const user = await storage.getUser(userCompany.userId);
          
          allUserCompanies.push({
            ...userCompany,
            user: {
              id: user?.id,
              username: user?.username,
              email: user?.email,
              fullName: user?.fullName,
              role: user?.role
            },
            company: {
              id: company.id,
              name: company.name
            }
          });
        }
      }
      
      res.json(allUserCompanies);
    } catch (error) {
      console.error("Error al obtener relaciones usuario-empresa:", error);
      res.status(500).json({ message: "Error al obtener relaciones usuario-empresa" });
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

  // Daily Sales Endpoints - para la venta estimada diaria
  app.get("/api/companies/:companyId/daily-sales", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const { date } = req.query;
      
      // Verificar que el usuario tenga acceso a esta empresa
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasAccess = userCompanies.some(uc => uc.companyId === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "No tienes acceso a esta empresa" });
        }
      }
      
      // Si se especificó una fecha, obtener solo ese registro
      if (date && typeof date === 'string') {
        const dailySale = await storage.getDailySaleByDate(companyId, date);
        if (dailySale) {
          return res.json([dailySale]);
        } else {
          return res.json([]);
        }
      }
      
      // Si no se especificó fecha, obtener todos los registros de la empresa
      const dailySales = await storage.getDailySales(companyId);
      res.json(dailySales);
    } catch (error) {
      console.error("Error al obtener ventas diarias:", error);
      res.status(500).json({ message: "Error al obtener datos de ventas diarias" });
    }
  });
  
  app.get("/api/companies/:companyId/daily-sales/:date", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const date = req.params.date;
      
      // Verificar que el usuario tenga acceso a esta empresa
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasAccess = userCompanies.some(uc => uc.companyId === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "No tienes acceso a esta empresa" });
        }
      }
      
      const dailySale = await storage.getDailySaleByDate(companyId, date);
      
      if (!dailySale) {
        return res.status(404).json({ message: "No hay datos para esta fecha" });
      }
      
      res.json(dailySale);
    } catch (error) {
      console.error("Error al obtener venta diaria:", error);
      res.status(500).json({ message: "Error al obtener datos de venta diaria" });
    }
  });
  
  app.post("/api/companies/:companyId/daily-sales", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Verificar que el usuario tenga acceso a esta empresa como gerente o admin
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasManagerAccess = userCompanies.some(
          uc => uc.companyId === companyId && (uc.role === 'manager' || uc.role === 'admin')
        );
        
        if (!hasManagerAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para modificar datos de esta empresa" 
          });
        }
      }
      
      // Validar datos de entrada
      const validatedData = insertDailySalesSchema.parse({
        ...req.body,
        companyId,
      });
      
      // Verificar si ya existe un registro para esta fecha
      const existingData = await storage.getDailySaleByDate(companyId, validatedData.date);
      
      if (existingData) {
        // Actualizar registro existente
        const updatedData = await storage.updateDailySale(existingData.id, validatedData);
        return res.json(updatedData);
      } else {
        // Crear nuevo registro
        const newDailySale = await storage.createDailySale(validatedData);
        return res.status(201).json(newDailySale);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Error de validación Zod:", JSON.stringify(error.errors));
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: error.errors 
        });
      }
      
      console.error("Error al guardar venta diaria:", error);
      res.status(500).json({ message: "Error al guardar datos de venta diaria" });
    }
  });
  
  app.put("/api/companies/:companyId/daily-sales/:id", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const id = parseInt(req.params.id);
      
      // Verificar que el usuario tenga acceso a esta empresa como gerente o admin
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasManagerAccess = userCompanies.some(
          uc => uc.companyId === companyId && (uc.role === 'manager' || uc.role === 'admin')
        );
        
        if (!hasManagerAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para modificar datos de esta empresa" 
          });
        }
      }
      
      // Obtener registro actual para verificar que pertenece a la empresa indicada
      const currentRecord = await storage.getDailySale(id);
      if (!currentRecord) {
        return res.status(404).json({ message: "Registro no encontrado" });
      }
      
      if (currentRecord.companyId !== companyId) {
        return res.status(403).json({ 
          message: "El registro no pertenece a la empresa indicada" 
        });
      }
      
      // Validar datos de entrada
      const validatedData = insertDailySalesSchema.partial().parse({
        ...req.body,
        companyId, // Asegurar que no se cambie la empresa
      });
      
      // Actualizar registro
      const updatedData = await storage.updateDailySale(id, validatedData);
      
      if (!updatedData) {
        return res.status(404).json({ message: "No se pudo actualizar el registro" });
      }
      
      res.json(updatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Datos inválidos", 
          errors: error.errors 
        });
      }
      
      console.error("Error al actualizar venta diaria:", error);
      res.status(500).json({ message: "Error al actualizar datos de venta diaria" });
    }
  });
  
  app.delete("/api/companies/:companyId/daily-sales/:id", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const id = parseInt(req.params.id);
      
      // Verificar que el usuario tenga acceso a esta empresa como gerente o admin
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasManagerAccess = userCompanies.some(
          uc => uc.companyId === companyId && (uc.role === 'manager' || uc.role === 'admin')
        );
        
        if (!hasManagerAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para eliminar datos de esta empresa" 
          });
        }
      }
      
      // Obtener registro actual para verificar que pertenece a la empresa indicada
      const currentRecord = await storage.getDailySale(id);
      if (!currentRecord) {
        return res.status(404).json({ message: "Registro no encontrado" });
      }
      
      if (currentRecord.companyId !== companyId) {
        return res.status(403).json({ 
          message: "El registro no pertenece a la empresa indicada" 
        });
      }
      
      // Eliminar registro
      const success = await storage.deleteDailySale(id);
      
      if (!success) {
        return res.status(404).json({ message: "No se pudo eliminar el registro" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar venta diaria:", error);
      res.status(500).json({ message: "Error al eliminar datos de venta diaria" });
    }
  });

  // ===== RUTAS PARA SEMANAS BLOQUEADAS =====
  
  // Obtener todas las semanas bloqueadas para una empresa
  app.get("/api/companies/:companyId/locked-weeks", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Verificar que el usuario tenga acceso a esta empresa
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasAccess = userCompanies.some(uc => uc.companyId === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para ver semanas bloqueadas de esta empresa" 
          });
        }
      }
      
      const lockedWeeks = await storage.getLockedWeeks(companyId);
      res.json(lockedWeeks);
    } catch (error) {
      console.error("Error al obtener semanas bloqueadas:", error);
      res.status(500).json({ message: "Error al obtener semanas bloqueadas" });
    }
  });
  
  // Verificar si una semana específica está bloqueada
  app.get("/api/companies/:companyId/locked-weeks/:weekStartDate", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const weekStartDate = req.params.weekStartDate;
      
      // Verificar que el usuario tenga acceso a esta empresa
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasAccess = userCompanies.some(uc => uc.companyId === companyId);
        
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para ver semanas bloqueadas de esta empresa" 
          });
        }
      }
      
      const isLocked = await storage.isWeekLocked(companyId, weekStartDate);
      res.json({ isLocked });
    } catch (error) {
      console.error("Error al verificar semana bloqueada:", error);
      res.status(500).json({ message: "Error al verificar si la semana está bloqueada" });
    }
  });
  
  // Bloquear una semana
  app.post("/api/companies/:companyId/locked-weeks", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Verificar que el usuario tenga acceso a esta empresa como gerente o admin
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasManagerAccess = userCompanies.some(
          uc => uc.companyId === companyId && (uc.role === 'manager' || uc.role === 'admin')
        );
        
        if (!hasManagerAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para bloquear semanas en esta empresa" 
          });
        }
      }
      
      // Validar datos de entrada
      const schema = z.object({
        weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido. Use YYYY-MM-DD"),
      });
      
      const validatedData = schema.parse(req.body);
      
      // Obtener el usuario actual de la sesión
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuario no autenticado" });
      }
      
      // Primero obtenemos los empleados actuales de la empresa para guardarlos en el bloqueo
      const employees = await storage.getEmployees(companyId);
      
      // Bloqueamos la semana
      const lockedWeek = await storage.lockWeek(
        companyId, 
        validatedData.weekStartDate,
        userId
      );
      
      // Guardamos los empleados actuales asociados a la semana bloqueada
      if (employees.length > 0) {
        await storage.saveLockedWeekEmployees(lockedWeek.id, employees);
        console.log(`Guardados ${employees.length} empleados para la semana bloqueada ID: ${lockedWeek.id}`);
      }
      
      res.status(201).json(lockedWeek);
    } catch (error) {
      console.error("Error al bloquear semana:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      
      res.status(500).json({ message: "Error al bloquear semana" });
    }
  });
  
  // Desbloquear una semana
  app.delete("/api/companies/:companyId/locked-weeks/:weekStartDate", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const weekStartDate = req.params.weekStartDate;
      
      // Verificar que el usuario tenga acceso a esta empresa como gerente o admin
      const isAdminUser = req.user?.role === 'admin';
      if (!isAdminUser) {
        const userCompanies = await storage.getUserCompanies(req.user!.id);
        const hasManagerAccess = userCompanies.some(
          uc => uc.companyId === companyId && (uc.role === 'manager' || uc.role === 'admin')
        );
        
        if (!hasManagerAccess) {
          return res.status(403).json({ 
            message: "No tienes permisos para desbloquear semanas en esta empresa" 
          });
        }
      }
      
      const result = await storage.unlockWeek(companyId, weekStartDate);
      
      if (!result) {
        return res.status(404).json({ message: "Semana bloqueada no encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error al desbloquear semana:", error);
      res.status(500).json({ message: "Error al desbloquear semana" });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
