# Tax Group Hub — Production Deployment Guide

This guide covers deploying the Tax Group Hub to Vercel with proper auth enforcement.

## Architecture

```
Browser (React SPA)
  ↓
Vercel Frontend (artifacts/tax-group-hub/dist)
  ↓ /api/*
Vercel Serverless Function (artifacts/api-server → api/index.js)
  ↓
Neon PostgreSQL
```

## 1. Required Vercel Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables** for the API server project.

### Critical (app won't work without these)

| Variable | Description | How to generate |
|----------|-------------|-----------------|
| `JWT_SECRET` | JWT token signing key | `openssl rand -hex 32` |
| `API_KEY` | Service-to-service auth key | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | AES-256-GCM key for BYOK encryption | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Vercel Cron job authentication | `openssl rand -hex 32` |
| `WEBHOOK_SECRET` | Incoming webhook validation | `openssl rand -hex 32` |

### Required for full functionality

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string (use pooled) |
| `DATABASE_URL_UNPOOLED` | Neon unpooled connection (for migrations) |
| `APP_URL` | Frontend URL for CORS (e.g., `https://tax-group-hub.vercel.app`) |
| `GEMINI_API_KEY` | Google Gemini API key for embeddings and chat |

### Optional

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `OPENAI_API_KEY` | OpenAI (Whisper, GPT) |
| `PERPLEXITY_API_KEY` | Perplexity Sonar web search |
| `RESEND_API_KEY` | Transactional email |
| `EMPRESAQUI_API_KEY` | CNPJ enrichment |
| `OLLAMA_CLOUD_API_KEY` | Ollama Cloud |
| `OLLAMA_CLOUD_MODEL` | Ollama Cloud model |
| `OPENROUTER_API_KEY` | OpenRouter multi-model |
| `OPENROUTER_MODEL` | OpenRouter model |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for large uploads |
| `SERVICE_USER_ID` | Override service identity (default: `service`) |

## 2. How to Generate Secrets

```bash
# JWT_SECRET (for user authentication tokens)
openssl rand -hex 32

# API_KEY (for service-to-service auth)
openssl rand -hex 32

# CRON_SECRET (Vercel sends this to protect cron endpoints)
openssl rand -hex 32

# WEBHOOK_SECRET (for incoming webhooks from Telegram, Make.com, etc.)
openssl rand -hex 32

# ENCRYPTION_KEY (for encrypting stored API keys in the database)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Disabling Auth Bypass

### Frontend (`VITE_BYPASS_AUTH`)

The variable `VITE_BYPASS_AUTH=true` appears in `.env.production.local` but is **not referenced** in any frontend code. It is a dead variable.

**Action:** Remove `VITE_BYPASS_AUTH` from `.env.production.local` entirely. It has no effect on security but creates a false sense of bypass.

### Backend (`DEV_BYPASS_AUTH` / dev fallback)

The auth middleware (`src/middlewares/auth.ts:189`) has a dev fallback:

```ts
if (!systemApiKey && !jwtSecret && process.env.NODE_ENV !== "production") {
  req.userId = "dev-user";
  req.authMethod = "dev-fallback";
  next();
  return;
}
```

This fallback is **correctly gated** by `NODE_ENV !== "production"`. In Vercel production, `NODE_ENV` is automatically set to `"production"`, so this fallback never triggers — **provided** you have set `JWT_SECRET` or `API_KEY`.

**If both `JWT_SECRET` and `API_KEY` are missing in production:** The middleware falls through to the 401 response at line 196-199. This means protected routes return "Unauthorized" — not insecure access.

### Summary

| Scenario | Result |
|----------|--------|
| `NODE_ENV=production` + no `JWT_SECRET`/`API_KEY` | 401 on all protected routes (secure but broken) |
| `NODE_ENV=production` + `API_KEY` set | Auth enforced via API key (secure) |
| `NODE_ENV=production` + `JWT_SECRET` set | Auth enforced via JWT (secure) |
| `NODE_ENV=development` + no secrets | Dev fallback to `dev-user` (insecure, dev only) |

## 4. Database Migration Steps

### Initial setup (first deploy)

```bash
# 1. Ensure DATABASE_URL is set in your local .env
# 2. Run migrations
pnpm db:migrate

# Or directly:
pnpm --filter @workspace/db run migrate
```

### Subsequent deploys

Drizzle migrations are applied automatically via the migrate script. For Vercel, add a `postinstall` or `build` step:

```json
// package.json (api-server)
{
  "scripts": {
    "postinstall": "pnpm --filter @workspace/db run migrate"
  }
}
```

Or run manually after deploy:

```bash
# Using Vercel CLI with production env
vercel env pull .env.production.local
pnpm db:migrate
```

### Verify migration status

```bash
# Check Drizzle migration table
psql "$DATABASE_URL" -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

## 5. Post-Deploy Verification Steps

### 5.1 — Verify auth is enforced

```bash
# Should return 401 Unauthorized
curl -s https://tax-group-hub-api-server.vercel.app/api/crm/companies | head -c 200
# Expected: {"error":"Unauthorized","message":"Acesso negado. Credenciais inválidas ou não fornecidas (JWT ou API Key necessária)."}

# Should return 200 (public endpoint)
curl -s -o /dev/null -w "%{http_code}" https://tax-group-hub-api-server.vercel.app/api/healthz
# Expected: 200
```

### 5.2 — Verify API key auth works

```bash
# Replace YOUR_API_KEY with the actual value set in Vercel
curl -s -H "x-api-key: YOUR_API_KEY" https://tax-group-hub-api-server.vercel.app/api/crm/companies | head -c 200
# Expected: 200 with JSON data
```

### 5.3 — Verify JWT auth works

```bash
# Generate a test JWT (replace JWT_SECRET with your actual secret)
TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: 'test-user@example.com' }, 'YOUR_JWT_SECRET', { expiresIn: '1h' });
  console.log(token);
")

curl -s -H "Authorization: Bearer $TOKEN" https://tax-group-hub-api-server.vercel.app/api/crm/companies | head -c 200
# Expected: 200 with JSON data
```

### 5.4 — Verify cron endpoints work

```bash
# Should return 200 (Vercel cron sends CRON_SECRET automatically)
curl -s -H "x-cron-secret: YOUR_CRON_SECRET" https://tax-group-hub-api-server.vercel.app/api/automate/process-sequences | head -c 200
# Expected: 200
```

### 5.5 — Verify CORS

```bash
# Should be allowed
curl -s -H "Origin: https://tax-group-hub.vercel.app" -I https://tax-group-hub-api-server.vercel.app/api/healthz 2>&1 | grep -i access-control
# Expected: Access-Control-Allow-Origin: https://tax-group-hub.vercel.app
```

### 5.6 — Verify env validation on startup

Check Vercel function logs for warnings:

```
[WARN] Neither JWT_SECRET nor API_KEY is set — all requests will fall through to demo-user mode
[WARN] ENCRYPTION_KEY not set — BYOK API keys will be stored unencrypted
[WARN] APP_URL not set in production — CORS may reject frontend requests
```

**None of these warnings should appear in production.**

## 6. Environment Variables NOT to Set in Production

| Variable | Why |
|----------|-----|
| `VITE_BYPASS_AUTH` | Unused dead variable; creates confusion |
| `DEV_BYPASS_AUTH` | Only works when `NODE_ENV !== "production"`; set it only in `.env` for local dev |
| `NODE_ENV` | Vercel sets this automatically to `"production"`; do not override |

## 7. Troubleshooting

### "Acesso negado" on all API requests

- **Cause:** Neither `JWT_SECRET` nor `API_KEY` is set in Vercel
- **Fix:** Set at least one in Vercel Dashboard → Settings → Environment Variables

### CORS errors from frontend

- **Cause:** `APP_URL` doesn't match the frontend domain, or `CORS_ORIGINS` is wrong
- **Fix:** Set `APP_URL` to your Vercel frontend URL (e.g., `https://tax-group-hub.vercel.app`)

### BYOK encryption not working

- **Cause:** `ENCRYPTION_KEY` not set
- **Fix:** Generate and set `ENCRYPTION_KEY` in Vercel

### Cron jobs failing silently

- **Cause:** `CRON_SECRET` not set, or Vercel can't reach the endpoint
- **Fix:** Set `CRON_SECRET` and verify cron paths in `vercel.json` match the API routes
