import { Router, type IRouter } from "express";
import { db, tenantBrandingTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const router: IRouter = Router();

// Storage config for brand logos
const UPLOADS_DIR = process.env.VERCEL
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // Serverless environments may have read-only FS
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for logos
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens são permitidas (.png, .jpg, .svg, .webp)"));
    }
  },
});

/**
 * GET /api/branding/resolve
 * Resolves branding by domain or sub-domain.
 * Public endpoint (frontend calls this on load).
 */
router.get("/branding/resolve", async (req, res) => {
  try {
    const domain = (req.query.domain as string) || req.hostname;
    
    // 1. Try to find branding for exact domain
    const [branding] = await db
      .select()
      .from(tenantBrandingTable)
      .where(eq(tenantBrandingTable.customDomain, domain))
      .limit(1);

    if (branding) {
      res.json(branding);
      return;
    }

    // 2. Fallback to default branding (empty or first entry)
    res.json({
      companyName: "Tax Group Hub",
      primaryColor: "#3b82f6",
      logoUrl: null, // Frontend will show default logo
    });
  } catch (err) {
    console.error("[Branding] Resolve error:", err);
    res.status(500).json({ error: "Failed to resolve branding" });
  }
});

/**
 * GET /api/branding/config
 * Retrieves current user's branding
 */
router.get("/branding/config", async (req, res) => {
  try {
    const userId = req.userId;
    const [branding] = await db
      .select()
      .from(tenantBrandingTable)
      .where(eq(tenantBrandingTable.userId, userId))
      .limit(1);

    res.json(branding || { message: "Nenhuma configuração encontrada" });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch branding config" });
  }
});

/**
 * POST /api/branding/update
 * Updates name, color and domain
 */
router.post("/branding/update", async (req, res) => {
  try {
    const userId = req.userId;
    const { companyName, primaryColor, customDomain } = req.body;

    const [existing] = await db
      .select()
      .from(tenantBrandingTable)
      .where(eq(tenantBrandingTable.userId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(tenantBrandingTable)
        .set({ companyName, primaryColor, customDomain, updatedAt: new Date() })
        .where(eq(tenantBrandingTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db
        .insert(tenantBrandingTable)
        .values({ userId, companyName, primaryColor, customDomain })
        .returning();
      res.json(inserted);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update branding" });
  }
});

/**
 * POST /api/branding/logo
 * Uploads brand logo
 */
router.post("/branding/logo", upload.single("logo"), async (req, res) => {
  try {
    const userId = req.userId;
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { filename } = req.file;

    const [existing] = await db
      .select()
      .from(tenantBrandingTable)
      .where(eq(tenantBrandingTable.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(tenantBrandingTable)
        .set({ logoStorageKey: filename, updatedAt: new Date() })
        .where(eq(tenantBrandingTable.id, existing.id));
    } else {
      await db
        .insert(tenantBrandingTable)
        .values({ userId, logoStorageKey: filename });
    }

    res.json({ success: true, logoUrl: `/uploads/${filename}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

export default router;
