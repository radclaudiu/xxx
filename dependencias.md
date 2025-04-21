# Dependencias del Proyecto

Este archivo contiene un listado detallado de todas las dependencias utilizadas en el proyecto para facilitar su instalación manual o resolución de problemas.

## Dependencias Principales

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@jridgewell/trace-mapping": "^0.3.23",
    "@neondatabase/serverless": "^0.6.1",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-aspect-ratio": "^1.0.3",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-context-menu": "^2.1.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-icons": "^1.3.0",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@sendgrid/mail": "^8.1.0",
    "@tailwindcss/typography": "^0.5.10",
    "@tanstack/react-query": "^5.28.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cmdk": "^0.2.1",
    "connect-pg-simple": "^9.0.1",
    "crypto": "^1.0.1",
    "date-fns": "^3.3.1",
    "drizzle-orm": "^0.29.3",
    "drizzle-zod": "^0.5.1",
    "embla-carousel-react": "^8.0.0",
    "express": "^4.18.2",
    "express-session": "^1.18.0",
    "framer-motion": "^11.0.5",
    "html2pdf.js": "^0.10.1",
    "input-otp": "^1.1.0",
    "lucide-react": "^0.343.0",
    "memorystore": "^1.6.7",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "react": "^18.2.0",
    "react-day-picker": "^8.10.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.1",
    "react-icons": "^5.1.0",
    "react-resizable-panels": "^2.0.9",
    "recharts": "^2.12.1",
    "tailwind-merge": "^2.2.1",
    "tailwindcss": "^3.4.1",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.9.0",
    "wouter": "^3.0.0",
    "ws": "^8.16.0",
    "zod": "^3.22.4",
    "zod-validation-error": "^2.1.0"
  }
}
```

## Dependencias de Desarrollo

```json
{
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^1.1.3",
    "@replit/vite-plugin-runtime-error-modal": "^1.0.1",
    "@replit/vite-plugin-shadcn-theme-json": "^1.6.0",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/node": "^20.11.24",
    "@types/passport": "^1.0.16",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.2.59",
    "@types/react-dom": "^18.2.19",
    "@types/ws": "^8.5.10",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "drizzle-kit": "^0.20.14",
    "esbuild": "^0.19.12",
    "postcss": "^8.4.35",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.4"
  }
}
```

## Scripts Principales

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production node dist/server/index.js",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

## Instalación

Para instalar todas estas dependencias, ejecuta:

```bash
npm install
```

Si necesitas instalar las dependencias de desarrollo también:

```bash
npm install --save-dev $(cat dev_dependencies.txt)
```

## Solución de Problemas con Dependencias

### Conflictos de Versiones

Si encuentras conflictos de versiones, intenta:

```bash
npm cache clean --force
rm -rf node_modules
rm package-lock.json
npm install
```

### Errores de TypeScript

Para problemas específicos con tipos de TypeScript:

```bash
npm install --save-dev typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest
```