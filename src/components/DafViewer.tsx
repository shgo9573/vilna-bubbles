// src/components/DafViewer.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import { 
  fetchOverlay, 
  getPageImageUrl, 
  fetchCommentary,
  OverlayResponse, 
  WordData,
  CommentaryResponse 
} from '../services/apiClient';
import { autoFixHebrewText, getOverlayData } from '../services/pdfExtractor';
import { ALL_TRACTATES, SHAS_SEDARIM, getTractate } from '../data/shasData';
import { numberToHebrew } from '../utils/gematria';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Filter, 
  Copy, 
  Check, 
  Search, 
  Sparkles,
  Layers,
  X
} from 'lucide-react';

interface Props {
  bookId?: number;
  page?: number;
  initialMasechta?: string;
  initialDaf?: number;
  initialAmud?: 'a' | 'b';
  onNavigate?: (masechta: string, daf: number, amud: 'a' | 'b') => void;
}

export function DafViewer({ 
  bookId: propBookId, 
  page: propPage,
  initialMasechta = 'ברכות',
  initialDaf = 2,
  initialAmud = 'a',
  onNavigate
}: Props) {
  // ── ניהול מצב מסכת, דף ועמוד ──
  const [selectedMasechta, setSelectedMasechta] = useState<string>(() => {
    if (initialMasechta) return initialMasechta;
    return 'ברכות';
  });

  const tractateMeta = useMemo(() => {
    return getTractate(selectedMasechta) || ALL_TRACTATES['ברכות'];
  }, [selectedMasechta]);

  const [dafNum, setDafNum] = useState<number>(() => {
    if (initialDaf && initialDaf >= (tractateMeta?.startDaf || 2)) {
      return initialDaf;
    }
    return tractateMeta?.startDaf || 2;
  });

  const [amud, setAmud] = useState<'a' | 'b'>(initialAmud || 'a');

  // חישוב מספר דף/עמוד בנפח המקורי
  const startDaf = tractateMeta?.startDaf || 2;
  const maxDappim = tractateMeta?.totalDappim || 64;
  const offset = Math.max(0, dafNum - startDaf);
  const extraOffset = tractateMeta?.pageOffset || 0;
  const computedPage = Math.max(1, offset * 2 + (amud === 'a' ? 2 : 3) + extraOffset);
  const effectiveBookId = propBookId || tractateMeta?.bookId || 101;
  const effectivePage = propPage || computedPage;

  // ── נתוני Overlay ומפרשים ──
  const [overlay, setOverlay] = useState<OverlayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [hoveredWord, setHoveredWord] = useState<WordData | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordData | null>(null);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [showingCommentary, setShowingCommentary] = useState(false);

  // ── סינון מפרשים (בחירת מפרש) ──
  const [selectedCommentatorFilter, setSelectedCommentatorFilter] = useState<string>('all');
  const [commentarySearchQuery, setCommentarySearchQuery] = useState('');
  const [copiedCommentaryIdx, setCopiedCommentaryIdx] = useState<number | null>(null);

  // ── מראה וזום ──
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [rotation, setRotation] = useState(0);

  const currentDafLabel = `דף ${numberToHebrew(dafNum)} ע״${amud === 'a' ? 'א' : 'ב'}`;

  // ── טעינת Overlay מלא מהשרת ──
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);
    setSelectedWord(null);
    setCommentary(null);

    fetchOverlay(effectiveBookId, effectivePage, tractateMeta.name, dafNum, amud)
      .then(data => {
        if (!isCancelled) {
          const indexedWords = (data.words || []).map((w, i) => ({
            ...w,
            id: `w_${i}`
          }));

          setOverlay({
            imageWidth: data.imageWidth,
            imageHeight: data.imageHeight,
            words: indexedWords
          });
          setLoading(false);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          setError(err.message || 'שגיאה בטעינת נתוני הדף');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [effectiveBookId, effectivePage, tractateMeta.name, dafNum, amud]);

  // ── עדכון Scale בהתאם לגודל התמונה המדויק ──
  useEffect(() => {
    if (!imgRef.current) return;

    const updateScale = () => {
      if (imgRef.current && overlay?.imageWidth) {
        const displayWidth = imgRef.current.clientWidth;
        if (displayWidth > 0) {
          setScale(displayWidth / overlay.imageWidth);
        }
      }
    };

    updateScale();

    const ro = new ResizeObserver(() => {
      updateScale();
    });
    ro.observe(imgRef.current);

    return () => ro.disconnect();
  }, [overlay, zoomFactor]);

  // ── לחיצה על מילה → שליפת מפרשים ובחירת מפרש ──
  const handleWordClick = async (word: WordData) => {
    setSelectedWord(word);
    setShowingCommentary(true);
    setLoadingCommentary(true);
    
    const lineIndex = Math.min(28, Math.max(1, Math.floor((word.y - 40) / 24) + 1));
    try {
      const comm = await fetchCommentary(
        effectiveBookId, 
        lineIndex, 
        word.t,
        tractateMeta.name,
        currentDafLabel
      );
      setCommentary({
        lineText: comm.lineText || `מסכת ${tractateMeta.name} ${currentDafLabel} – "${word.t}"`,
        commentaries: comm.commentaries
      });
    } catch (e) {
      setCommentary({
        lineText: `מסכת ${tractateMeta.name} ${currentDafLabel} – "${word.t}"`,
        commentaries: [
          { 
            type: 'rashi', 
            title: `רש״י על ${tractateMeta.name}`,
            author: 'רש״י',
            text: `[רש"י על "${word.t}"] – פירוש רש״י הקדוש על הסוגיא במסכת ${tractateMeta.name} (${currentDafLabel}).` 
          },
          { 
            type: 'tosafot', 
            title: `תוספות על ${tractateMeta.name}`,
            author: 'בעלי התוספות',
            text: `[תוספות על "${word.t}"] – ביאור התוספות ובירור שיטות הראשונים בסוגיא זו.` 
          }
        ]
      });
    } finally {
      setLoadingCommentary(false);
    }
  };

  // ── דפדוף בין דפים ──
  const handleNextDaf = () => {
    if (amud === 'a') {
      setAmud('b');
      if (onNavigate) onNavigate(tractateMeta.name, dafNum, 'b');
    } else if (dafNum < maxDappim) {
      const nextD = dafNum + 1;
      setDafNum(nextD);
      setAmud('a');
      if (onNavigate) onNavigate(tractateMeta.name, nextD, 'a');
    }
  };

  const handlePrevDaf = () => {
    if (amud === 'b') {
      setAmud('a');
      if (onNavigate) onNavigate(tractateMeta.name, dafNum, 'a');
    } else if (dafNum > startDaf) {
      const prevD = dafNum - 1;
      setDafNum(prevD);
      setAmud('b');
      if (onNavigate) onNavigate(tractateMeta.name, prevD, 'b');
    }
  };

  const handleMasechtaChange = (newMasechta: string) => {
    setSelectedMasechta(newMasechta);
    const meta = getTractate(newMasechta);
    const sDaf = meta?.startDaf || 2;
    setDafNum(sDaf);
    setAmud('a');
    setSelectedWord(null);
    setCommentary(null);
    if (onNavigate) onNavigate(newMasechta, sDaf, 'a');
  };

  const handleCopyCommentary = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCommentaryIdx(idx);
    setTimeout(() => setCopiedCommentaryIdx(null), 2000);
  };

  const imageUrl = getPageImageUrl(effectiveBookId, effectivePage, tractateMeta.name, dafNum, amud);

  // מפרשים מסוננים לפי בחירת המפרש של המשתמש
  const availableCommentatorTypes = useMemo(() => {
    if (!commentary?.commentaries) return [];
    const types = new Set<string>();
    commentary.commentaries.forEach(c => {
      if (c.type) types.add(c.type.toLowerCase());
    });
    return Array.from(types);
  }, [commentary]);

  const filteredCommentaries = useMemo(() => {
    if (!commentary?.commentaries) return [];
    return commentary.commentaries.filter(comm => {
      // סינון לפי סוג מפרש
      if (selectedCommentatorFilter !== 'all') {
        const commType = comm.type?.toLowerCase() || '';
        if (selectedCommentatorFilter === 'rashi' && !commType.includes('rashi') && !comm.title?.includes('רש')) return false;
        if (selectedCommentatorFilter === 'tosafot' && !commType.includes('tosafot') && !comm.title?.includes('תוס')) return false;
        if (selectedCommentatorFilter === 'maharsha' && !commType.includes('maharsha') && !comm.title?.includes('מהרש')) return false;
      }
      // סינון לפי חיפוש טקסט
      if (commentarySearchQuery.trim()) {
        const q = commentarySearchQuery.trim().toLowerCase();
        const text = (comm.text || '').toLowerCase();
        const title = (comm.title || '').toLowerCase();
        const author = (comm.author || '').toLowerCase();
        return text.includes(q) || title.includes(q) || author.includes(q);
      }
      return true;
    });
  }, [commentary, selectedCommentatorFilter, commentarySearchQuery]);

  return (
    <div dir="rtl" className="flex flex-col h-full w-full bg-[#FAF8F5] dark:bg-[#18110D] text-stone-900 dark:text-stone-100 select-none">
      
      {/* ── סרגל עליון: בחירת מסכתות, בחירת דפים, זום ושליטה ── */}
      <div className="px-4 py-2.5 bg-white dark:bg-stone-900 border-b border-amber-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        
        {/* ימין: סלקטור מסכת וסלקטור דפים */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-800 text-white rounded-lg shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-serif font-black text-sm sm:text-base text-amber-950 dark:text-amber-200 hidden sm:inline">
              צורת הדף
            </span>
          </div>

          <div className="h-5 w-px bg-stone-300 dark:bg-stone-700 hidden sm:block" />

          {/* 1. בחירת מסכת מתוך כל 40 מסכתות הש"ס */}
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-stone-800 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-stone-700 shadow-2xs">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 font-serif">מסכת:</span>
            <select
              value={tractateMeta.name}
              onChange={e => handleMasechtaChange(e.target.value)}
              className="text-xs sm:text-sm font-serif font-black bg-transparent text-amber-950 dark:text-amber-100 border-none outline-none cursor-pointer pr-1"
              title="בחר מסכת מכל מסכתות הש״ס"
            >
              {SHAS_SEDARIM.map(seder => (
                <optgroup key={seder.name} label={`סדר ${seder.name}`} className="font-bold text-stone-800 bg-white dark:bg-stone-900 dark:text-stone-100">
                  {seder.tractates.map(masName => (
                    <option key={masName} value={masName}>
                      {masName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 2. בחירת דף ועמוד לכל הדפים */}
          <div className="flex items-center bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={handlePrevDaf}
              disabled={dafNum <= startDaf && amud === 'a'}
              className="p-1.5 hover:bg-amber-100 dark:hover:bg-stone-800 disabled:opacity-30 rounded cursor-pointer text-stone-700 dark:text-stone-200 transition-colors"
              title="דף קודם"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <select
              value={`${dafNum}_${amud}`}
              onChange={e => {
                const [d, a] = e.target.value.split('_');
                const parsedD = parseInt(d, 10);
                const parsedA = a as 'a' | 'b';
                setDafNum(parsedD);
                setAmud(parsedA);
                if (onNavigate) onNavigate(tractateMeta.name, parsedD, parsedA);
              }}
              className="text-xs font-serif font-bold px-2 py-1 bg-transparent text-amber-950 dark:text-amber-300 border-none outline-none cursor-pointer text-center"
              title="בחר דף ועמוד מתוך כל הדפים"
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

          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-800 text-white font-bold font-serif shadow-2xs hidden md:inline">
            {currentDafLabel}
          </span>
        </div>

        {/* שמאל: כפתורי זום, פאנל מפרשים וסיבוב */}
        <div className="flex items-center gap-2">
          {/* כפתורי זום */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setZoomFactor(z => Math.max(0.6, z - 0.15))}
              className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded text-stone-700 dark:text-stone-300 cursor-pointer"
              title="התרחק"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-serif font-bold px-1.5 text-stone-700 dark:text-stone-300">
              {Math.round(zoomFactor * 100)}%
            </span>
            <button
              onClick={() => setZoomFactor(z => Math.min(2.5, z + 0.15))}
              className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded text-stone-700 dark:text-stone-300 cursor-pointer"
              title="התקרב"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* סיבוב */}
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 cursor-pointer transition-colors"
            title="סובב דף ב-90 מעלות"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* מתג הצגת פאנל מפרשים */}
          <button
            onClick={() => setShowingCommentary(!showingCommentary)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
              showingCommentary
                ? 'bg-amber-800 text-white border-amber-700'
                : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-amber-50'
            }`}
            title="פתיחה/סגירת פאנל המפרשים"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>מפרשים</span>
          </button>
        </div>
      </div>

      {/* ── האזור הראשי: דף הגמרא עם בועות מילים + פאנל מפרשים ── */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* אזור הדף והבועות */}
        <div className="flex-1 h-full overflow-auto flex items-start justify-center p-4 sm:p-8 bg-[#F5F2EB] dark:bg-[#120E0B] relative">
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/80 dark:bg-stone-950/80 z-40 backdrop-blur-xs">
              <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-serif font-bold text-amber-950 dark:text-amber-200">
                טוען את מסכת {tractateMeta.name} {currentDafLabel}...
              </p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-red-200 max-w-md m-auto z-40">
              <p className="text-red-600 font-serif font-bold mb-2">שגיאה בטעינת הדף: {error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetchOverlay(effectiveBookId, effectivePage, tractateMeta.name, dafNum, amud)
                    .then(setOverlay)
                    .finally(() => setLoading(false));
                }}
                className="mt-3 px-4 py-2 bg-amber-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-amber-900"
              >
                נסה שוב
              </button>
            </div>
          )}

          <div 
            ref={containerRef} 
            className="relative bg-white dark:bg-stone-900 shadow-2xl rounded-lg overflow-hidden border border-stone-300 dark:border-stone-800 m-auto transition-transform duration-150 origin-top"
            style={{
              transform: `scale(${zoomFactor}) rotate(${rotation}deg)`,
              maxWidth: '900px',
              width: '100%'
            }}
          >
            {/* התמונה האיכותית והמקורית מהשרת */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt={`מסכת ${tractateMeta.name} ${currentDafLabel}`}
              className="block w-full h-auto select-none"
              draggable={false}
              onLoad={() => {
                if (imgRef.current && overlay) {
                  setScale(imgRef.current.clientWidth / (overlay.imageWidth || 612));
                }
              }}
            />

            {/* שכבת בועות מילים אינדיבידואליות עם מזהה ייחודי ודיוק פיקסלי */}
            {overlay && overlay.words && overlay.words.map((word: any) => {
              const cleanWord = word.t?.trim() || '';
              if (!cleanWord || /^[\.\,\:\;\-\'\"]+$/.test(cleanWord)) return null;

              const isHovered = hoveredWord?.id === word.id;
              const isSelected = selectedWord?.id === word.id;

              const left = word.x * scale;
              const top = word.y * scale;
              const width = word.w * scale;
              const height = word.h * scale;

              return (
                <div
                  key={word.id}
                  className="absolute select-text cursor-pointer"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: isSelected 
                      ? 'rgba(217, 119, 6, 0.38)' 
                      : isHovered 
                        ? 'rgba(255, 255, 0, 0.45)' 
                        : 'transparent',
                    border: isSelected 
                      ? '1.5px solid #b45309' 
                      : isHovered 
                        ? '1.5px solid rgba(255, 180, 0, 0.9)' 
                        : 'none',
                    boxShadow: isSelected ? '0 0 0 1px rgba(251, 191, 36, 0.4)' : 'none',
                    zIndex: isSelected ? 30 : isHovered ? 20 : 10,
                    borderRadius: '2px',
                    transition: 'background-color 0.05s ease, border-color 0.05s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'transparent',
                    fontSize: `${word.fontSize * scale}px`,
                    fontFamily: 'serif',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                  onMouseEnter={() => setHoveredWord(word)}
                  onMouseLeave={() => setHoveredWord(null)}
                  onClick={() => handleWordClick(word)}
                  title={`${cleanWord} (לחץ להצגת מפרשים)`}
                >
                  {cleanWord}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── פאנל המפרשים הצדדי עם בחירת מפרש ── */}
        {showingCommentary && (
          <div className="w-80 sm:w-96 shrink-0 bg-white dark:bg-stone-900 border-r border-amber-200 dark:border-stone-800 shadow-2xl flex flex-col h-full z-40 transition-all duration-200 animate-in slide-in-from-right-4">
            
            {/* כותרת פאנל המפרשים */}
            <div className="p-3.5 border-b border-amber-200 dark:border-stone-800 bg-amber-50/80 dark:bg-stone-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-amber-800 text-white rounded-md">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-sm text-amber-950 dark:text-amber-200">
                    {selectedWord ? `מילה: "${selectedWord.t}"` : 'פאנל מפרשי הש״ס'}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    מסכת {tractateMeta.name} ({currentDafLabel})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowingCommentary(false)}
                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg cursor-pointer"
                title="סגור פאנל"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3. בחירת מפרש (טאבים לסינון מהיר של רש״י, תוספות, מפרשי הש״ס) */}
            <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-bold text-amber-900 dark:text-amber-300 font-serif">
                  <Filter className="w-3 h-3" />
                  <span>בחירת מפרש:</span>
                </div>
                <span className="text-[10px] text-stone-400">
                  {filteredCommentaries.length} מפרשים מוצגים
                </span>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  onClick={() => setSelectedCommentatorFilter('all')}
                  className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 ${
                    selectedCommentatorFilter === 'all'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                  }`}
                >
                  הכל
                </button>
                <button
                  onClick={() => setSelectedCommentatorFilter('rashi')}
                  className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 ${
                    selectedCommentatorFilter === 'rashi'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                  }`}
                >
                  רש״י
                </button>
                <button
                  onClick={() => setSelectedCommentatorFilter('tosafot')}
                  className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 ${
                    selectedCommentatorFilter === 'tosafot'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                  }`}
                >
                  תוספות
                </button>
                <button
                  onClick={() => setSelectedCommentatorFilter('maharsha')}
                  className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 ${
                    selectedCommentatorFilter === 'maharsha'
                      ? 'bg-amber-800 text-white shadow-2xs'
                      : 'bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
                  }`}
                >
                  מהרש״א ושאר מפרשים
                </button>
              </div>

              {/* שדה חיפוש בתוך המפרשים */}
              <div className="relative mt-1">
                <input
                  type="text"
                  value={commentarySearchQuery}
                  onChange={e => setCommentarySearchQuery(e.target.value)}
                  placeholder="חיפוש מפרש או מילה..."
                  className="w-full text-xs pr-7 pl-2 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md outline-none focus:border-amber-600 font-serif"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2 top-1.5" />
              </div>
            </div>

            {/* תוכן המפרשים שנבחרו */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* הצגת השורה הנבחרת מתוך הגמרא */}
              {commentary?.lineText && (
                <div className="bg-amber-50/70 dark:bg-stone-800/80 p-3 rounded-lg border-r-4 border-amber-600">
                  <span className="text-[10px] font-bold text-amber-900 dark:text-amber-400 block mb-1">
                    השורה / המילה בסוגיא:
                  </span>
                  <p className="font-serif font-bold text-base leading-snug text-stone-900 dark:text-stone-100">
                    {commentary.lineText}
                  </p>
                </div>
              )}

              {loadingCommentary ? (
                <div className="text-center text-stone-400 py-12 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-serif font-bold">טוען מפרשים...</span>
                </div>
              ) : filteredCommentaries.length > 0 ? (
                filteredCommentaries.map((comm, idx) => (
                  <div key={idx} className="bg-stone-50/60 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200/80 dark:border-stone-800 hover:border-amber-300 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-serif font-black text-amber-900 dark:text-amber-300 text-sm">
                        {comm.title || (comm.type === 'rashi' ? 'רש״י' : comm.type === 'tosafot' ? 'תוספות' : 'מפרש')}
                      </h4>
                      <button
                        onClick={() => handleCopyCommentary(comm.text, idx)}
                        className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                        title="העתק טקסט מפרש"
                      >
                        {copiedCommentaryIdx === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="font-serif text-sm leading-relaxed text-stone-800 dark:text-stone-200 whitespace-pre-wrap">
                      {comm.text}
                    </p>
                  </div>
                ))
              ) : selectedWord ? (
                <div className="text-center text-stone-400 italic py-10 font-serif text-xs">
                  אין מפרשים התואמים את הסינון שנבחר.
                </div>
              ) : (
                <div className="text-center text-stone-400 py-12 font-serif text-xs">
                  👈 לחץ על מילה כלשהי בדף הגמרא כדי לטעון את כל המפרשים שלה.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
