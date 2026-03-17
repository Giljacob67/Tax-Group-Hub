// Vercel Express framework entrypoint
// Built by esbuild during `pnpm run build` → server/vercel.cjs
const mod = require("./vercel.cjs");
module.exports = mod.default || mod;
