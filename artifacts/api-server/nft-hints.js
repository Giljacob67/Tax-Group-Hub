// NFT (Node File Tracing) hints for Vercel Serverless Functions.
// This file is placed inside artifacts/api-server/ so that require() calls here
// resolve packages from artifacts/api-server/node_modules/ (pnpm workspace store).
// Vercel's NFT then includes these packages in the function bundle.
"use strict";
try { require("pdf2json"); } catch (_) {}
try { require("mammoth"); } catch (_) {}
try { require("cookie-parser"); } catch (_) {}
