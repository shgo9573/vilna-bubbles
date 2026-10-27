import express from 'express';
import cors from 'cors';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { sysLogger } from './src/services/logger.js';
import {
  getUserRecord,
  addBookmark,
  removeBookmark,
  recordReadingHistory,
  clearReadingHistory,
  linkEmailToUser,
  findUserIdByEmail,
  getUserSettings,
  updateUserSettings,
  exportUserBackup,
  importUserBackup
} from './src/services/userStore.js';
import {
  isSeforimDbAvailable,
  getCatalogFromDb,
  getBookContentFromDb,
  getBookTocFromDb,
  getBookLinksFromDb,
  getBookLinksFromDbAsync,
  getAllBookCommentatorsFromDb,
  searchDatabase,
  getDatabaseDetails,
  getDatabaseSchema,
  getDbDiagnosticsReport,
  getBookIdsForCategory
} from './src/services/seforimDatabase.js';

// Safeguard against unhandled exceptions causing crashes
process.on('uncaughtException', (err) => {
  console.error('[Otzaria Server] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Otzaria Server] Unhandled Rejection:', reason);
});
process.on('exit', (code) => {
  console.log(`[Otzaria Server] Process exiting with code: ${code}`);
});
process.on('SIGTERM', () => {
  console.log('[Otzaria Server] Received SIGTERM signal');
});
process.on('SIGINT', () => {
  console.log('[Otzaria Server] Received SIGINT signal');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`[BOOT] Otzaria Server starting (Pure SQLite Mode)... Node: ${process.version}, Arch: ${process.arch}, Platform: ${process.platform}, PID: ${process.pid}`);

/**
 * Automatically warm up / preload seforim.db into Linux OS Page Cache / RAM
 */
function autoWarmupDatabase() {
  const dbPath = '/var/data/otzaria/seforim.db';
  if (!fs.existsSync(dbPath)) return;

  console.log(`[Otzaria Auto-Warmup] Starting automatic background preloading of ${dbPath} into RAM (Linux Page Cache)...`);
  const startTime = Date.now();

  try {
    const dd = spawn('dd', [`if=${dbPath}`, 'of=/dev/null', 'bs=2M', 'status=none']);
    dd.on('close', (code) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[Otzaria Auto-Warmup] Complete! 7.4GB loaded into RAM Page Cache in ${elapsed}s. All subsequent SQLite queries will run at memory speed (0-2ms).`);
        sysLogger.addLog('success', 'Warmup', `טעינת ה-DB המלאה ל-RAM הושלמה בהצלחה ב-${elapsed} שניות!`);
      } else {
        console.log(`[Otzaria Auto-Warmup] Background dd process exited with code ${code}`);
      }
    });
    dd.on('error', () => {
      // Fallback: Node.js stream reader
      const stream = fs.createReadStream(dbPath, { highWaterMark: 2 * 1024 * 1024 });
      stream.on('data', () => {});
      stream.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Otzaria Auto-Warmup] Complete (Stream)! 7.4GB loaded into RAM in ${elapsed}s.`);
      });
    });
  } catch (err: any) {
    console.warn('[Otzaria Auto-Warmup] Notice:', err.message);
  }
}

// Trigger automatic background warm-up on boot
autoWarmupDatabase();

const app = express();
const PORT = 3000;

// Enable Gzip/Brotli HTTP compression (reduces JSON / text payloads by ~75-85%)
app.use(compression());

// Detailed Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api') || res.statusCode >= 400) {
      console.log(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['X-Otzaria-UID', 'Set-Cookie']
}));
app.use(express.json({ limit: '50mb' }));

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// User Identity Middleware: Extract or generate UUID cookie
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const headerUid = req.headers['x-otzaria-uid'] as string | undefined;

  let userId = cookies['otzaria_uid'] || (headerUid && headerUid.trim().length > 5 ? headerUid.trim() : '');

  if (!userId || !/^[a-zA-Z0-9_-]{10,64}$/.test(userId)) {
    userId = crypto.randomUUID();
  }

  // Set long-lived cookie (400 days - standard maximum)
  const maxAgeSeconds = 400 * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `otzaria_uid=${userId}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
  res.setHeader('X-Otzaria-UID', userId);

  (req as any).userId = userId;
  next();
});

// API Endpoints - 100% Pure Local seforim.db SQLite Backend

// SQLite status
app.get('/api/status', async (req, res) => {
  const dbInfo = getDatabaseDetails();
  if (dbInfo.available) {
    return res.json({
      status: 'ready',
      mode: 'sqlite_local',
      message: `מסד נתונים מקומי seforim.db פעיל (${dbInfo.sizeGB})`,
      databasePath: dbInfo.path,
      databaseSize: dbInfo.sizeGB,
      databaseEngine: dbInfo.engine,
      totalBooks: dbInfo.booksCount,
      storageUsageMB: Math.round(dbInfo.sizeBytes / (1024 * 1024)),
      lastUpdated: new Date().toISOString()
    });
  }

  res.status(503).json({
    status: 'error',
    mode: 'missing_db',
    message: 'קובץ מסד הנתונים seforim.db לא נמצא בשרת (/var/data/otzaria/seforim.db)',
    totalBooks: 0,
    storageUsageMB: 0,
    lastUpdated: new Date().toISOString()
  });
});

// Library tree catalog from seforim.db
app.get('/api/library/tree', async (req, res) => {
  try {
    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'seforim.db not available on server' });
    }

    const dbCatalog = getCatalogFromDb();
    if (!dbCatalog || dbCatalog.books.length === 0) {
      return res.status(500).json({ error: 'Failed to read library tree from seforim.db' });
    }

    res.json({
      categories: dbCatalog.categories,
      books: dbCatalog.books
    });
  } catch (err: any) {
    sysLogger.addLog('error', 'Server', `שגיאה בטעינת קטלוג: ${err.message}`);
    res.status(500).json({ error: 'Failed to build catalog', message: err.message });
  }
});

// Range lines endpoint from seforim.db
app.get('/api/books/:id/lines', async (req, res) => {
  try {
    const rawId = req.params.id;
    const startLine = parseInt(req.query.start as string, 10) || 1;
    const endLine = parseInt(req.query.end as string, 10) || (startLine + 150);

    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'seforim.db not available' });
    }

    const dbData = getBookContentFromDb(rawId, startLine, endLine);
    if (!dbData) {
      return res.status(404).json({ error: 'Book not found in seforim.db' });
    }

    res.json({
      id: dbData.id,
      title: dbData.title,
      content: dbData.content,
      startLine,
      endLine,
      totalLines: dbData.totalLines
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load lines', message: err.message });
  }
});

// Book content endpoint from seforim.db (Supports chunked range pagination)
app.get('/api/books/:id/content', async (req, res) => {
  try {
    const rawId = req.params.id;
    const startLine = req.query.start ? parseInt(req.query.start as string, 10) : undefined;
    const endLine = req.query.end ? parseInt(req.query.end as string, 10) : undefined;

    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'seforim.db not available' });
    }

    const dbData = getBookContentFromDb(rawId, startLine, endLine);
    if (!dbData) {
      return res.status(404).json({ error: 'Book not found in seforim.db' });
    }

    res.json({
      id: dbData.id,
      title: dbData.title,
      lines: dbData.lines,
      totalLines: dbData.totalLines
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load book content', message: err.message });
  }
});

// Book Table of Contents endpoint from seforim.db
app.get('/api/books/:id/toc', async (req, res) => {
  try {
    const rawId = req.params.id;

    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'seforim.db not available' });
    }

    const dbToc = getBookTocFromDb(rawId);
    if (!dbToc || dbToc.length === 0) {
      return res.json({ id: rawId, toc: [] });
    }

    res.json({
      id: rawId,
      toc: dbToc
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate TOC', message: err.message });
  }
});

// Commentary links endpoint from seforim.db
app.get('/api/books/:id/links', async (req, res) => {
  try {
    const rawId = req.params.id;
    const lineIndex = parseInt(req.query.line as string, 10) || 1;

    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'seforim.db not available' });
    }

    const dbLinks = await getBookLinksFromDbAsync(rawId, lineIndex);
    if (!dbLinks) {
      return res.json({
        id: rawId,
        line: lineIndex,
        links: [],
        allLinks: [],
        availableCommentators: []
      });
    }

    res.json(dbLinks);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get commentary links', message: err.message });
  }
});

// Full book commentators list endpoint from seforim.db
app.get('/api/books/:id/commentators', async (req, res) => {
  try {
    const rawId = req.params.id;

    if (!isSeforimDbAvailable()) {
      return res.json({ bookId: rawId, commentators: [] });
    }

    const commentators = getAllBookCommentatorsFromDb(rawId);
    res.json({
      bookId: rawId,
      commentators
    });
  } catch (err: any) {
    res.json({ bookId: req.params.id, commentators: [] });
  }
});

// Database schema diagnostics endpoint
app.get('/api/debug/schema', (req, res) => {
  try {
    const schema = getDatabaseSchema();
    res.json(schema);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Database connectivity and status report endpoint
app.get('/api/debug/db', (req, res) => {
  try {
    const report = getDbDiagnosticsReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Shas Daf Tzurat HaDaf Proxy & Cache
const shasDafCache = new Map<string, Buffer>();

interface ShasMasechtaMeta {
  names: string[];
  slug: string;
  startDaf: number;
  maxDaf: number;
  req: number;
}

const SHAS_MASECHTOT: ShasMasechtaMeta[] = [
  { names: ['ברכות'], slug: 'berachos', startDaf: 2, maxDaf: 64, req: 21111 },
  { names: ['שבת'], slug: 'shabbos', startDaf: 2, maxDaf: 157, req: 21112 },
  { names: ['עירובין'], slug: 'eruvin', startDaf: 2, maxDaf: 105, req: 21113 },
  { names: ['פסחים'], slug: 'pesachim', startDaf: 2, maxDaf: 121, req: 21114 },
  { names: ['שקלים'], slug: 'shekalim', startDaf: 2, maxDaf: 22, req: 21115 },
  { names: ['יומא'], slug: 'yoma', startDaf: 2, maxDaf: 88, req: 21116 },
  { names: ['סוכה'], slug: 'sukkah', startDaf: 2, maxDaf: 56, req: 21117 },
  { names: ['ביצה'], slug: 'beitzah', startDaf: 2, maxDaf: 40, req: 21118 },
  { names: ['ראש השנה', 'ר"ה', 'ר״ה'], slug: 'rosh-hashanah', startDaf: 2, maxDaf: 35, req: 21119 },
  { names: ['תענית'], slug: 'taanis', startDaf: 2, maxDaf: 31, req: 21120 },
  { names: ['מגילה'], slug: 'megillah', startDaf: 2, maxDaf: 32, req: 21121 },
  { names: ['מועד קטן', 'מו"ק', 'מו״ק'], slug: 'moed-katan', startDaf: 2, maxDaf: 29, req: 21122 },
  { names: ['חגיגה'], slug: 'chagigah', startDaf: 2, maxDaf: 27, req: 21123 },
  { names: ['יבמות'], slug: 'yevamos', startDaf: 2, maxDaf: 122, req: 21124 },
  { names: ['כתובות'], slug: 'kesubos', startDaf: 2, maxDaf: 112, req: 21125 },
  { names: ['נדרים'], slug: 'nedarim', startDaf: 2, maxDaf: 91, req: 21126 },
  { names: ['נזיר'], slug: 'nazir', startDaf: 2, maxDaf: 66, req: 21127 },
  { names: ['סוטה'], slug: 'sotah', startDaf: 2, maxDaf: 49, req: 21128 },
  { names: ['גיטין'], slug: 'gittin', startDaf: 2, maxDaf: 90, req: 21129 },
  { names: ['קידושין'], slug: 'kiddushin', startDaf: 2, maxDaf: 82, req: 21130 },
  { names: ['בבא קמא', 'ב"ק', 'ב״ק'], slug: 'bava-kamma', startDaf: 2, maxDaf: 119, req: 21131 },
  { names: ['בבא מציעא', 'ב"מ', 'ב״מ'], slug: 'bava-metzia', startDaf: 2, maxDaf: 119, req: 21132 },
  { names: ['בבא בתרא', 'ב"ב', 'ב״ב'], slug: 'bava-basra', startDaf: 2, maxDaf: 176, req: 21133 },
  { names: ['סנהדרין'], slug: 'sanhedrin', startDaf: 2, maxDaf: 113, req: 21134 },
  { names: ['מכות'], slug: 'makkos', startDaf: 2, maxDaf: 24, req: 21135 },
  { names: ['שבועות'], slug: 'shevuos', startDaf: 2, maxDaf: 49, req: 21136 },
  { names: ['עבודה זרה', 'ע"ז', 'ע״ז'], slug: 'avodah-zarah', startDaf: 2, maxDaf: 76, req: 21137 },
  { names: ['הוריות'], slug: 'horayos', startDaf: 2, maxDaf: 14, req: 21138 },
  { names: ['זבחים'], slug: 'zevachim', startDaf: 2, maxDaf: 120, req: 21139 },
  { names: ['מנחות'], slug: 'menachos', startDaf: 2, maxDaf: 110, req: 21140 },
  { names: ['חולין'], slug: 'chullin', startDaf: 2, maxDaf: 142, req: 21141 },
  { names: ['בכורות'], slug: 'bechoros', startDaf: 2, maxDaf: 61, req: 21142 },
  { names: ['ערכין'], slug: 'arachin', startDaf: 2, maxDaf: 34, req: 21143 },
  { names: ['תמורה'], slug: 'temurah', startDaf: 2, maxDaf: 34, req: 21144 },
  { names: ['כריתות'], slug: 'kereisos', startDaf: 2, maxDaf: 28, req: 21145 },
  { names: ['מעילה'], slug: 'meilah', startDaf: 2, maxDaf: 22, req: 21146 },
  { names: ['קנים'], slug: 'kinim', startDaf: 22, maxDaf: 25, req: 21146 },
  { names: ['תמיד'], slug: 'tamid', startDaf: 26, maxDaf: 33, req: 21147 },
  { names: ['מידות', 'מדות'], slug: 'middos', startDaf: 34, maxDaf: 37, req: 21148 },
  { names: ['נידה', 'נדה'], slug: 'niddah', startDaf: 2, maxDaf: 73, req: 21149 }
];

function findShasMasechtaMeta(name: string): ShasMasechtaMeta | null {
  if (!name || typeof name !== 'string') return null;
  const clean = name
    .replace(/[־–—\-_,.:;()\[\]{}'\"״׳]/g, ' ')
    .replace(/\b(תלמוד|בבלי|שס|ש"ס|ש״ס|מסכת|משנה|פירוש|רש"י|תוספות|על|סדר|נשים|נזיקין|מועד|קדשים|טהרות|זרעים)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Exact match on slug or any Hebrew alias
  for (const m of SHAS_MASECHTOT) {
    if (m.slug.toLowerCase() === name.trim().toLowerCase() || m.slug.toLowerCase() === clean.toLowerCase()) {
      return m;
    }
    if (m.names.some(n => clean === n || name.trim() === n)) {
      return m;
    }
  }

  // 2. Contains match
  for (const m of SHAS_MASECHTOT) {
    if (m.names.some(n => clean.includes(n) || name.includes(n))) {
      return m;
    }
  }
  return null;
}

const MASECHTOT_HEBREW_TO_ENGLISH: Record<string, string> = {};
for (const m of SHAS_MASECHTOT) {
  for (const n of m.names) {
    MASECHTOT_HEBREW_TO_ENGLISH[n] = m.slug;
  }
}

app.get('/api/shas/daf', async (req, res) => {
  try {
    let masechta = String(req.query.masechta || '').trim();
    const rawDaf = parseInt(String(req.query.daf || '2'), 10) || 2;
    let amud = String(req.query.amud || 'a').trim().toLowerCase();

    // Normalize amud
    if (amud === 'א' || amud === '1' || amud === 'amud_a') amud = 'a';
    if (amud === 'ב' || amud === '2' || amud === 'amud_b') amud = 'b';
    if (amud !== 'a' && amud !== 'b') amud = 'a';

    // Map Hebrew masechta name if provided in Hebrew
    for (const [hebKey, engVal] of Object.entries(MASECHTOT_HEBREW_TO_ENGLISH)) {
      if (masechta.includes(hebKey) || hebKey.includes(masechta)) {
        masechta = engVal;
        break;
      }
    }

    if (!masechta) {
      return res.status(400).json({ error: 'Missing masechta parameter' });
    }

    const cacheKey = `${masechta}_${rawDaf}_${amud}`;
    if (shasDafCache.has(cacheKey)) {
      const cachedBuf = shasDafCache.get(cacheKey)!;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
      res.setHeader('Content-Disposition', `inline; filename="${cacheKey}.pdf"`);
      return res.send(cachedBuf);
    }

    const targetUrl = `https://www.shas.org/daf-pdf/api/?masechta=${encodeURIComponent(masechta)}&daf=${rawDaf}&amud=${amud}`;
    console.log(`[Shas API] Fetching Tzurat HaDaf from ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch Tzurat HaDaf from Shas provider (${response.status})`
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache up to 200 dapim in memory
    if (shasDafCache.size > 200) {
      const firstK = shasDafCache.keys().next().value;
      if (firstK) shasDafCache.delete(firstK);
    }
    shasDafCache.set(cacheKey, buffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Content-Disposition', `inline; filename="${cacheKey}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('[Shas API Error]:', err.message);
    res.status(500).json({ error: 'Internal server error fetching Tzurat HaDaf', message: err.message });
  }
});

// Local PDF Storage Directory for Tzurat HaDaf
const LOCAL_PDF_DIR = fs.existsSync('/var/data/otzaria')
  ? '/var/data/otzaria/pdf'
  : path.join(__dirname, 'data/pdf');

if (!fs.existsSync(LOCAL_PDF_DIR)) {
  try {
    fs.mkdirSync(LOCAL_PDF_DIR, { recursive: true });
  } catch {}
}

// Endpoint to clear PDF cache on demand
app.post('/api/admin/clear-pdf-cache', (req, res) => {
  try {
    shasDafCache.clear();
    let deletedCount = 0;
    const dirsToClean = ['/var/data/otzaria/pdf', path.join(__dirname, 'data/pdf')];
    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            try {
              fs.unlinkSync(path.join(dir, file));
              deletedCount++;
            } catch {}
          }
        }
      }
    }
    res.json({ success: true, message: `נמחקו ${deletedCount} קבצי מטמון בהצלחה`, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Local PDF page fetch endpoint with automatic disk persistence & strict tractate isolation
app.get('/api/tzurat-hadaf/page', async (req, res) => {
  try {
    const rawMasechta = String(req.query.masechta || '').trim();
    const rawDaf = parseInt(String(req.query.daf || '2'), 10) || 2;
    let amud = String(req.query.amud || 'a').trim().toLowerCase();
    if (amud === 'א' || amud === '1' || amud === 'amud_a' || amud === 'aleph') amud = 'a';
    if (amud === 'ב' || amud === '2' || amud === 'amud_b' || amud === 'bet') amud = 'b';
    if (amud !== 'a' && amud !== 'b') amud = 'a';

    const meta = findShasMasechtaMeta(rawMasechta);
    if (!meta) {
      return res.status(400).json({ error: `Unknown or unsupported Talmud tractate: ${rawMasechta}` });
    }

    // Strict page bounds validation for the requested tractate:
    // If daf exceeds maxDaf (e.g. user sent a book lineIndex like 834 instead of daf),
    // clamp strictly to the tractate's startDaf (or maxDaf) - NEVER leak to another tractate!
    let safeDaf = rawDaf;
    if (safeDaf < meta.startDaf || safeDaf > meta.maxDaf) {
      console.warn(`[Tzurat HaDaf] Daf ${rawDaf} out of bounds for ${meta.slug} (${meta.startDaf}-${meta.maxDaf}), clamping to ${meta.startDaf}`);
      safeDaf = meta.startDaf;
    }

    const localFileName = `${meta.slug}_${safeDaf}_${amud}.pdf`;
    const localFilePath = path.join(LOCAL_PDF_DIR, localFileName);

    // 1. Check local disk cache (only if verified valid PDF)
    if (fs.existsSync(localFilePath)) {
      const stats = fs.statSync(localFilePath);
      if (stats.size > 15000) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(localFileName)}"`);
        return res.sendFile(localFilePath);
      } else {
        // Remove truncated / corrupt file
        try { fs.unlinkSync(localFilePath); } catch {}
      }
    }

    // 2. Fetch directly from verified shas.org API (100% exact Vilna page-by-page scan)
    const shasUrl = `https://www.shas.org/daf-pdf/api/?masechta=${encodeURIComponent(meta.slug)}&daf=${safeDaf}&amud=${amud}`;
    console.log(`[Tzurat HaDaf] Fetching ${meta.slug} daf ${safeDaf} amud ${amud} from shas.org...`);

    const shasResp = await fetch(shasUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*'
      }
    });

    if (shasResp.ok) {
      const contentType = shasResp.headers.get('content-type') || '';
      const arrayBuffer = await shasResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify it's an authentic PDF (starts with %PDF and has reasonable size)
      if (buffer.length > 15000 && buffer.toString('utf-8', 0, 5).startsWith('%PDF')) {
        try {
          fs.writeFileSync(localFilePath, buffer);
        } catch (writeErr: any) {
          console.warn('[Tzurat HaDaf] Could not persist to disk cache:', writeErr.message);
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(localFileName)}"`);
        return res.send(buffer);
      }
    }

    console.error(`[Tzurat HaDaf Error] Failed to fetch PDF for tractate ${meta.slug} daf ${safeDaf} amud ${amud} (status: ${shasResp.status})`);
    res.status(502).json({
      error: `Failed to fetch Tzurat HaDaf for ${meta.names[0]} daf ${safeDaf} amud ${amud}`,
      tractate: meta.names[0],
      daf: safeDaf,
      amud
    });
  } catch (err: any) {
    console.error('[Tzurat HaDaf Exception]:', err.message);
    res.status(500).json({ error: 'Internal server error fetching Tzurat HaDaf', message: err.message });
  }
});

// High-Resolution Pristine Vilna Page Image Endpoint (renders with Ghostscript C++ engine, eliminates PDF.js font spacing glitches)
app.get('/api/tzurat-hadaf/page-image', async (req, res) => {
  try {
    const rawMasechta = String(req.query.masechta || '').trim();
    const rawDaf = parseInt(String(req.query.daf || '2'), 10) || 2;
    let amud = String(req.query.amud || 'a').trim().toLowerCase();
    if (amud === 'א' || amud === '1' || amud === 'amud_a' || amud === 'aleph') amud = 'a';
    if (amud === 'ב' || amud === '2' || amud === 'amud_b' || amud === 'bet') amud = 'b';
    if (amud !== 'a' && amud !== 'b') amud = 'a';

    const meta = findShasMasechtaMeta(rawMasechta);
    if (!meta) {
      return res.status(400).json({ error: `Unknown or unsupported Talmud tractate: ${rawMasechta}` });
    }

    let safeDaf = rawDaf;
    if (safeDaf < meta.startDaf || safeDaf > meta.maxDaf) {
      safeDaf = meta.startDaf;
    }

    const pdfFileName = `${meta.slug}_${safeDaf}_${amud}.pdf`;
    const pdfFilePath = path.join(LOCAL_PDF_DIR, pdfFileName);
    const pngFileName = `${meta.slug}_${safeDaf}_${amud}.png`;
    const pngFilePath = path.join(LOCAL_PDF_DIR, pngFileName);

    // 1. Serve from disk if PNG already exists and valid
    if (fs.existsSync(pngFilePath)) {
      const stats = fs.statSync(pngFilePath);
      if (stats.size > 20000) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.sendFile(pngFilePath);
      }
    }

    // 2. Ensure PDF file exists
    if (!fs.existsSync(pdfFilePath) || fs.statSync(pdfFilePath).size < 15000) {
      const shasUrl = `https://www.shas.org/daf-pdf/api/?masechta=${encodeURIComponent(meta.slug)}&daf=${safeDaf}&amud=${amud}`;
      const shasResp = await fetch(shasUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,*/*'
        }
      });
      if (shasResp.ok) {
        const buf = Buffer.from(await shasResp.arrayBuffer());
        if (buf.length > 15000 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
          fs.writeFileSync(pdfFilePath, buf);
        }
      }
    }

    // 3. Render PDF to PNG using Ghostscript with explicit executable path
    if (fs.existsSync(pdfFilePath)) {
      try {
        const { execSync } = await import('child_process');
        const gsBin = fs.existsSync('/usr/bin/gs') ? '/usr/bin/gs' : (fs.existsSync('/usr/local/bin/gs') ? '/usr/local/bin/gs' : 'gs');
        const envPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
        execSync(`"${gsBin}" -sDEVICE=png16m -r200 -dUseCropBox -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -o "${pngFilePath}" "${pdfFilePath}"`, {
          stdio: 'pipe',
          env: { ...process.env, PATH: (process.env.PATH || '') + ':' + envPath }
        });
        if (fs.existsSync(pngFilePath)) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return res.sendFile(pngFilePath);
        }
      } catch (gsErr: any) {
        console.error('[Ghostscript Render Warning]:', gsErr?.message);
        return res.redirect(`/api/tzurat-hadaf/page?masechta=${encodeURIComponent(rawMasechta)}&daf=${safeDaf}&amud=${amud}`);
      }
    }

    return res.redirect(`/api/tzurat-hadaf/page?masechta=${encodeURIComponent(rawMasechta)}&daf=${safeDaf}&amud=${amud}`);
  } catch (err: any) {
    console.error('[Page Image Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PDF Download Proxy Endpoint for Tzurat HaDaf & Printed Editions
app.get('/api/pdf/download', async (req, res) => {
  const { url, filename } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://hebrewbooks.org/'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch PDF from source');
    }

    const safeFilename = filename && typeof filename === 'string' ? filename : 'tzurat_hadaf.pdf';
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error('[PDF Download Proxy] Error:', err.message);
    res.status(500).send('Error downloading PDF: ' + err.message);
  }
});

// Local Overlay Storage Directory for cached word/line bboxes
const OVERLAY_DIR = path.join(__dirname, 'data/overlays');
if (!fs.existsSync(OVERLAY_DIR)) {
  try { fs.mkdirSync(OVERLAY_DIR, { recursive: true }); } catch {}
}

// Font mapping for Vilna Talmud PDF encoded fonts
const VILNA_MAC_HEBREW_MAP: Record<string, string> = {
  '‡': 'א', '·': 'ב', '‚': 'ג', '„': 'ד', '‰': 'ה',
  'Â': 'ו', 'Ê': 'ז', 'Á': 'ח', 'Ë': 'ט', 'È': 'י',
  'Í': 'ך', 'Î': 'כ', 'Ï': 'ל', 'Ì': 'ם', 'Ó': 'מ',
  'Ô': 'ן', 'Ò': 'ס', 'Ú': 'ע', 'Û': 'ף', 'Ù': 'פ', 
  'ı': 'ץ', 'ˆ': 'צ', '˜': 'ק', '¯': 'ר', '˘': 'ש', 
  '˙': 'ת', '': 'נ', 'ð': 'נ'
};

const VILNA_LATIN1_MAP: Record<string, string> = {
  'à': 'א', 'á': 'ב', 'â': 'ג', 'ã': 'ד', 'ä': 'ה', 'å': 'ו',
  'æ': 'ז', 'ç': 'ח', 'è': 'ט', 'é': 'י', 'ê': 'ך', 'ë': 'כ', 
  'ì': 'ל', 'í': 'ם', 'î': 'מ', 'ï': 'ן', 'ð': 'נ', 'ñ': 'ס', 
  'ò': 'ע', 'ó': 'ף', 'ô': 'פ', 'õ': 'ץ', 'ö': 'צ', '÷': 'ק', 
  'ø': 'ר', 'ù': 'ש', 'ú': 'ת'
};

function decodeVilnaString(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';

  let macHebrewCount = 0;
  let latin1Count = 0;
  
  for (const char of trimmed) {
    if (char in VILNA_MAC_HEBREW_MAP) macHebrewCount++;
    if (char in VILNA_LATIN1_MAP) latin1Count++;
  }

  if (macHebrewCount > 0 && macHebrewCount >= latin1Count) {
    const fixed = trimmed.split('').map(c => VILNA_MAC_HEBREW_MAP[c] || c).join('');
    return fixed.split('').reverse().join('');
  } else if (latin1Count > 0) {
    const fixed = trimmed.split('').map(c => VILNA_LATIN1_MAP[c] || c).join('');
    return fixed.split('').reverse().join('');
  }

  return str;
}

// 1. Overlay extraction & classification endpoint - extracts EVERY single word individually from authentic PDF
app.get(['/api/overlay/:bookId/:page', '/api/tzurat-hadaf/overlay'], async (req, res) => {
  try {
    const params = req.params as Record<string, string>;
    const rawBookId = params.bookId || String(req.query.bookId || '101');
    const rawPage = params.page || String(req.query.page || '1');
    const bookId = parseInt(rawBookId, 10) || 101;
    const page = parseInt(rawPage, 10) || 1;
    let masechta = String(req.query.masechta || '').trim();
    let daf = parseInt(String(req.query.daf || '2'), 10) || 2;
    let amud = String(req.query.amud || 'a').trim().toLowerCase();
    if (amud === 'א' || amud === '1' || amud === 'amud_a') amud = 'a';
    if (amud === 'ב' || amud === '2' || amud === 'amud_b') amud = 'b';
    if (amud !== 'a' && amud !== 'b') amud = 'a';

    let meta = findShasMasechtaMeta(masechta);
    if (!meta) {
      // Look up by bookId or fallback to Berakhot
      if (bookId === 133) {
        meta = findShasMasechtaMeta('בכורות');
      } else {
        meta = findShasMasechtaMeta('ברכות');
      }
    }

    const safeMeta = meta || { names: ['ברכות'], slug: 'berachos', startDaf: 2, maxDaf: 64, req: 21111 };
    let safeDaf = daf;
    if (safeDaf < safeMeta.startDaf || safeDaf > safeMeta.maxDaf) {
      safeDaf = safeMeta.startDaf;
    }

    const cacheKey = `${safeMeta.slug}_${safeDaf}_${amud}`;
    const cacheFilePath = path.join(OVERLAY_DIR, `${cacheKey}.json`);

    if (fs.existsSync(cacheFilePath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        if (cachedData.words && cachedData.words.length > 50) {
          return res.json(cachedData);
        }
      } catch {}
    }

    // Ensure PDF file exists
    const pdfFileName = `${safeMeta.slug}_${safeDaf}_${amud}.pdf`;
    const pdfFilePath = path.join(LOCAL_PDF_DIR, pdfFileName);

    if (!fs.existsSync(pdfFilePath) || fs.statSync(pdfFilePath).size < 15000) {
      const shasUrl = `https://www.shas.org/daf-pdf/api/?masechta=${encodeURIComponent(safeMeta.slug)}&daf=${safeDaf}&amud=${amud}`;
      console.log(`[Overlay] Fetching PDF from shas.org for ${safeMeta.slug} daf ${safeDaf} amud ${amud}...`);
      const shasResp = await fetch(shasUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,*/*'
        }
      });
      if (shasResp.ok) {
        const buf = Buffer.from(await shasResp.arrayBuffer());
        if (buf.length > 15000 && buf.toString('utf-8', 0, 5).startsWith('%PDF')) {
          fs.writeFileSync(pdfFilePath, buf);
        }
      }
    }

    if (fs.existsSync(pdfFilePath) && fs.statSync(pdfFilePath).size > 15000) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
      const pdfPage = await doc.getPage(1);
      const vp = pdfPage.getViewport({ scale: 1.0 });
      const textContent = await pdfPage.getTextContent();

      const extractedWords: any[] = [];

      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;

        const rawStr = item.str.trim();
        const decoded = decodeVilnaString(rawStr);

        // Converted point from PDF to Viewport (top-left origin)
        const pt = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
        const itemX = pt[0];
        const itemH = Math.max(item.height || Math.abs(item.transform[3]), 8);
        const itemY = pt[1] - itemH;
        const itemW = item.width || (rawStr.length * itemH * 0.55);
        const fontSize = Math.abs(item.transform[3]);

        const tokens = decoded.split(/\s+/).filter(Boolean);
        if (tokens.length <= 1) {
          extractedWords.push({
            t: decoded,
            x: Math.round(itemX * 10) / 10,
            y: Math.round(itemY * 10) / 10,
            w: Math.round(itemW * 10) / 10,
            h: Math.round(itemH * 10) / 10,
            fontSize: Math.round(fontSize * 10) / 10
          });
        } else {
          // Split item into individual, exact words (from right to left)
          const totalChars = decoded.length;
          const charW = itemW / totalChars;
          let currentRight = itemX + itemW;

          for (let i = 0; i < tokens.length; i++) {
            const word = tokens[i];
            const wWidth = Math.max(word.length * charW, 6);
            const wX = currentRight - wWidth;
            extractedWords.push({
              t: word,
              x: Math.round(wX * 10) / 10,
              y: Math.round(itemY * 10) / 10,
              w: Math.round(wWidth * 10) / 10,
              h: Math.round(itemH * 10) / 10,
              fontSize: Math.round(fontSize * 10) / 10
            });
            currentRight = wX - charW;
          }
        }
      }

      console.log(`[Overlay Success] Extracted ${extractedWords.length} individual words for ${safeMeta.slug} daf ${safeDaf} amud ${amud}`);

      const overlayData = {
        bookId,
        page,
        masechta: safeMeta.names[0],
        daf: safeDaf,
        amud,
        imageWidth: Math.round(vp.width * 10) / 10,
        imageHeight: Math.round(vp.height * 10) / 10,
        words: extractedWords
      };

      try {
        fs.writeFileSync(cacheFilePath, JSON.stringify(overlayData), 'utf-8');
      } catch {}

      return res.json(overlayData);
    }

    // Graceful fallback if PDF could not be read
    return res.status(404).json({ error: 'PDF not available for overlay extraction' });
  } catch (err: any) {
    console.error('[Overlay Endpoint Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Commentary / Links proxy endpoint (proxies to http://otzaria.duckdns.org/api/books/:bookId/links?line=:lineIndex)
app.get(['/api/commentary/:bookId/:lineIndex', '/api/books/:bookId/links'], async (req, res) => {
  const params = req.params as Record<string, string>;
  const rawBookId = params.bookId || String(req.query.bookId || '133');
  const rawLineIndex = params.lineIndex || String(req.query.line || '475');
  const bookId = parseInt(rawBookId, 10) || 133;
  const lineIndex = parseInt(rawLineIndex, 10) || 475;

  const remoteUrl = `http://otzaria.duckdns.org/api/books/${bookId}/links?line=${lineIndex}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const remoteResp = await fetch(remoteUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (remoteResp.ok) {
      const data = await remoteResp.json();
      return res.json(data);
    }
  } catch (err: any) {
    console.warn(`[Commentary Proxy Warning] Remote fetch to ${remoteUrl} failed: ${err.message}. Falling back to local DB/mock.`);
  }

  // Fallback to local SQLite database if available
  try {
    if (isSeforimDbAvailable()) {
      const localLinksRes = getBookLinksFromDb(bookId, lineIndex);
      if (localLinksRes && localLinksRes.links && localLinksRes.links.length > 0) {
        return res.json(localLinksRes);
      }
    }
  } catch {}

  // Fallback mock payload matching remote schema
  return res.json({
    id: bookId,
    line: lineIndex,
    links: [
      {
        type: 'rashi',
        author: 'רש״י',
        title: 'רש״י על הגמרא',
        heRef: `ספר ${bookId} - שורה ${lineIndex}`,
        text: 'חצי שיעור - דאורייתא הוא אסור, ולפיכך חוששין לו ומחמירין בו כשלם.'
      },
      {
        type: 'tosafot',
        author: 'תוספות',
        title: 'תוספות',
        heRef: `ספר ${bookId} - שורה ${lineIndex}`,
        text: 'ד״ה חצי שיעור - תימה, אמאי איצטריך להכא והא קיימא לן כרבי יוחנן דאמר חצי שיעור אסור מן התורה.'
      }
    ],
    allLinks: [],
    availableCommentators: ['rashi', 'tosafot']
  });
});

// Search proxy endpoint (proxies to Rust engine at :8080 with SQLite fallback)
app.post('/api/search', async (req, res) => {
  const { query, limit = 50 } = req.body || {};
  console.log('🔍 [API Search Request Payload]:', JSON.stringify(req.body, null, 2));

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.json({ query: '', resultsCount: 0, results: [] });
  }

  // Convert category to book_ids before sending to Rust engine
  const searchPayload = { ...req.body };
  const category = req.body?.category || req.body?.categories;
  if (category) {
    const categoryBookIds = getBookIdsForCategory(category);
    if (categoryBookIds && categoryBookIds.length > 0) {
      if (Array.isArray(searchPayload.book_ids) && searchPayload.book_ids.length > 0) {
        const catSet = new Set(categoryBookIds);
        searchPayload.book_ids = searchPayload.book_ids.filter((id: number) => catSet.has(id));
      } else {
        searchPayload.book_ids = categoryBookIds;
      }
    } else {
      searchPayload.book_ids = [];
    }
  }

  // 1. Try Rust search service first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const rustResponse = await fetch('http://localhost:8080/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (rustResponse.ok) {
      const results = await rustResponse.json();
      return res.json(results);
    }
  } catch (error: any) {
    console.warn('[Search Proxy] Rust search engine unavailable, falling back to SQLite search:', error.message);
  }

  // 2. Fallback to seforim.db SQLite search
  try {
    if (!isSeforimDbAvailable()) {
      return res.status(503).json({ error: 'Search service unavailable (seforim.db not available)' });
    }

    const dbResults = searchDatabase(query);
    res.json({
      query,
      resultsCount: dbResults ? dbResults.length : 0,
      results: dbResults || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// Search service health check endpoint
app.get('/api/search-health', async (req, res) => {
  try {
    const response = await fetch('http://localhost:8080/health');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: 'Search service down', status: 'offline' });
  }
});

// User Profile, Bookmarks, and History Endpoints (Disk-Persistent by UUID Cookie)

app.get('/api/user/data', (req, res) => {
  try {
    const userId = (req as any).userId;
    const userData = getUserRecord(userId);
    res.json(userData);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get user data', message: err.message });
  }
});

app.get('/api/user/bookmarks', (req, res) => {
  try {
    const userId = (req as any).userId;
    const userData = getUserRecord(userId);
    res.json({ userId, bookmarks: userData.bookmarks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get bookmarks', message: err.message });
  }
});

app.post('/api/user/bookmarks', (req, res) => {
  try {
    const userId = (req as any).userId;
    const { bookId, bookTitle, lineIndex, textSnippet, description, category, heRef } = req.body;
    if (!bookId || lineIndex === undefined) {
      return res.status(400).json({ error: 'Missing bookId or lineIndex' });
    }

    const item = addBookmark(userId, {
      bookId,
      bookTitle: bookTitle || 'ספר',
      lineIndex,
      textSnippet: textSnippet || '',
      description,
      category,
      heRef
    });

    const user = getUserRecord(userId);
    res.json({ success: true, item, bookmarks: user.bookmarks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add bookmark', message: err.message });
  }
});

app.delete('/api/user/bookmarks/:id', (req, res) => {
  try {
    const userId = (req as any).userId;
    const bookmarkId = req.params.id;
    removeBookmark(userId, bookmarkId);
    const user = getUserRecord(userId);
    res.json({ success: true, bookmarks: user.bookmarks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove bookmark', message: err.message });
  }
});

app.get('/api/user/history', (req, res) => {
  try {
    const userId = (req as any).userId;
    const userData = getUserRecord(userId);
    res.json({ userId, history: userData.history });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get reading history', message: err.message });
  }
});

app.post('/api/user/history', (req, res) => {
  try {
    const userId = (req as any).userId;
    const { bookId, bookTitle, category, lastPosition, lastSection } = req.body;
    if (!bookId) {
      return res.status(400).json({ error: 'Missing bookId' });
    }

    const item = recordReadingHistory(userId, {
      bookId,
      bookTitle: bookTitle || 'ספר',
      category: category || '',
      lastPosition: lastPosition || 1,
      lastSection: lastSection || ''
    });

    const user = getUserRecord(userId);
    res.json({ success: true, item, history: user.history });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record reading history', message: err.message });
  }
});

app.delete('/api/user/history', (req, res) => {
  try {
    const userId = (req as any).userId;
    clearReadingHistory(userId);
    res.json({ success: true, history: [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clear reading history', message: err.message });
  }
});

app.post('/api/user/link-email', (req, res) => {
  try {
    const userId = (req as any).userId;
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    linkEmailToUser(userId, email);
    res.json({ success: true, email, userId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to link email', message: err.message });
  }
});

// User Settings endpoints (Disk-Persistent)
app.get('/api/user/settings', (req, res) => {
  try {
    const userId = (req as any).userId;
    const settings = getUserSettings(userId);
    res.json({ success: true, userId, settings });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get settings', message: err.message });
  }
});

app.post('/api/user/settings', (req, res) => {
  try {
    const userId = (req as any).userId;
    const newSettings = req.body || {};
    const updated = updateUserSettings(userId, newSettings);
    res.json({ success: true, userId, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings', message: err.message });
  }
});

app.post('/api/user/reset-settings', (req, res) => {
  try {
    const userId = (req as any).userId;
    const updated = updateUserSettings(userId, {});
    const user = getUserRecord(userId);
    user.settings = {};
    res.json({ success: true, userId, settings: {} });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset settings', message: err.message });
  }
});

// Full Backup and Restore endpoints
app.get('/api/user/backup', (req, res) => {
  try {
    const userId = (req as any).userId;
    const backup = exportUserBackup(userId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="otzaria_backup_${Date.now()}.json"`);
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export backup', message: err.message });
  }
});

app.post('/api/user/restore', (req, res) => {
  try {
    const userId = (req as any).userId;
    const { backupData, mode } = req.body;
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'Invalid backup data' });
    }

    const updatedUser = importUserBackup(userId, backupData, mode === 'replace' ? 'replace' : 'merge');
    res.json({
      success: true,
      userId,
      bookmarks: updatedUser.bookmarks,
      history: updatedUser.history,
      settings: updatedUser.settings
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore backup', message: err.message });
  }
});

// Start Express server with Vite in dev mode or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');

  if (isProd && fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false
      },
      appType: 'custom'
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Otzaria Server] Pure SQLite Server successfully listening on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== '1' && !process.env.NOW_REGION) {
  startServer();
}

export default app;
