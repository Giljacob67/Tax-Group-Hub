// Vercel Express entrypoint — serves API routes + Vite SPA static files
import path from "path";
import express from "express";
import app from "./app";

// Serve the Vite-built SPA from the sibling dist/ directory.
// At runtime __dirname = /var/task/server, so dist/ is /var/task/server/dist.
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

// SPA fallback — any unmatched route returns index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
