// src/server/decoder.ts

const HEBREW_RE = /[\u05D0-\u05EA]/g;

export function hebrewRatio(s: string): number {
  if (!s) return 0;
  // Remove vowels, punctuation, and spaces to measure raw letter ratio
  const letters = s.replace(/[\s\d\p{P}\p{S}\u0591-\u05C7ֿ־]/gu, '');
  if (letters.length === 0) return 0;
  const heb = (letters.match(HEBREW_RE) || []).length;
  return heb / letters.length;
}

const FONT_MAP: Record<string, string> = {
  'à':'א','á':'ב','â':'ג','ã':'ד','ä':'ה','å':'ו','æ':'ז','ç':'ח',
  'è':'ט','é':'י','ë':'כ','ì':'ל','î':'מ','ï':'ן','ð':'נ','ñ':'ס',
  'ò':'ע','ô':'פ','ö':'צ','÷':'ק','ø':'ר','ù':'ש','ú':'ת',
  'ê':'ך','í':'ם','õ':'ץ','ó':'ף'
};

let LEARNED_MAP: Record<string, string> = {};
export function setLearnedMap(m: Record<string, string>) { 
  LEARNED_MAP = m; 
}
export function getLearnedMap() { 
  return LEARNED_MAP; 
}

const rev = (s: string) => [...s].reverse().join('');
const applyMap = (s: string, map: Record<string, string>) =>
  rev(s).split('').map(c => map[c] || c).join('');

export interface DecodedWord {
  text: string;
  raw: string;
  strategy: 'asIs' | 'fontMap' | 'learned' | 'none';
  ratio: number;
}

export function decodeWord(raw: string): DecodedWord {
  const cands: DecodedWord[] = [
    { text: raw, raw, strategy: 'asIs', ratio: hebrewRatio(raw) },
    { text: applyMap(raw, FONT_MAP), raw, strategy: 'fontMap', ratio: hebrewRatio(applyMap(raw, FONT_MAP)) },
    { text: applyMap(raw, LEARNED_MAP), raw, strategy: 'learned', ratio: hebrewRatio(applyMap(raw, LEARNED_MAP)) },
  ];
  
  // Choose the candidate with the highest Hebrew ratio. If all are 0, prefer asIs.
  return cands.reduce((b, c) => c.ratio > b.ratio ? c : b);
}

export function decodeAll(rawWords: string[]) {
  const decoded = rawWords.map(decodeWord);
  const byStrategy: Record<string, number> = {};
  let ratioSum = 0;
  
  for (const d of decoded) {
    byStrategy[d.strategy] = (byStrategy[d.strategy] || 0) + 1;
    ratioSum += d.ratio;
  }
  
  return { 
    decoded, 
    stats: { 
      total: decoded.length, 
      byStrategy, 
      avgRatio: ratioSum / Math.max(1, decoded.length) 
    } 
  };
}
