// Vercel Serverless Function — wraps the Express app built by esbuild
// The build step produces artifacts/api-server/dist/vercel.cjs (exports app, no listen)

// NFT (Node File Tracing) hints: explicitly require external packages so Vercel
// includes them in the function bundle (they are externalised by esbuild, not bundled)
try { require("pdf-parse"); } catch (_) {}
try { require("mammoth"); } catch (_) {}
try { require("cookie-parser"); } catch (_) {}

let appModule;
let initError;

try {
  appModule = require("../artifacts/api-server/dist/vercel.cjs");
} catch (err) {
  initError = err;
}

if (initError) {
  // Return a diagnostic handler so we can see the actual crash in HTTP response
  module.exports = (_req, res) => {
    res.status(500).json({
      error: "Function initialization failed",
      message: initError.message,
      stack: initError.stack,
    });
  };
} else {
  module.exports = appModule.default || appModule;
}
