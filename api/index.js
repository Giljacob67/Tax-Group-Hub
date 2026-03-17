// Vercel Serverless Function — wraps the Express app built by esbuild
//
// NFT hint strategy: require the hints file from INSIDE artifacts/api-server/
// so Node.js resolves pdf-parse/mammoth/cookie-parser from the correct pnpm
// workspace node_modules (artifacts/api-server/node_modules/), not the root.
require("../artifacts/api-server/nft-hints.js");

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
  const handler = appModule.default || appModule;
  // Wrap in error-catching handler to surface request-level crashes
  module.exports = (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      res.status(500).json({
        error: "Request handler failed",
        message: err.message,
        stack: err.stack,
      });
    }
  };
}
