// Vercel Serverless Function — wraps the Express app built by esbuild
// The build step produces artifacts/api-server/dist/vercel.cjs (exports app, no listen)

// NFT (Node File Tracing) hints: explicitly require external packages so Vercel
// includes them in the function bundle (they are externalised by esbuild, not bundled)
try { require("pdf-parse"); } catch (_) {}
try { require("mammoth"); } catch (_) {}
try { require("cookie-parser"); } catch (_) {}

const app = require("../artifacts/api-server/dist/vercel.cjs");
module.exports = app.default || app;
