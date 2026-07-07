import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDB } from "./src/server/db/db.js";
import apiRouter from "./src/server/routes/api.js";

async function startServer() {
  // Initialize Database (Direct Fetch Mode)
  await initDB();

  const app = express();
  const PORT = 3000;

  // Enable robust CORS supporting cross-domain deployments (e.g., Vercel frontend + Render backend)
  app.use(
    cors({
      origin: true, // Echo back the requesting origin dynamically (permits any origin with credentials)
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    })
  );

  // JSON Body Parser
  app.use(express.json());

  // Live health-check (bypass database lock middleware)
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Mount API Sub-router
  app.use("/api", apiRouter);

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EOT Crane Planning Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server boot failure:", err);
  process.exit(1);
});
