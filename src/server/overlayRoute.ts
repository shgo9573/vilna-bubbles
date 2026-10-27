// src/server/overlayRoute.ts
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { decodeAll, setLearnedMap, getLearnedMap } from './decoder.js';
import { learnFontMap } from './learn.js';

const router = express.Router();
const ORACLE = 'https://otzaria.duckdns.org';
const CACHE_DIR = path.join(process.cwd(), 'data', 'overlays');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// זיכרון: האם כבר למדנו מפה לספר הזה? (בזיכרון בלבד כרגע לשם יציבות)
const learnedBooks = new Set<number>();

// Endpoint: מקבל masechta + daf + amud + bookId
router.get('/api/overlay/:bookId/:masechta/:daf/:amud', async (req, res) => {
  const bookId = Number(req.params.bookId);
  const { masechta, daf, amud } = req.params;
  const cacheName = `${masechta}_${daf}_${amud}`.replace(/[^\w\u0590-\u05FF]/g, '_');
  const cacheFile = path.join(CACHE_DIR, `${cacheName}.json`);

  // 1. Cache hit - רק אם המיפוי לספר הזה כבר נלמד בזיכרון
  if (fs.existsSync(cacheFile) && learnedBooks.has(bookId)) {
    console.log(`✅ Cache hit: ${cacheName}`);
    return res.json(JSON.parse(fs.readFileSync(cacheFile, 'utf-8')));
  }

  try {
    // 2. ⭐ הורד PDF מה-Oracle (ה-Source of Truth)
    const pdfUrl = `${ORACLE}/api/tzurat-hadaf/page?masechta=${encodeURIComponent(masechta)}&daf=${daf}&amud=${amud}`;
    console.log(`📥 Downloading PDF from Oracle: ${pdfUrl}`);
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      return res.status(404).json({ error: `Oracle PDF fetch failed: ${pdfRes.status}` });
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    console.log(`📦 PDF downloaded: ${pdfBuffer.length} bytes`);

    // 3. חילוץ מילים עם pdfjs-dist
    const data = new Uint8Array(pdfBuffer);
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const pg = await pdfDoc.getPage(1); 
    const viewport = pg.getViewport({ scale: 1 });
    const textContent = await pg.getTextContent();

    const rawItems = textContent.items
      .filter((it: any) => it.str && it.str.trim())
      .map((it: any) => ({
        raw: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
        h: it.height || Math.abs(it.transform[3]),
        fontSize: Math.abs(it.transform[3]),
      }));
    console.log(`📝 Extracted ${rawItems.length} raw words`);

    // 4. קבץ לשורות
    const lines = groupIntoLines(rawItems);
    console.log(`📊 Grouped into ${lines.length} lines`);

    // 5. ⭐ למד מפה אם צריך (פעם אחת per-book)
    if (!learnedBooks.has(bookId)) {
      console.log(`🧠 Learning FONT_MAP for book ${bookId} (${masechta})...`);
      const learnedMap = await learnFontMap(bookId, lines);
      setLearnedMap({ ...getLearnedMap(), ...learnedMap });
      learnedBooks.add(bookId);
      console.log(`✅ Learned map applied. Total mappings: ${Object.keys(getLearnedMap()).length}`);
    }

    // 6. פענח מילים באמצעות האסטרטגיה המנצחת
    const { decoded, stats } = decodeAll(rawItems.map(w => w.raw));
    console.log(`📊 byStrategy stats:`, JSON.stringify(stats.byStrategy));
    console.log(`🔤 Avg Hebrew ratio: ${(stats.avgRatio * 100).toFixed(0)}%`);

    // 7. מיזוג + המרת קואורדינטות Y (מ-bottom-up ל-top-down)
    const words = decoded.map((d, i) => ({
      t: d.text, 
      raw: d.raw, 
      strat: d.strategy,
      x: Math.round(rawItems[i].x * 10) / 10,
      y: Math.round((viewport.height - rawItems[i].y - rawItems[i].h) * 10) / 10,
      w: Math.round(rawItems[i].w * 10) / 10,
      h: Math.round(rawItems[i].h * 10) / 10,
      fs: Math.round(rawItems[i].fontSize * 10) / 10,
    }));

    const result = {
      bookId, masechta, daf, amud,
      pageWidth: viewport.width, pageHeight: viewport.height,
      stats, words,
    };

    // 8. שמור cache של ה-JSON המפוענח
    fs.writeFileSync(cacheFile, JSON.stringify(result));
    console.log(`💾 JSON cached: ${cacheFile}`);

    res.json(result);
  } catch (err: any) {
    console.error('❌ Overlay error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint לתמונה: פרוקסי ל-Oracle
router.get('/api/page-image-proxy/:masechta/:daf/:amud', async (req, res) => {
  const { masechta, daf, amud } = req.params;
  const url = `${ORACLE}/api/tzurat-hadaf/page-image?masechta=${encodeURIComponent(masechta)}&daf=${daf}&amud=${amud}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(404).end();
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png');
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function groupIntoLines(items: any[]) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: { words: any[] }[] = [];
  let current: any[] = [];
  let currentY = -Infinity;
  const TOL = 4;
  
  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - currentY) <= TOL) {
      current.push(item);
      if (current.length === 1) currentY = item.y;
    } else {
      if (current.length > 0) lines.push({ words: current });
      current = [item];
      currentY = item.y;
    }
  }
  if (current.length > 0) lines.push({ words: current });
  return lines;
}

export default router;
