import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";

// SSL certificate has been updated - normal TLS validation restored

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions  
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Express error handler:", err);
    
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    // Don't throw the error again to prevent unhandled rejections
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;

  // Optimize SSL certificate loading - use HTTP for faster startup in development
  // SSL can be handled by reverse proxy in production
  let serverInstance;
  
  // Disable SSL for faster startup - deployment environments handle SSL via reverse proxy
  const useSSL = false;
  
  if (useSSL) {
    const certPath = path.join(process.cwd(), 'attached_assets', 'domain.cert_1756860116174.pem');
    const keyPath = path.join(process.cwd(), 'attached_assets', 'private.key_1756860116174.pem');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      try {
        const httpsOptions = {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8')
        };
        serverInstance = https.createServer(httpsOptions, app);
        log("HTTPS server configured with SSL certificates");
      } catch (error) {
        log(`SSL certificate error: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to HTTP`);
        serverInstance = http.createServer(app);
      }
    } else {
      log("SSL certificates not found, using HTTP server");
      serverInstance = http.createServer(app);
    }
  } else {
    // Use HTTP for faster startup - SSL handled by reverse proxy if needed
    serverInstance = http.createServer(app);
    log("HTTP server configured for optimized startup");
  }

  serverInstance.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();