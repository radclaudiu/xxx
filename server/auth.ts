import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    // extender la interfaz del usuario con nuestro tipo
    interface User {
      id: number;
      username: string;
      password: string;
      createdAt: Date | null;
      updatedAt: Date | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Establecer a false para desarrollo
      maxAge: 1000 * 60 * 60 * 24 * 7, // Una semana
      sameSite: 'lax',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Verificar si el nombre de usuario ya existe
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      // Crear usuario con contraseña hasheada
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Iniciar sesión
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Error en registro:", error);
      res.status(500).json({ message: "Error al registrar usuario" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Intento de login:", req.body);
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Error en autenticación:", err);
        return next(err);
      }
      if (!user) {
        console.log("Usuario no encontrado o contraseña incorrecta");
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }
      
      console.log("Usuario autenticado:", user.username);
      req.login(user, (err) => {
        if (err) {
          console.error("Error en req.login:", err);
          return next(err);
        }
        console.log("Sesión iniciada correctamente", req.isAuthenticated());
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Rutas para gestionar empresas del usuario
  app.get("/api/user/companies", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userCompanies = await storage.getUserCompanies(req.user.id);
      res.json(userCompanies);
    } catch (error) {
      console.error("Error al obtener empresas del usuario:", error);
      res.status(500).json({ message: "Error al obtener empresas del usuario" });
    }
  });

  // Asignar empresa a usuario (para administración)
  app.post("/api/user/companies", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userCompany = await storage.assignUserToCompany({
        user_id: req.user.id,
        company_id: req.body.companyId,
        role: req.body.role || "user",
      });
      res.status(201).json(userCompany);
    } catch (error) {
      console.error("Error al asignar empresa al usuario:", error);
      res.status(500).json({ message: "Error al asignar empresa al usuario" });
    }
  });

  // Eliminar empresa de usuario
  app.delete("/api/user/companies/:companyId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const companyId = parseInt(req.params.companyId);
      const success = await storage.removeUserFromCompany(req.user.id, companyId);
      
      if (!success) {
        return res.status(404).json({ message: "Relación usuario-empresa no encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar empresa del usuario:", error);
      res.status(500).json({ message: "Error al eliminar empresa del usuario" });
    }
  });
}