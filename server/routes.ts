import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertEmployeeSchema, insertShiftSchema, insertScheduleSchema } from "@shared/schema";
import { setupAuth } from "./auth";
import { WebSocketServer } from "ws";
import { syncRemoteDataToLocal } from "./sync";

export async function registerRoutes(app: Express): Promise<Server> {
  // Inicializar el almacenamiento y sincronizar datos
  if (storage.init) {
    await storage.init();
    
    // Intentar sincronizar datos desde la base de datos remota
    try {
      await syncRemoteDataToLocal();
      console.log("Datos sincronizados correctamente desde la base de datos remota");
    } catch (error) {
      console.error("Error al sincronizar datos:", error);
    }
  }
  
  // Configurar la autenticación
  setupAuth(app);
  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      console.log("Fetching employees with companyId:", companyId);
      const employees = await storage.getEmployees(companyId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees", error: String(error) });
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
  
  // Configurar WebSocket Server (separado de la ruta de HMR de Vite)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Cliente WebSocket conectado');
    
    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Conectado al servidor WebSocket'
    }));
    
    // Manejar mensajes del cliente
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Mensaje recibido:', data);
        
        // Aquí puedes implementar lógica específica basada en el tipo de mensaje
        // Por ejemplo, sincronización en tiempo real de turnos
        if (data.type === 'shift_update') {
          // Broadcast a todos los clientes conectados excepto al remitente
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'shift_updated',
                data: data.data
              }));
            }
          });
        }
      } catch (error) {
        console.error('Error al procesar mensaje WebSocket:', error);
      }
    });
    
    // Manejar desconexión
    ws.on('close', () => {
      console.log('Cliente WebSocket desconectado');
    });
  });
  
  return httpServer;
}
