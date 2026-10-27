// src/services/matcher.ts

import { PdfWord } from './pdfEngine';

export interface PdfLine {
  words: PdfWord[];
  fullText: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
}

/**
 * מקבץ מילים מה-PDF לשורות פיזיות (לפי Y)
 */
export function groupWordsIntoLines(words: PdfWord[]): PdfLine[] {
  if (words.length === 0) return [];

  const avgFontSize = words.reduce((s, w) => s + w.fontSize, 0) / words.length;
  const Y_TOLERANCE = Math.max(2, avgFontSize * 0.4); // 40% מגובה הפונט
  
  console.log(`📏 Dynamic Y_TOLERANCE: ${Y_TOLERANCE.toFixed(1)} (avgFontSize: ${avgFontSize.toFixed(1)})`);

  const sorted = [...words].sort((a, b) => b.y - a.y); // מלמעלה למטה (PDF y=0 בתחתית)
  
  const lines: PdfLine[] = [];
  let currentGroup: PdfWord[] = [];
  let currentY = -Infinity;

  for (const word of sorted) {
    if (currentGroup.length === 0 || Math.abs(word.y - currentY) <= Y_TOLERANCE) {
      currentGroup.push(word);
      if (currentGroup.length === 1) currentY = word.y;
    } else {
      if (currentGroup.length > 0) {
        lines.push(buildLine(currentGroup));
      }
      currentGroup = [word];
      currentY = word.y;
    }
  }
  if (currentGroup.length > 0) {
    lines.push(buildLine(currentGroup));
  }

  return lines;
}

function buildLine(words: PdfWord[]): PdfLine {
  // ממיין מילים מימין לשמאל (RTL)
  const sorted = [...words].sort((a, b) => b.x - a.x);
  
  const minX = Math.min(...words.map(w => w.x));
  const minY = Math.min(...words.map(w => w.y));
  const maxX = Math.max(...words.map(w => w.x + w.w));
  const maxY = Math.max(...words.map(w => w.y + w.h));

  return {
    words: sorted,
    fullText: sorted.map(w => w.text).join(' ').trim(),
    page: words[0].page,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}
