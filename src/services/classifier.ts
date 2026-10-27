import { WordBox, ExtractedPageText } from './pdfExtractor';

export type SectionType = 'gemara' | 'rashi' | 'tosafot' | 'marginalia' | 'header';

export interface ClassifiedLine {
  lineIndex: number;
  type: SectionType;
  y: number;
  height: number;
  minX: number;
  maxX: number;
  fullText: string;
  words: WordBox[];
}

export interface ClassifiedPage {
  pageWidth: number;
  pageHeight: number;
  lines: ClassifiedLine[];
}

/**
 * Groups words into lines based on Y coordinate similarity (tolerance ±5px)
 */
export function groupWordsIntoLines(words: WordBox[]): { y: number; words: WordBox[] }[] {
  if (!words || words.length === 0) return [];

  // Sort words vertically by Y
  const sortedWords = [...words].sort((a, b) => a.y - b.y);
  const lineGroups: { y: number; words: WordBox[] }[] = [];

  for (const word of sortedWords) {
    // Find existing line group within ±5px tolerance
    const matchingGroup = lineGroups.find(g => Math.abs(g.y - word.y) <= 5);
    if (matchingGroup) {
      matchingGroup.words.push(word);
      // Update average Y
      matchingGroup.y = matchingGroup.words.reduce((sum, w) => sum + w.y, 0) / matchingGroup.words.length;
    } else {
      lineGroups.push({ y: word.y, words: [word] });
    }
  }

  // Sort words in each line horizontally (Right to Left for Hebrew)
  for (const group of lineGroups) {
    group.words.sort((a, b) => (b.x + b.w) - (a.x + a.w));
  }

  // Sort line groups vertically top to bottom
  return lineGroups.sort((a, b) => a.y - b.y);
}

/**
 * Classifies page word boxes into Gemara, Rashi, Tosafot, and Marginalia
 */
export function classifyPageText(extracted: ExtractedPageText): ClassifiedPage {
  const { pageWidth, pageHeight, words } = extracted;
  const lineGroups = groupWordsIntoLines(words);
  const classifiedLines: ClassifiedLine[] = [];

  lineGroups.forEach((group, idx) => {
    const lineWords = group.words;
    if (lineWords.length === 0) return;

    // Calculate line bounding box and metrics
    const minX = Math.min(...lineWords.map(w => w.x));
    const maxX = Math.max(...lineWords.map(w => w.x + w.w));
    const avgHeight = lineWords.reduce((s, w) => s + (w.fontSize || w.h), 0) / lineWords.length;
    const fullText = lineWords.map(w => w.t).join(' ');

    const lineCenterX = (minX + maxX) / 2;
    const pageCenterX = pageWidth / 2;

    // Section type classification logic
    let type: SectionType = 'gemara';

    if (avgHeight >= 11.5) {
      // Main Talmud Gemara text (larger font)
      type = 'gemara';
    } else if (avgHeight < 7.5 || minX < 40 || maxX > pageWidth - 40) {
      // Extreme margins or very small font (Ein Mishpat, Torah Or, Mesorat HaShas)
      type = 'marginalia';
    } else if (lineCenterX > pageCenterX) {
      // Right side column -> Rashi
      type = 'rashi';
    } else {
      // Left side column / outer or lower block -> Tosafot
      type = 'tosafot';
    }

    classifiedLines.push({
      lineIndex: idx + 1,
      type,
      y: Math.round(group.y * 10) / 10,
      height: Math.round(avgHeight * 10) / 10,
      minX: Math.round(minX * 10) / 10,
      maxX: Math.round(maxX * 10) / 10,
      fullText,
      words: lineWords
    });
  });

  return {
    pageWidth,
    pageHeight,
    lines: classifiedLines
  };
}
