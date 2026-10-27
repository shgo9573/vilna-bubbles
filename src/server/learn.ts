// src/server/learn.ts
import { decodeWord, hebrewRatio } from './decoder.js';

const ORACLE = 'https://otzaria.duckdns.org';

/**
 * 1. מצא עוגן: המילה התקינה הארוכה הראשונה ב-PDF
 */
function findAnchor(pdfWords: string[]): string | null {
  for (const w of pdfWords) {
    const clean = w.replace(/[^\u05D0-\u05EA]/g, '');
    if (clean.length >= 5 && hebrewRatio(w) > 0.8) return w;
  }
  return null;
}

/**
 * 2. יישר מילה-מילה בין שורת PDF לשורת DB, למד מיפוי
 */
function learnFromPair(pdfWord: string, dbWord: string, acc: Map<string, Map<string, number>>) {
  const p = [...pdfWord], d = [...dbWord];
  if (p.length !== d.length || p.length < 3) return; // רק אורך תואם = אמין

  for (let i = 0; i < p.length; i++) {
    if (p[i] === d[i]) continue;
    // רק תווים שאינם עברית ואינם סימני פיסוק סטנדרטיים (סביר שהם ה-corruption)
    if (!/[\u05D0-\u05EA\s\d\p{P}]/u.test(p[i])) {
      if (!acc.has(p[i])) acc.set(p[i], new Map());
      acc.get(p[i])!.set(d[i], (acc.get(p[i])!.get(d[i]) || 0) + 1);
    }
  }
}

/**
 * מנוע הלמידה הראשי: מיישר PDF מול DB ולומד את מפת התווים
 */
export async function learnFontMap(bookId: number, pdfLines: { words: { raw: string }[] }[]) {
  const acc = new Map<string, Map<string, number>>();
  const allRawWords = pdfLines.flatMap(l => l.words.map(w => w.raw));
  const anchor = findAnchor(allRawWords);
  
  if (!anchor) {
    console.warn('⚠️ No reliable anchor found for learning.');
    return {};
  }

  try {
    // 1. מצא line_index של העוגן ב-DB
    console.log(`🧠 Learning: Searching for anchor "${anchor}" in DB...`);
    const frRes = await fetch(`${ORACLE}/api/find-line?bookId=${bookId}&text=${encodeURIComponent(anchor)}`);
    const fr = await frRes.json();
    if (!fr.matched) {
      console.warn('⚠️ Anchor not found in DB.');
      return {};
    }
    const startLine = fr.lineIndex;
    console.log(`📍 Anchor matched at DB line ${startLine}`);

    // 2. משוך שורות מה-DB החל מהעוגן
    const dbRowsRes = await fetch(`${ORACLE}/api/books/${bookId}/lines?offset=${startLine - 1}&limit=400`);
    const dbRows = await dbRowsRes.json();
    const dbLines: string[][] = (dbRows.lines || []).map((l: any) =>
      l.text.replace(/[\u0591-\u05C7ֿ־]/g, '').split(/\s+/).filter(Boolean));

    // 3. מצא איפה העוגן נופל ב-PDF כדי ליישר
    const pdfFlat = pdfLines.map(l => l.words.map(w => w.raw));
    const pdfAnchorIdx = pdfFlat.findIndex(l => l.includes(anchor));
    if (pdfAnchorIdx === -1) return {};

    // 4. יישר שורות PDF מול שורות DB ולמד מההפרש
    for (let i = 0; i < Math.min(pdfFlat.length - pdfAnchorIdx, dbLines.length); i++) {
      const pw = pdfFlat[pdfAnchorIdx + i];
      const dw = dbLines[i];
      const n = Math.min(pw.length, dw.length);
      for (let j = 0; j < n; j++) {
        learnFromPair(pw[j], dw[j], acc);
      }
    }

    // 5. פתור סתירות לפי רוב (Majority vote)
    const map: Record<string, string> = {};
    for (const [pc, votes] of acc) {
      let best = '', bc = 0;
      for (const [dc, c] of votes) {
        if (c > bc) {
          bc = c;
          best = dc;
        }
      }
      if (best && bc >= 2) map[pc] = best;
    }
    
    console.log(`✅ Mapping learned: ${Object.keys(map).length} symbols mapped.`);
    return map;
  } catch (err) {
    console.error('❌ Learning failed:', err);
    return {};
  }
}
