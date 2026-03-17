// Vercel Serverless Function — wraps the Express app built by esbuild
// pdf-parse, mammoth, cookie-parser are bundled directly into vercel.cjs by esbuild

let appModule;
let initError;

try {
  appModule = require("../artifacts/api-server/dist/vercel.cjs");
} catch (err) {
  initError = err;
}

if (initError) {
  // Diagnostic handler: surfaces the actual crash message instead of opaque 500
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
