import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.API_PORT || 5050);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, "uploads");
const templatesDir = path.join(uploadsRoot, "templates");
const brandDir = path.join(uploadsRoot, "brands");
const dataDir = path.join(__dirname, "data");
const templateMetaPath = path.join(dataDir, "templates.json");

const ensureStorage = async () => {
  await fs.mkdir(templatesDir, { recursive: true });
  await fs.mkdir(brandDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(templateMetaPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(templateMetaPath, "[]", "utf8");
      return;
    }
    throw error;
  }
};

const readTemplates = async () => {
  try {
    const raw = await fs.readFile(templateMetaPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const writeTemplates = async (templates) => {
  await fs.writeFile(templateMetaPath, JSON.stringify(templates, null, 2), "utf8");
};

const parseDataUrl = (dataUrl) => {
  const match = /^data:(.+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
};

const extensionForMime = (mime) => {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
};

const authPool = mysql.createPool({
  host: process.env.AUTH_DB_HOST || process.env.DB_HOST,
  user: process.env.AUTH_DB_USER || process.env.DB_USER,
  password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.AUTH_DB_NAME || process.env.DB_NAME,
  charset: "utf8mb4_general_ci",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

const siteConfigCache = new Map();
const sitePoolCache = new Map();

app.use("/uploads", express.static(uploadsRoot));

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPercent = (value, type, basePrice) => {
  if (!value) return 0;
  const numeric = toNumber(value);
  if (!numeric) return 0;
  if (type === "percentage") return numeric;
  if (basePrice <= 0) return 0;
  return Math.round((numeric / basePrice) * 100 * 100) / 100;
};

const requireJwtSecret = (res) => {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: "JWT_SECRET belum diset di server" });
    return false;
  }
  return true;
};

const getSiteConfig = async (siteCode) => {
  const key = String(siteCode || "").trim();
  if (!key) return null;
  if (siteConfigCache.has(key)) return siteConfigCache.get(key);

  const [rows] = await authPool.query(
    "SELECT site_code, site_user, db_host, db_name, db_user, db_password, db_port FROM user_sites WHERE site_code = ? LIMIT 1",
    [key]
  );
  const site = rows?.[0];
  if (!site) return null;

  siteConfigCache.set(key, site);
  return site;
};

const getSitePool = (siteConfig) => {
  const key = `${siteConfig.db_host}-${siteConfig.db_name}-${siteConfig.db_user}-${siteConfig.db_port || ""}`;
  if (sitePoolCache.has(key)) return sitePoolCache.get(key);

  const pool = mysql.createPool({
    host: siteConfig.db_host,
    user: siteConfig.db_user,
    password: siteConfig.db_password,
    database: siteConfig.db_name,
    port: siteConfig.db_port ? Number(siteConfig.db_port) : undefined,
    charset: "utf8mb4_general_ci",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  sitePoolCache.set(key, pool);
  return pool;
};

const requireAuth = (req, res, next) => {
  if (!requireJwtSecret(res)) return;

  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Token tidak ditemukan" });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token tidak valid" });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.auth?.user_id;
    if (!userId) {
      res.status(401).json({ error: "Token tidak valid" });
      return;
    }

    const [rows] = await authPool.query(
      "SELECT username, status FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = rows?.[0];
    if (!user || !user.status || user.username !== "admin") {
      res.status(403).json({ error: "Akses ditolak" });
      return;
    }

    next();
  } catch (error) {
    console.error("Failed to verify admin:", error);
    res.status(500).json({ error: "Gagal memverifikasi admin" });
  }
};

const buildProductResponse = (row) => {
  const basePrice = toNumber(row.base_price);
  const finalPrice = toNumber(row.final_price);
  const baseDiscount = toNumber(row.disc1 ?? row.disc_1);
  const extraDiscount = toNumber(row.disc2 ?? row.disc_2) + toNumber(row.disc3 ?? row.disc_3);
  const memberDiscount = toNumber(row.disc4 ?? row.disc_4);
  const sku = row.code ?? row.pd_code;
  const name = row.name ?? row.pd_short_desc;
  const description =
    row.pd_long_desc ||
    row.description ||
    (row.size && row.uom ? `${row.size} ${row.uom}` : undefined);
  const brandSegment = row.brand ?? row.segment2;
  const descSegment = row.desc ?? row.segment4;

  let totalDiscount = baseDiscount + extraDiscount + memberDiscount;
  if (totalDiscount <= 0 && basePrice > 0 && finalPrice > 0 && finalPrice < basePrice) {
    totalDiscount = Math.round(((basePrice - finalPrice) / basePrice) * 100 * 100) / 100;
  }

  return {
    sku,
    name,
    description,
    barcode: row.barcode ?? row.barcode1,
    normalPrice: basePrice,
    promoPrice: finalPrice || basePrice,
    discount: Math.round(totalDiscount * 100) / 100,
    extraDiscount: Math.round(extraDiscount * 100) / 100 || undefined,
    memberDiscount: Math.round(memberDiscount * 100) / 100 || undefined,
    discountType: "percent",
    brandSegment: brandSegment || undefined,
    descSegment: descSegment || undefined,
    size: row.size ?? undefined,
    uom: row.uom ?? undefined,
    basePricePerMeter: row.base_price_per_meter ?? undefined,
    finalPricePerMeter: row.final_price_per_meter ?? undefined,
    consignment: row.co ?? undefined,
  };
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/templates", async (_req, res) => {
  try {
    const templates = await readTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Failed to read templates:", error);
    res.status(500).json({ error: "Gagal memuat template" });
  }
});

app.get("/api/templates/:id", async (req, res) => {
  try {
    const templates = await readTemplates();
    const template = templates.find((item) => item.id === req.params.id);
    if (!template) {
      res.status(404).json({ error: "Template tidak ditemukan" });
      return;
    }
    res.json(template);
  } catch (error) {
    console.error("Failed to read template:", error);
    res.status(500).json({ error: "Gagal memuat template" });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.user_id;
    if (!userId) {
      res.status(401).json({ error: "Token tidak valid" });
      return;
    }

    const [rows] = await authPool.query(
      "SELECT id, username, site_code, site_user, status FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = rows?.[0];
    if (!user || !user.status) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        site_code: user.site_code,
        site_user: user.site_user,
      },
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    res.status(500).json({ error: "Gagal memuat profil" });
  }
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi nanti." },
});

app.post("/api/login", loginLimiter, async (req, res) => {
  if (!requireJwtSecret(res)) return;

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();

  if (!username || !password) {
    res.status(400).json({ error: "Username dan password wajib diisi" });
    return;
  }

  try {
    const [rows] = await authPool.query(
      "SELECT id, username, password_hash, site_code, site_user, status FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    const user = rows?.[0];
    if (!user || !user.status || !user.password_hash) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }

    const site = await getSiteConfig(user.site_code);
    if (!site) {
      res.status(500).json({ error: "Mapping site tidak ditemukan" });
      return;
    }

    const token = jwt.sign(
      { user_id: user.id, site_code: user.site_code, site_user: user.site_user },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        site_code: user.site_code,
        site_user: user.site_user,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Gagal login" });
  }
});

app.post("/api/templates", requireAuth, requireAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const descriptionRaw = String(req.body?.description || "").trim();
  const imageData = req.body?.imageData;

  if (!name || !imageData) {
    res.status(400).json({ error: "Nama dan gambar wajib diisi" });
    return;
  }

  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    res.status(400).json({ error: "Format gambar tidak valid" });
    return;
  }

  const id = `tpl-${crypto.randomUUID()}`;
  const ext = extensionForMime(parsed.mime);
  const filename = `${id}.${ext}`;
  const description = descriptionRaw || "Custom template";

  try {
    await fs.writeFile(path.join(templatesDir, filename), parsed.buffer);
    const template = {
      id,
      name,
      description,
      imageUrl: `/uploads/templates/${filename}`,
      uploadedAt: Date.now(),
      type: "custom",
    };
    const templates = await readTemplates();
    templates.unshift(template);
    await writeTemplates(templates);
    res.json(template);
  } catch (error) {
    console.error("Failed to save template:", error);
    res.status(500).json({ error: "Gagal menyimpan template" });
  }
});

app.delete("/api/templates/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const templates = await readTemplates();
    const index = templates.findIndex((item) => item.id === id);
    if (index === -1) {
      res.status(404).json({ error: "Template tidak ditemukan" });
      return;
    }

    const [removed] = templates.splice(index, 1);
    if (removed?.imageUrl) {
      const filePath = path.join(__dirname, removed.imageUrl.replace("/uploads/", "uploads/"));
      await fs.unlink(filePath).catch(() => null);
    }
    await writeTemplates(templates);
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    res.status(500).json({ error: "Gagal menghapus template" });
  }
});

app.post("/api/brand-logos", requireAuth, requireAdmin, async (req, res) => {
  const imageData = req.body?.imageData;
  if (!imageData) {
    res.status(400).json({ error: "Logo wajib diunggah" });
    return;
  }

  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    res.status(400).json({ error: "Format gambar tidak valid" });
    return;
  }

  const id = `brand-${crypto.randomUUID()}`;
  const ext = extensionForMime(parsed.mime);
  const filename = `${id}.${ext}`;

  try {
    await fs.writeFile(path.join(brandDir, filename), parsed.buffer);
    res.json({ url: `/uploads/brands/${filename}` });
  } catch (error) {
    console.error("Failed to save brand logo:", error);
    res.status(500).json({ error: "Gagal menyimpan logo" });
  }
});

app.get("/api/products/:sku", requireAuth, async (req, res) => {
  const sku = String(req.params.sku || "").trim();
  if (!sku) {
    res.status(400).json({ error: "SKU wajib diisi" });
    return;
  }

  const site = await getSiteConfig(req.auth?.site_code);
  if (!site) {
    res.status(500).json({ error: "Mapping site tidak ditemukan" });
    return;
  }
  const sitePool = getSitePool(site);

  const sql = `
    SELECT
                    p.pd_code AS code,
                    p.pd_short_desc AS name,
                    ROUND(p.base_price) AS base_price,
                    ROUND(p.final_price) AS final_price,
                    p.disc_1 AS disc1,
                    p.disc_2 AS disc2,
                    p.disc_3 AS disc3,
                    p.disc_4 AS disc4,
                    round(ifnull(p.base_price,0) / p.size) as base_price_per_meter,
                    round(ifnull(p.final_price,0) / p.size) as final_price_per_meter,
                    p.pd_uom as uom,
                    p.size as size,
                    CASE
                        WHEN p.pd_short_desc LIKE '%SPECTRUM TBA%' THEN 'sci'
                        WHEN pd.segment1 = 'CAT' AND pd.segment2 = 'SPECTRUM' THEN 'SPECTRUM_CAT'
                        ELSE pd.segment2
                    END AS brand,
                    pd.segment4,
                    pd.consignment as co
                    FROM rpt_price_tag_v2 p inner join product pd on p.pd_code = pd.pd_code
                    WHERE TRIM(p.pd_code) = TRIM(?)
    ORDER BY p.effdate DESC
    LIMIT 1;
  `;

  try {
    const [rows] = await sitePool.query(sql, [sku]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Produk tidak ditemukan" });
      return;
    }
    res.json(buildProductResponse(rows[0]));
  } catch (error) {
    console.error("DB error:", error);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
});

app.get("/api/products", requireAuth, async (req, res) => {
  const search = String(req.query.search || "").trim();
  if (!search) {
    res.status(400).json({ error: "Parameter search wajib diisi" });
    return;
  }

  const site = await getSiteConfig(req.auth?.site_code);
  if (!site) {
    res.status(500).json({ error: "Mapping site tidak ditemukan" });
    return;
  }
  const sitePool = getSitePool(site);

  const sql = `
    SELECT
      pr.pd_code as pd_code,
      pr.pd_short_desc
    FROM product pr
    WHERE (pr.pd_code LIKE ? OR pr.pd_short_desc LIKE ?)
    ORDER BY (pr.pd_code = ?) DESC, pr.pd_code ASC
    LIMIT 20;
  `;

  try {
    const likeCode = `${search}%`;
    const likeName = `%${search}%`;
    const [rows] = await sitePool.query(sql, [likeCode, likeName, search]);
    res.json(rows);
  } catch (error) {
    console.error("DB error:", error);
    res.status(500).json({ error: "Gagal mencari produk" });
  }
});

const startServer = async () => {
  await ensureStorage();
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
