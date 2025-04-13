import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SchemaUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SchemaUser {}
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
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "supersecret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 día
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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
          return done(null, false, { message: "Credenciales incorrectas" });
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: SchemaUser, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Rutas de autenticación
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Nombre de usuario y contraseña son requeridos" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Devolver usuario sin incluir la contraseña
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SchemaUser | false, info: { message?: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Credenciales incorrectas" });
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        // Devolver usuario sin incluir la contraseña
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
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
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    // Devolver usuario sin incluir la contraseña
    const { password, ...userWithoutPassword } = req.user as SchemaUser;
    res.json(userWithoutPassword);
  });

  // Rutas para configuración de base de datos
  app.post("/api/db-config", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const { DATABASE_URL, PGDATABASE, PGHOST, PGPORT, PGPASSWORD, PGUSER } = req.body;
      
      if (!DATABASE_URL) {
        return res.status(400).json({ message: "DATABASE_URL es requerido" });
      }
      
      const result = await storage.updateDatabaseConfig({
        DATABASE_URL,
        PGDATABASE,
        PGHOST,
        PGPORT,
        PGPASSWORD,
        PGUSER
      });
      
      if (result) {
        res.status(200).json({ message: "Configuración actualizada correctamente" });
      } else {
        res.status(500).json({ message: "Error al actualizar la configuración" });
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/db-config", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const config = await storage.getDbConfig();
      
      // No devolver contraseñas
      const safeConfig = {
        ...config,
        DATABASE_URL: config.DATABASE_URL.replace(/:[^:]*@/, ":******@"),
        PGPASSWORD: config.PGPASSWORD ? "******" : undefined
      };
      
      res.status(200).json(safeConfig);
    } catch (error) {
      next(error);
    }
  });

  // Middleware para verificar autenticación
  app.use("/api/companies", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    next();
  });

  // Middleware para verificar acceso a empresa
  app.use("/api/companies/:companyId", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      return res.status(400).json({ message: "ID de empresa inválido" });
    }
    
    try {
      const userCompanies = await storage.getUserCompanies((req.user as SchemaUser).id);
      const hasAccess = userCompanies.some(uc => uc.company_id === companyId);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "No tienes acceso a esta empresa" });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  });
}