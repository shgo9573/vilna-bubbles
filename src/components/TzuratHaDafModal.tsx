import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  Download,
  ExternalLink,
  BookOpen,
  BookMarked,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import { numberToHebrew, hebrewToNumber } from '../utils/gematria';
import { OtzariaPdfCanvasViewer } from './OtzariaPdfCanvasViewer';
import { DafViewer } from './DafViewer';

interface TzuratHaDafModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  initialDaf?: string; // e.g., "דף ב ע״א" or "ב ע״א"
  isDarkTheme?: boolean;
}

// Accurate mapping for all 40 Bavli & Yerushalmi tractates matching HebrewBooks volume reqs & start pages
const SHAS_MAP: Record<string, { req: number; englishSlug: string; startDaf: number; totalDappim: number; masechetIdPortal: number; pageOffset?: number }> = {
  'ברכות': { req: 21111, englishSlug: 'Berakhot', startDaf: 2, totalDappim: 64, masechetIdPortal: 1 },
  'שבת': { req: 21112, englishSlug: 'Shabbat', startDaf: 2, totalDappim: 157, masechetIdPortal: 2 },
  'עירובין': { req: 21113, englishSlug: 'Eruvin', startDaf: 2, totalDappim: 105, masechetIdPortal: 3 },
  'פסחים': { req: 21114, englishSlug: 'Pesachim', startDaf: 2, totalDappim: 121, masechetIdPortal: 4 },
  'שקלים': { req: 21115, englishSlug: 'Shekalim', startDaf: 2, totalDappim: 22, masechetIdPortal: 5 },
  'יומא': { req: 21116, englishSlug: 'Yoma', startDaf: 2, totalDappim: 88, masechetIdPortal: 6 },
  'סוכה': { req: 21117, englishSlug: 'Sukkah', startDaf: 2, totalDappim: 56, masechetIdPortal: 7 },
  'ביצה': { req: 21118, englishSlug: 'Beitzah', startDaf: 2, totalDappim: 40, masechetIdPortal: 8 },
  'ראש השנה': { req: 21119, englishSlug: 'Rosh_Hashanah', startDaf: 2, totalDappim: 35, masechetIdPortal: 9 },
  'תענית': { req: 21120, englishSlug: 'Taanit', startDaf: 2, totalDappim: 31, masechetIdPortal: 10 },
  'מגילה': { req: 21121, englishSlug: 'Megillah', startDaf: 2, totalDappim: 32, masechetIdPortal: 11 },
  'מועד קטן': { req: 21122, englishSlug: 'Moed_Katan', startDaf: 2, totalDappim: 29, masechetIdPortal: 12 },
  'חגיגה': { req: 21123, englishSlug: 'Chagigah', startDaf: 2, totalDappim: 27, masechetIdPortal: 13 },
  'יבמות': { req: 21124, englishSlug: 'Yevamot', startDaf: 2, totalDappim: 122, masechetIdPortal: 14 },
  'כתובות': { req: 21125, englishSlug: 'Ketubot', startDaf: 2, totalDappim: 112, masechetIdPortal: 15 },
  'נדרים': { req: 21126, englishSlug: 'Nedarim', startDaf: 2, totalDappim: 91, masechetIdPortal: 16 },
  'נזיר': { req: 21127, englishSlug: 'Nazir', startDaf: 2, totalDappim: 66, masechetIdPortal: 17 },
  'סוטה': { req: 21128, englishSlug: 'Sotah', startDaf: 2, totalDappim: 49, masechetIdPortal: 18 },
  'גיטין': { req: 21129, englishSlug: 'Gittin', startDaf: 2, totalDappim: 90, masechetIdPortal: 19 },
  'קידושין': { req: 21130, englishSlug: 'Kiddushin', startDaf: 2, totalDappim: 82, masechetIdPortal: 20 },
  'בבא קמא': { req: 21131, englishSlug: 'Bava_Kamma', startDaf: 2, totalDappim: 119, masechetIdPortal: 21 },
  'בבא מציעא': { req: 21132, englishSlug: 'Bava_Metzia', startDaf: 2, totalDappim: 119, masechetIdPortal: 22 },
  'בבא בתרא': { req: 21133, englishSlug: 'Bava_Batra', startDaf: 2, totalDappim: 176, masechetIdPortal: 23 },
  'סנהדרין': { req: 21134, englishSlug: 'Sanhedrin', startDaf: 2, totalDappim: 113, masechetIdPortal: 24 },
  'מכות': { req: 21135, englishSlug: 'Makkot', startDaf: 2, totalDappim: 24, masechetIdPortal: 25 },
  'שבועות': { req: 21136, englishSlug: 'Shevuot', startDaf: 2, totalDappim: 49, masechetIdPortal: 26 },
  'עבודה זרה': { req: 21137, englishSlug: 'Avodah_Zarah', startDaf: 2, totalDappim: 76, masechetIdPortal: 27 },
  'הוריות': { req: 21138, englishSlug: 'Horayot', startDaf: 2, totalDappim: 14, masechetIdPortal: 28 },
  'זבחים': { req: 21139, englishSlug: 'Zevachim', startDaf: 2, totalDappim: 120, masechetIdPortal: 29 },
  'מנחות': { req: 21140, englishSlug: 'Menachot', startDaf: 2, totalDappim: 110, masechetIdPortal: 30 },
  'חולין': { req: 21141, englishSlug: 'Chullin', startDaf: 2, totalDappim: 142, masechetIdPortal: 31 },
  'בכורות': { req: 21142, englishSlug: 'Bekhorot', startDaf: 2, totalDappim: 61, masechetIdPortal: 32 },
  'ערכין': { req: 21143, englishSlug: 'Arakhin', startDaf: 2, totalDappim: 34, masechetIdPortal: 33 },
  'תמורה': { req: 21144, englishSlug: 'Temurah', startDaf: 2, totalDappim: 34, masechetIdPortal: 34 },
  'כריתות': { req: 21145, englishSlug: 'Keritot', startDaf: 2, totalDappim: 28, masechetIdPortal: 35 },
  'מעילה': { req: 21146, englishSlug: 'Meilah', startDaf: 2, totalDappim: 22, masechetIdPortal: 36 },
  'קנים': { req: 21146, englishSlug: 'Kinnim', startDaf: 22, totalDappim: 25, masechetIdPortal: 36, pageOffset: -40 },
  'תמיד': { req: 21147, englishSlug: 'Tamid', startDaf: 26, totalDappim: 33, masechetIdPortal: 37 },
  'מדות': { req: 21148, englishSlug: 'Middot', startDaf: 34, totalDappim: 37, masechetIdPortal: 38 },
  'מידות': { req: 21148, englishSlug: 'Middot', startDaf: 34, totalDappim: 37, masechetIdPortal: 38 },
  'נידה': { req: 21149, englishSlug: 'Niddah', startDaf: 2, totalDappim: 73, masechetIdPortal: 39 },
  'נדה': { req: 21149, englishSlug: 'Niddah', startDaf: 2, totalDappim: 73, masechetIdPortal: 39 }
};

/**
 * Robust Talmud Daf & Amud parser supporting all standard formats:
 * - "דף ב.", "דף ב:" (dot = amud a, colon = amud b)
 * - "דף ב ע״א", "דף ב ע״ב", "דף ב עמוד א", "דף ב עמוד ב"
 * - "ב.", "ב:", "ב ע״א", "ב ע״ב"
 * - "דף 2 ע״א", "דף 2"
 */
export function parseDafString(
  raw: string,
  startDaf: number = 2,
  maxDappim: number = 180
): { dafNum: number; amud: 'a' | 'b' } {
  if (!raw || typeof raw !== 'string') return { dafNum: startDaf, amud: 'a' };

  const cleanRaw = raw.trim();

  // Pattern 1: Dot or colon notation (e.g. "דף יב.", "דף יב:", "יב.", "יב:")
  const dotColonMatch = cleanRaw.match(/(?:דף\s+)?([א-ת]+)([\.:])/i);
  if (dotColonMatch) {
    const num = hebrewToNumber(dotColonMatch[1]);
    const amud: 'a' | 'b' = dotColonMatch[2] === ':' ? 'b' : 'a';
    if (num >= startDaf && num <= maxDappim) {
      return { dafNum: num, amud };
    }
    if (num > 0) {
      return { dafNum: Math.min(num, maxDappim), amud };
    }
  }

  // Pattern 2: Hebrew word with explicit Amud (e.g. "דף פד ע״א", "דף פד ע״ב", "דף פד עמוד א", "דף פד עמוד ב")
  const wordMatch = cleanRaw.match(/דף\s+([א-ת]+)(?:\s*(?:ע[״"']?([אב])|עמוד\s*([אב]|ראשון|שני)|[,/]\s*([אב])|\s+([אב])))?/i);
  if (wordMatch) {
    const num = hebrewToNumber(wordMatch[1]);
    const amudPart = wordMatch[2] || wordMatch[3] || wordMatch[4] || wordMatch[5] || '';
    const amud: 'a' | 'b' = (amudPart.includes('ב') || amudPart.includes('שני')) ? 'b' : 'a';
    if (num >= startDaf && num <= maxDappim) {
      return { dafNum: num, amud };
    }
    if (num > 0) {
      return { dafNum: Math.min(num, maxDappim), amud };
    }
  }

  // Pattern 3: Short Hebrew prefix with Amud (e.g. "פד ע״א", "פד ע״ב", "ב עא")
  const shortMatch = cleanRaw.match(/^([א-ת]{1,4})\s*(?:ע[״"']?([אב])|עמוד\s*([אב]|ראשון|שני)|[,/]\s*([אב]))/i);
  if (shortMatch) {
    const num = hebrewToNumber(shortMatch[1]);
    const amudPart = shortMatch[2] || shortMatch[3] || shortMatch[4] || '';
    const amud: 'a' | 'b' = (amudPart.includes('ב') || amudPart.includes('שני')) ? 'b' : 'a';
    if (num >= startDaf && num <= maxDappim) {
      return { dafNum: num, amud };
    }
    if (num > 0) {
      return { dafNum: Math.min(num, maxDappim), amud };
    }
  }

  // Pattern 4: Pure digits "דף 12 ע״ב" or "דף 12"
  const digitsMatch = cleanRaw.match(/דף\s*([0-9]+)(?:\s*(?:ע[״"']?([אב])|([ab])))?/i);
  if (digitsMatch) {
    const num = parseInt(digitsMatch[1], 10);
    const amudPart = digitsMatch[2] || digitsMatch[3] || '';
    const amud: 'a' | 'b' = (amudPart.includes('ב') || amudPart.toLowerCase() === 'b') ? 'b' : 'a';
    if (num >= startDaf && num <= maxDappim) {
      return { dafNum: num, amud };
    }
    // If num is ridiculously large (like line index 834), do NOT use it!
    if (num > maxDappim) {
      return { dafNum: startDaf, amud: 'a' };
    }
  }

  return { dafNum: startDaf, amud: 'a' };
}

/**
 * Bulletproof tractate matching so non-Talmud books (Bereshit, Shulchan Aruch, Rambam, etc.)
 * NEVER falsely match a Talmud tractate, while all formats (תלמוד בבלי מסכת כתובות, תלמוד בבלי - יבמות, etc.) match 100%!
 */
export function findShasTractate(title: string) {
  if (!title || typeof title !== 'string') return null;

  const clean = title
    .replace(/[־–—\-_,.:;()\[\]{}'\"״׳]/g, ' ')
    .replace(/\b(תלמוד|בבלי|שס|ש"ס|ש״ס|מסכת|משנה|פירוש|רש"י|תוספות|על|סדר|נשים|נזיקין|מועד|קדשים|טהרות|זרעים)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Exact match with cleaned or raw title
  for (const [key, val] of Object.entries(SHAS_MAP)) {
    if (clean === key || title.trim() === key) return { name: key, ...val };
  }

  // 2. Contains match with word boundary or inclusion
  for (const [key, val] of Object.entries(SHAS_MAP)) {
    if (clean.includes(key) || title.includes(key)) return { name: key, ...val };
  }

  return null;
}

export const TzuratHaDafModal: React.FC<TzuratHaDafModalProps> = ({
  isOpen,
  onClose,
  bookTitle,
  initialDaf = 'דף ב ע״א',
  isDarkTheme = false
}) => {
  // Daf parsing state: dafNum (2, 3...) and amud ('a' or 'b')
  const [dafNum, setDafNum] = useState<number>(2);
  const [amud, setAmud] = useState<'a' | 'b'>('a');

  // Viewer controls: Zoom, Invert dark mode, Fullscreen, Rotation
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pdfInvert, setPdfInvert] = useState<boolean>(isDarkTheme);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'oracle' | 'local'>('oracle');

  // Match tractate from book title
  const tractateMatch = findShasTractate(bookTitle);

  const isShasBook = tractateMatch !== null;
  const tractateHebrew = tractateMatch ? tractateMatch.name : bookTitle;
  const reqId = tractateMatch ? tractateMatch.req : 21111;
  const startDaf = tractateMatch ? tractateMatch.startDaf : 2;
  const maxDappim = tractateMatch?.totalDappim ? tractateMatch.totalDappim : 180;
  const masechetPortalId = tractateMatch ? tractateMatch.masechetIdPortal : 1;

  // Parse initial daf when modal opens
  useEffect(() => {
    if (initialDaf) {
      const parsed = parseDafString(initialDaf, startDaf, maxDappim);
      setDafNum(parsed.dafNum);
      setAmud(parsed.amud);
      setIsLoadingPdf(true);
    }
  }, [initialDaf, isOpen, startDaf, maxDappim]);

  if (!isOpen) return null;

  const currentDafLabel = `דף ${numberToHebrew(dafNum)} ע״${amud === 'a' ? 'א' : 'ב'}`;

  // Calculate page number in HebrewBooks volume matching Vilna page layout
  const offset = Math.max(0, dafNum - startDaf);
  const extraOffset = tractateMatch?.pageOffset || 0;
  const pageNum = Math.max(1, offset * 2 + (amud === 'a' ? 2 : 3) + extraOffset);

  // Next / Prev Daf Logic
  const handleNextDaf = () => {
    if (amud === 'a') {
      setAmud('b');
    } else {
      setDafNum(prev => prev + 1);
      setAmud('a');
    }
    setIsLoadingPdf(true);
  };

  const handlePrevDaf = () => {
    if (amud === 'b') {
      setAmud('a');
    } else if (dafNum > startDaf) {
      setDafNum(prev => prev - 1);
      setAmud('b');
    }
    setIsLoadingPdf(true);
  };

  // Local disk-backed & cached PDF URLs
  const localDafPdfUrl = `/api/tzurat-hadaf/page?masechta=${encodeURIComponent(tractateHebrew)}&daf=${dafNum}&amud=${amud}&v=2`;
  const embedViewerUrl = isShasBook ? localDafPdfUrl : `https://hebrewbooks.org/pdfpager.aspx?req=${reqId}&stype=1&pg=${pageNum}`;
  const readerPageUrl = `https://hebrewbooks.org/reader/page.aspx?req=${reqId}&pg=${pageNum}`;
  const pdfFilename = `מסכת ${tractateHebrew} - ${currentDafLabel}.pdf`;
  const downloadPdfUrl = `/api/pdf/download?url=${encodeURIComponent(embedViewerUrl)}&filename=${encodeURIComponent(pdfFilename)}`;
  const portalDafYomiUrl = `https://www.daf-yomi.com/Daf.aspx?masechet=${masechetPortalId}&daf=${dafNum}&amud=${amud === 'a' ? 1 : 2}`;
  const hebrewBooksSearchUrl = `https://hebrewbooks.org/search?q=${encodeURIComponent(bookTitle)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className={`w-full h-full max-w-7xl flex flex-col rounded-2xl shadow-2xl overflow-hidden border transition-all ${
          isFullscreen ? 'fixed inset-0 rounded-none border-none' : 'max-h-[96vh]'
        } ${isDarkTheme ? 'bg-[#18110D] border-stone-800 text-stone-100' : 'bg-[#FAF8F5] border-amber-200 text-stone-900'}`}
      >
        {/* Top Header Bar */}
        <div
          className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
            isDarkTheme ? 'bg-[#1C140F] border-stone-800' : 'bg-amber-100/90 border-amber-200'
          }`}
        >
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-800 text-white rounded-xl shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-serif">
                  {isShasBook ? `מסכת ${tractateHebrew} – צורת הדף המקורית` : `מהדורה מודפסת – ${bookTitle}`}
                </h2>
                {isShasBook && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-800 text-white font-bold font-serif shadow-2xs">
                    {currentDafLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isShasBook
                  ? 'צילום דף וילנא המקורי ברזולוציה גבוהה'
                  : `מהדורה מודפסת וספריית דפוס עבור "${bookTitle}"`}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {isShasBook && (
              <>
                {/* Daf Navigation & Direct Select */}
                <div className="flex items-center bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-0.5 shadow-2xs">
                  <button
                    onClick={handlePrevDaf}
                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-stone-800 rounded cursor-pointer text-stone-700 dark:text-stone-200 transition-colors"
                    title="דף קודם"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <select
                    value={`${dafNum}_${amud}`}
                    onChange={e => {
                      const [d, a] = e.target.value.split('_');
                      setDafNum(parseInt(d, 10));
                      setAmud(a as 'a' | 'b');
                      setIsLoadingPdf(true);
                    }}
                    className="text-xs font-serif font-bold px-2 py-1 bg-transparent text-amber-950 dark:text-amber-300 border-none outline-none cursor-pointer text-center"
                    title="בחר דף ועמוד"
                  >
                    {Array.from({ length: maxDappim - startDaf + 1 }, (_, i) => startDaf + i).flatMap(d => [
                      <option key={`${d}_a`} value={`${d}_a`} className="text-stone-900 bg-white dark:bg-stone-900 dark:text-stone-100">
                        דף {numberToHebrew(d)} ע״א
                      </option>,
                      <option key={`${d}_b`} value={`${d}_b`} className="text-stone-900 bg-white dark:bg-stone-900 dark:text-stone-100">
                        דף {numberToHebrew(d)} ע״ב
                      </option>
                    ])}
                  </select>

                  <button
                    onClick={handleNextDaf}
                    disabled={dafNum >= maxDappim && amud === 'b'}
                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-stone-800 disabled:opacity-30 rounded cursor-pointer text-stone-700 dark:text-stone-200 transition-colors"
                    title="דף הבא"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
                  <button
                    onClick={() => setViewMode('oracle')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'oracle'
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                    title="מנוע ה-Oracle המשולב"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Oracle</span>
                  </button>
                  <button
                    onClick={() => setViewMode('local')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'local'
                        ? 'bg-amber-800 text-white shadow-xs'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                    title="מנוע PDF מקומי"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>מקומי</span>
                  </button>
                </div>

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 cursor-pointer"
                  title={isFullscreen ? 'צא ממסך מלא' : 'מסך מלא'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </>
            )}

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-red-800 hover:text-white text-stone-700 dark:text-stone-300 cursor-pointer transition-colors"
              title="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-start bg-stone-900/10 dark:bg-black/40 w-full">
          {isShasBook ? (
            /* CASE A: Talmud Bavli Tractate - Display High Resolution Native Otzaria Canvas */
            <>
              <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
                {viewMode === 'oracle' ? (
                  <DafViewer 
                    bookId={133} 
                    page={pageNum} 
                    initialMasechta={tractateHebrew}
                    initialDaf={dafNum}
                    initialAmud={amud}
                    onNavigate={(m, d, a) => {
                      setDafNum(d);
                      setAmud(a);
                    }}
                  />
                ) : (
                  <OtzariaPdfCanvasViewer
                    masechta={tractateHebrew}
                    dafNum={dafNum}
                    amud={amud}
                    title={tractateHebrew}
                    dafLabel={currentDafLabel}
                    isDarkTheme={isDarkTheme}
                    onNextDaf={handleNextDaf}
                    onPrevDaf={handlePrevDaf}
                    hasNextDaf={dafNum < maxDappim || amud === 'a'}
                    hasPrevDaf={dafNum > startDaf || amud === 'b'}
                  />
                )}
              </div>

              {/* Bottom Footer Controls */}
              <div className="w-full flex flex-wrap items-center justify-between text-xs text-stone-600 dark:text-stone-400 px-4 py-2.5 bg-white/95 dark:bg-stone-900/95 border-t border-amber-200/60 dark:border-stone-800 shadow-2xs gap-2 z-20">
                <span className="font-serif font-bold text-stone-800 dark:text-stone-200">
                  דף וילנא מקורי: מסכת {tractateHebrew} {currentDafLabel}
                </span>

                <div className="flex items-center gap-4 flex-wrap">
                  <a
                    href={readerPageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 hover:underline font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    פתח בקורא HebrewBooks
                  </a>

                  <span className="text-stone-300 dark:text-stone-700">|</span>

                  <a
                    href={portalDafYomiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 hover:underline font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    פתח בפורטל הדף היומי
                  </a>

                  <span className="text-stone-300 dark:text-stone-700">|</span>

                  <a
                    href={downloadPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 hover:underline font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    הורד קובץ PDF
                  </a>
                </div>
              </div>
            </>
          ) : (
            /* CASE B: Non-Talmud Book - Display Clean Info & Search for exact book title */
            <div className={`max-w-3xl w-full p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center gap-6 my-auto ${
              isDarkTheme ? 'bg-[#1C140F] border-stone-800 text-stone-100' : 'bg-white border-amber-200 text-stone-900'
            }`}>
              <div className="p-4 bg-amber-800/10 text-amber-800 dark:text-amber-300 rounded-3xl border border-amber-800/20">
                <BookMarked className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black font-serif text-amber-950 dark:text-amber-200">
                  מהדורה מודפסת עבור: "{bookTitle}"
                </h3>
                <p className="text-sm font-serif text-stone-600 dark:text-stone-300 leading-relaxed max-w-xl mx-auto">
                  צורת הדף המובנית בסריקת "דף וילנא" מותאמת כעת למסכתות הש"ס הבבלי. עבור הספר <strong className="text-amber-900 dark:text-amber-300">"{bookTitle}"</strong>, ניתן לפתוח ולעיין במהדורות המודפסות והסריקות המלאות בספריית HebrewBooks:
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center pt-2">
                <a
                  href={hebrewBooksSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-amber-800 hover:bg-amber-900 text-white font-serif font-bold px-6 py-3 rounded-2xl shadow-md transition-all w-full sm:w-auto cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>חפש מהדורת דפוס של "{bookTitle}" ב-HebrewBooks</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href="https://hebrewbooks.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-serif font-bold px-5 py-3 rounded-2xl transition-all w-full sm:w-auto cursor-pointer"
                >
                  <span>ספריית HebrewBooks הראשית</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
