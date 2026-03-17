// Vercel Serverless Function — wraps the Express app built by esbuild
// The build step produces artifacts/api-server/dist/vercel.cjs (exports app, no listen)
const app = require("../artifacts/api-server/dist/vercel.cjs");
module.exports = app.default || app;
