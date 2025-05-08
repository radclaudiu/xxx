import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import express, { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, User as SelectUser } from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Función para generar hash de contraseña con salt
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Función para comparar contraseñas
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);
  
  // Configuración de la sesión
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "sesionSecretaFalloReemplazame",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
    store: new PostgresSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configuración de Passport para autenticación local
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email", // Utilizamos email en lugar de username
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Buscar usuario por email
          const userResults = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()));
            
          const user = userResults[0];

          if (!user || !(await comparePasswords(password, user.password))) {
            // Credenciales incorrectas
            return done(null, false, { message: "Credenciales incorrectas" });
          }
          
          // Usuario autenticado correctamente
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialización y deserialización del usuario para la sesión
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.id, id));
      
      const user = userResults[0];
      
      if (!user) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Rutas de autenticación
  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, username, fullName } = req.body;
      
      // Verificar si el email ya existe
      const existingUserByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));
      
      if (existingUserByEmail.length > 0) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }
      
      // Verificar si el username ya existe
      const existingUserByUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      
      if (existingUserByUsername.length > 0) {
        return res.status(400).json({ error: "El nombre de usuario ya está en uso" });
      }
      
      // Determinar si es el primer usuario (será admin)
      const allUsers = await db.select().from(users);
      const isFirstUser = allUsers.length === 0;
      
      // Crear el nuevo usuario
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          username,
          password: await hashPassword(password),
          fullName,
          role: isFirstUser ? "admin" : "user",
        })
        .returning();
      
      // Iniciar sesión automáticamente
      req.login(newUser, (err) => {
        if (err) return next(err);
        res.status(201).json({
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
        });
      });
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Credenciales incorrectas" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        res.json({
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Error al cerrar sesión" });
      }
      res.status(200).json({ message: "Sesión cerrada correctamente" });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "No autenticado" });
    }
    
    const user = req.user;
    
    try {
      // Obtener el objeto de usuario completo
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      });
    } catch (error) {
      console.error("Error al obtener datos de usuario:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });
}

// Middleware para verificar autenticación
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "No autenticado" });
}

// Middleware para verificar rol de administrador
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "No autorizado" });
}