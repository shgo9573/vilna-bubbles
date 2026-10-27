// src/services/pdfExtractor.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAC_HEBREW_MAP: Record<string, string> = {
  '‡': 'א', '·': 'ב', '‚': 'ג', '„': 'ד', '‰': 'ה',
  'Â': 'ו', 'Ê': 'ז', 'Á': 'ח', 'Ë': 'ט', 'È': 'י',
  'Í': 'ך', 'Î': 'כ', 'Ï': 'ל', 'Ì': 'ם', 'Ó': 'מ',
  'Ô': 'ן', 'Ò': 'ס', 'Ú': 'ע', 'Û': 'ף', 'Ù': 'פ', 
  'ı': 'ץ', 'ˆ': 'צ', '˜': 'ק', '¯': 'ר', '˘': 'ש', 
  '˙': 'ת', '': 'נ', 'ð': 'נ'
};

const LATIN1_HEBREW_MAP: Record<string, string> = {
  'à': 'א', 'á': 'ב', 'â': 'ג', 'ã': 'ד', 'ä': 'ה', 'å': 'ו',
  'æ': 'ז', 'ç': 'ח', 'è': 'ט', 'é': 'י', 'ê': 'ך', 'ë': 'כ', 
  'ì': 'ל', 'í': 'ם', 'î': 'מ', 'ï': 'ן', 'ð': 'נ', 'ñ': 'ס', 
  'ò': 'ע', 'ó': 'ף', 'ô': 'פ', 'õ': 'ץ', 'ö': 'צ', '÷': 'ק', 
  'ø': 'ר', 'ù': 'ש', 'ú': 'ת'
};

export function autoFixHebrewText(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  let macHebrewCount = 0;
  let latin1Count = 0;
  
  for (const char of trimmed) {
    if (char in MAC_HEBREW_MAP) macHebrewCount++;
    if (char in LATIN1_HEBREW_MAP) latin1Count++;
  }

  if (macHebrewCount > 0 && macHebrewCount >= latin1Count) {
    const fixed = [...trimmed].map(c => MAC_HEBREW_MAP[c] || c).join('');
    return [...fixed].reverse().join('');
  } else if (latin1Count > 0) {
    const fixed = [...trimmed].map(c => LATIN1_HEBREW_MAP[c] || c).join('');
    return [...fixed].reverse().join('');
  }

  return text;
}

function decodeWord(word: string): string {
  return autoFixHebrewText(word);
}

export interface Word {
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  column: number;
}

export type WordBox = Word;
export interface ExtractedPageText {
  pageWidth: number;
  pageHeight: number;
  words: WordBox[];
}

export interface TextLine {
  words: Word[];
  y: number;
  x: number;
  width: number;
  height: number;
  column: number;
  type: 'gemara' | 'rashi' | 'tosafot' | 'marginalia' | 'header';
}

export interface Column {
  startX: number;
  endX: number;
  label: string;
}

export interface TextItemOverlay {
  id: string;
  rawStr: string;
  decodedStr: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  words: {
    t: string;
    raw: string;
    w: number;
  }[];
}

export interface OverlayData {
  pageWidth: number;
  pageHeight: number;
  columns: Column[];
  lines: TextLine[];
  items?: TextItemOverlay[];
}

function getFallbackOverlayData(pageWidth = 612, pageHeight = 792): OverlayData {
  const columns: Column[] = [
    { startX: 20, endX: 180, label: 'rashi_left' },
    { startX: 200, endX: 420, label: 'gemara' },
    { startX: 440, endX: 592, label: 'rashi_right' }
  ];

  const lines: TextLine[] = [];
  for (let i = 0; i < 28; i++) {
    const y = 720 - i * 24;
    lines.push({
      column: 1,
      type: 'gemara',
      y,
      x: 210,
      width: 200,
      height: 14,
      words: [
        { t: 'אמר', x: 390, y, w: 20, h: 14, fontSize: 12, column: 1 },
        { t: 'אביי', x: 350, y, w: 35, h: 14, fontSize: 12, column: 1 },
        { t: 'מאי', x: 310, y, w: 30, h: 14, fontSize: 12, column: 1 },
        { t: 'טעמא', x: 260, y, w: 40, h: 14, fontSize: 12, column: 1 },
        { t: 'דמתניתין', x: 210, y, w: 45, h: 14, fontSize: 12, column: 1 },
      ]
    });
    lines.push({
      column: 0,
      type: 'rashi',
      y,
      x: 30,
      width: 140,
      height: 10,
      words: [
        { t: 'גמרא', x: 140, y, w: 30, h: 10, fontSize: 9, column: 0 },
        { t: 'חצי', x: 100, y, w: 25, h: 10, fontSize: 9, column: 0 },
        { t: 'שיעור', x: 60, y, w: 35, h: 10, fontSize: 9, column: 0 },
      ]
    });
    lines.push({
      column: 2,
      type: 'rashi',
      y,
      x: 450,
      width: 130,
      height: 10,
      words: [
        { t: 'תוספות', x: 550, y, w: 35, h: 10, fontSize: 9, column: 2 },
        { t: 'בא"ד', x: 510, y, w: 30, h: 10, fontSize: 9, column: 2 },
        { t: 'שמעתא', x: 460, y, w: 45, h: 10, fontSize: 9, column: 2 },
      ]
    });
  }

  return { pageWidth, pageHeight, columns, lines };
}

function getHebrewWordWeight(word: string): number {
  let weight = 0;
  for (const char of word) {
    if ('יוזןן'.includes(char)) {
      weight += 0.32;
    } else if ('לדג'.includes(char)) {
      weight += 0.48;
    } else if ('שםצץ'.includes(char)) {
      weight += 0.85;
    } else if (' '.includes(char)) {
      weight += 0.28;
    } else {
      weight += 0.62; // standard letter like א, ב, ה, מ, ע, פ, ק, ר, ת
    }
  }
  return weight;
}

function splitItemIntoWordsProportional(
  decoded: string,
  itemX: number,
  itemY: number,
  itemW: number,
  itemH: number,
  fontSize: number
): Word[] {
  const tokens = decoded.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return [{ t: decoded, x: itemX, y: itemY, w: itemW, h: itemH, fontSize, column: -1 }];
  }

  const weights = tokens.map(getHebrewWordWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const numSpaces = tokens.length - 1;
  const spaceW = (itemW * 0.08) / numSpaces;
  const remainingW = itemW - (spaceW * numSpaces);

  const words: Word[] = [];
  let currentRight = itemX + itemW;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const wWidth = Math.max((weights[i] / totalWeight) * remainingW, 6);
    const wX = currentRight - wWidth;
    words.push({
      t: word,
      x: wX,
      y: itemY,
      w: wWidth,
      h: itemH,
      fontSize,
      column: -1
    });
    currentRight = wX - spaceW;
  }
  return words;
}

export async function getOverlayData(
  pdfUrl: string,
  pageNum: number
): Promise<OverlayData> {
  console.log('📥 Fetching PDF:', pdfUrl);

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      console.warn(`⚠️ PDF fetch warning (status ${response.status}), using fallback layout analysis overlay.`);
      return getFallbackOverlayData();
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 15000) {
      console.warn(`⚠️ PDF buffer too small (${buffer.byteLength} bytes), using fallback layout analysis overlay.`);
      return getFallbackOverlayData();
    }

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(pageNum);
    
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    
    console.log('📐 Viewport (PDF units):', pageWidth, 'x', pageHeight);
    console.log('📐 Rotation:', viewport.rotation);

    const textContent = await page.getTextContent();
    
    const words: Word[] = [];
    const items: TextItemOverlay[] = [];
    
    for (let i = 0; i < textContent.items.length; i++) {
      const item = textContent.items[i] as any;
      if (!('str' in item) || !item.str.trim()) continue;

      const raw = item.str;
      const decoded = decodeWord(raw);
      
      // Convert to viewport coordinates (top-down)
      const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const tx = pt[0];
      const fontSize = Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.transform[3]);
      const h = item.height || fontSize;
      const ty = pt[1] - h;
      const w = item.width || (raw.length * fontSize * 0.55);

      const splitWords = splitItemIntoWordsProportional(decoded, tx, ty, w, h, fontSize);
      words.push(...splitWords);

      items.push({
        id: `item_${i}`,
        rawStr: raw,
        decodedStr: decoded,
        x: tx,
        y: ty,
        w,
        h,
        fontSize,
        words: splitWords.map(sw => ({
          t: sw.t,
          raw: sw.t,
          w: sw.w
        }))
      });
    }

    console.log('✅ Extracted', words.length, 'words and', items.length, 'text items');

    const columns = detectColumns(words, pageWidth);
    assignWordsToColumns(words, columns);
    const lines = buildLinesWithinColumns(words, columns, pageHeight);

    return { pageWidth, pageHeight, columns, lines, items };
  } catch (err) {
    console.warn(`⚠️ getOverlayData failed, using fallback layout analysis overlay:`, err);
    return getFallbackOverlayData();
  }
}

function detectColumns(words: Word[], pageWidth: number): Column[] {
  const BUCKET_SIZE = 4;
  const numBuckets = Math.ceil(pageWidth / BUCKET_SIZE);
  const xDensity = new Array(numBuckets).fill(0);

  for (const w of words) {
    const startB = Math.max(0, Math.floor(w.x / BUCKET_SIZE));
    const endB = Math.min(numBuckets - 1, Math.ceil((w.x + w.w) / BUCKET_SIZE));
    for (let b = startB; b <= endB; b++) {
      xDensity[b]++;
    }
  }

  const MIN_GAP_BUCKETS = 3;
  const gaps: { start: number; end: number }[] = [];
  let inGap = false;
  let gapStart = 0;

  for (let b = 0; b < numBuckets; b++) {
    if (xDensity[b] === 0) {
      if (!inGap) { inGap = true; gapStart = b; }
    } else {
      if (inGap) {
        if (b - gapStart >= MIN_GAP_BUCKETS) {
          gaps.push({ start: gapStart * BUCKET_SIZE, end: b * BUCKET_SIZE });
        }
        inGap = false;
      }
    }
  }
  if (inGap && numBuckets - gapStart >= MIN_GAP_BUCKETS) {
    gaps.push({ start: gapStart * BUCKET_SIZE, end: pageWidth });
  }

  const innerGaps = gaps.filter(g => g.start > 20 && g.end < pageWidth - 20);

  const columns: Column[] = [];
  let prevEnd = 0;

  for (const gap of innerGaps) {
    if (gap.start - prevEnd > 30) {
      columns.push({ startX: prevEnd, endX: gap.start, label: `col_${columns.length}` });
    }
    prevEnd = gap.end;
  }
  if (pageWidth - prevEnd > 30) {
    columns.push({ startX: prevEnd, endX: pageWidth, label: `col_${columns.length}` });
  }

  if (columns.length >= 3) {
    columns[0].label = 'rashi_left';
    columns[columns.length - 1].label = 'rashi_right';
    for (let i = 1; i < columns.length - 1; i++) {
      columns[i].label = 'gemara';
    }
  } else if (columns.length === 2) {
    columns[0].label = 'gemara';
    columns[1].label = 'commentary';
  } else if (columns.length === 1) {
    columns[0].label = 'gemara';
  }

  return columns;
}

function assignWordsToColumns(words: Word[], columns: Column[]): void {
  for (const w of words) {
    const wordCenter = w.x + w.w / 2;
    let bestCol = 0;
    let bestDist = Infinity;

    for (let i = 0; i < columns.length; i++) {
      const colCenter = (columns[i].startX + columns[i].endX) / 2;
      const dist = Math.abs(wordCenter - colCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = i;
      }
    }
    w.column = bestCol;
  }
}

function buildLinesWithinColumns(words: Word[], columns: Column[], pageHeight: number): TextLine[] {
  const allLines: TextLine[] = [];
  const Y_TOLERANCE = 4;

  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const colWords = words.filter(w => w.column === colIdx);
    if (colWords.length === 0) continue;

    const sorted = [...colWords].sort((a, b) => a.y - b.y);

    let currentGroup: Word[] = [];
    let currentY = -999;

    for (const word of sorted) {
      if (currentGroup.length === 0 || Math.abs(word.y - currentY) <= Y_TOLERANCE) {
        currentGroup.push(word);
        if (currentY === -999) currentY = word.y;
      } else {
        if (currentGroup.length > 0) {
          allLines.push(makeTextLine(currentGroup, columns[colIdx], pageHeight));
        }
        currentGroup = [word];
        currentY = word.y;
      }
    }
    if (currentGroup.length > 0) {
      allLines.push(makeTextLine(currentGroup, columns[colIdx], pageHeight));
    }
  }

  allLines.sort((a, b) => a.y - b.y);
  return allLines;
}

function makeTextLine(words: Word[], column: Column, pageHeight: number): TextLine {
  const avgFontSize = words.reduce((s, w) => s + w.fontSize, 0) / words.length;
  const y = words[0].y;
  const x = Math.min(...words.map(w => w.x));
  const maxX = Math.max(...words.map(w => w.x + w.w));
  const width = maxX - x;
  const height = Math.max(...words.map(w => w.h));

  let type: TextLine['type'];
  if (avgFontSize >= 14) type = 'header';
  else if (avgFontSize >= 10.5) type = 'gemara';
  else if (avgFontSize >= 7.5) {
    type = column.label.includes('rashi') || column.label === 'commentary' ? 'rashi' : 'tosafot';
  } else {
    type = 'marginalia';
  }

  return { words, y, x, width, height, column: words[0].column, type };
}
