// src/services/pdfEngine.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const FONT_MAP: Record<string, string> = {
  'à': 'א', 'á': 'ב', 'â': 'ג', 'ã': 'ד', 'ä': 'ה', 'å': 'ו',
  'æ': 'ז', 'ç': 'ח', 'è': 'ט', 'é': 'י', 'ë': 'כ', 'ì': 'ל',
  'î': 'מ', 'ï': 'ן', 'ð': 'נ', 'ñ': 'ס', 'ò': 'ע', 'ô': 'פ',
  'ö': 'צ', '÷': 'ק', 'ø': 'ר', 'ù': 'ש', 'ú': 'ת',
  'ê': 'ך', 'í': 'ם', 'õ': 'ץ', 'ó': 'ף'
};

function decodeWord(word: string): string {
  const needsDecode = [...word].some(c => c in FONT_MAP);
  if (!needsDecode) return word;
  return [...word].reverse().map(c => FONT_MAP[c] || c).join('');
}

export interface PdfWord {
  text: string;
  rawText: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
}

export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export interface ExtractionResult {
  pdf: pdfjsLib.PDFDocumentProxy;
  words: PdfWord[];
  pages: PdfPageInfo[];
}

export async function extractAllWordsFromPdf(pdf: pdfjsLib.PDFDocumentProxy): Promise<ExtractionResult> {
  const allWords: PdfWord[] = [];
  const pages: PdfPageInfo[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
    });

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;

      const raw = item.str;
      const decoded = decodeWord(raw);
      const tx = item.transform[4];
      const ty = item.transform[5];
      const w = (item as any).width || (raw.length * Math.abs(item.transform[3]) * 0.55);
      const h = (item as any).height || Math.abs(item.transform[3]);
      const fontSize = Math.abs(item.transform[3]);

      allWords.push({
        text: decoded,
        rawText: raw,
        page: pageNum,
        x: tx,
        y: ty,
        w,
        h,
        fontSize,
      });
    }
  }

  console.log(`✅ Extracted ${allWords.length} words from ${pages.length} pages using single PDF proxy`);
  return { pdf, words: allWords, pages };
}
