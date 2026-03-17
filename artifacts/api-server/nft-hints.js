// NFT (Node File Tracing) hints for Vercel Serverless Functions.
// This file is placed inside artifacts/api-server/ so that require() calls here
// resolve packages from artifacts/api-server/node_modules/ (pnpm workspace store),
// where pdf-parse, mammoth, and cookie-parser are symlinked.
// Vercel's NFT then includes these packages in the function bundle.
"use strict";
try { require("pdf-parse"); } catch (_) {}
try { require("mammoth"); } catch (_) {}
try { require("cookie-parser"); } catch (_) {}
