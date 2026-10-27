import React, { useState, useEffect } from 'react';
import { getOverlayData, OverlayData, TextLine } from '../services/pdfExtractor';
import { PageOverlay } from './PageOverlay';
import { CommentaryPanel } from './CommentaryPanel';
import { getCommentary } from '../services/apiClient';
import { ChevronRight, ChevronLeft, RotateCw, RefreshCw, AlertCircle } from 'lucide-react';

interface OtzariaPdfCanvasViewerProps {
  masechta?: string;
  dafNum?: number;
  amud?: 'a' | 'b';
  title?: string;
  dafLabel?: string;
  isDarkTheme?: boolean;
  onNextDaf?: () => void;
  onPrevDaf?: () => void;
  hasNextDaf?: boolean;
  hasPrevDaf?: boolean;
}

export const OtzariaPdfCanvasViewer: React.FC<OtzariaPdfCanvasViewerProps> = ({
  masechta = 'בכורות',
  dafNum = 13,
  amud = 'b',
  title = 'בכורות',
  dafLabel = 'דף יג ע״ב',
  isDarkTheme = false,
  onNextDaf,
  onPrevDaf,
  hasNextDaf = true,
  hasPrevDaf = true,
}) => {
  const [overlay, setOverlay] = useState<OverlayData | null>(null);
  const [selectedLine, setSelectedLine] = useState<TextLine | null>(null);
  const [commentary, setCommentary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);

  const pdfUrl = `/api/tzurat-hadaf/page?masechta=${encodeURIComponent(masechta)}&daf=${dafNum}&amud=${amud}`;
  const imageUrl = `/api/tzurat-hadaf/page-image?masechta=${encodeURIComponent(masechta)}&daf=${dafNum}&amud=${amud}&v=4`;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedLine(null);
    setCommentary(null);

    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    getOverlayData(pdfUrl, 1)
      .then(data => {
        setOverlay(data);
        setLoading(false);
        clearTimeout(loadingTimeout);
      })
      .catch(e => {
        console.error('❌ Overlay extraction error:', e);
        setError(e.message);
        setLoading(false);
        clearTimeout(loadingTimeout);
      });

    return () => clearTimeout(loadingTimeout);
  }, [masechta, dafNum, amud, pdfUrl]);

  const handleWordClick = async (word: any, line: TextLine) => {
    setSelectedLine(line);
    const lineText = line.words.map(w => w.t).join(' ');
    console.log('🖱️ Word clicked:', word.t, '| Line text:', lineText);

    try {
      const data = await getCommentary(133, 475);
      setCommentary(data);
    } catch (e) {
      setCommentary(null);
    }
  };

  return (
    <div className={`flex flex-col h-full w-full select-none ${isDarkTheme ? 'bg-[#120E0B] text-stone-100' : 'bg-[#F2ECE1] text-stone-900'}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/80 dark:bg-stone-900/80 border-b border-amber-200/60 dark:border-stone-800 backdrop-blur-md z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-amber-950 dark:text-amber-200">
            {title} - {dafLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onPrevDaf && (
            <button
              onClick={onPrevDaf}
              disabled={!hasPrevDaf}
              className="p-1.5 rounded-lg bg-amber-100 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 disabled:opacity-40 cursor-pointer transition-colors"
              title="דף קודם"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {onNextDaf && (
            <button
              onClick={onNextDaf}
              disabled={!hasNextDaf}
              className="p-1.5 rounded-lg bg-amber-100 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 disabled:opacity-40 cursor-pointer transition-colors"
              title="דף הבא"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1" />

          <button
            onClick={() => setZoomScale(z => Math.max(0.6, z - 0.15))}
            className="px-2 py-1 rounded-md bg-stone-200 dark:bg-stone-800 text-xs font-bold hover:bg-stone-300 cursor-pointer"
            title="התרחק"
          >
            -
          </button>
          <span className="text-xs font-serif font-bold w-12 text-center">{Math.round(zoomScale * 100)}%</span>
          <button
            onClick={() => setZoomScale(z => Math.min(2.2, z + 0.15))}
            className="px-2 py-1 rounded-md bg-stone-200 dark:bg-stone-800 text-xs font-bold hover:bg-stone-300 cursor-pointer"
            title="התקרב"
          >
            +
          </button>

          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer ml-2"
            title="סובב דף"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport & Commentary Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full overflow-auto flex items-start justify-center p-6 sm:p-10 relative bg-[#F9F6F0] dark:bg-[#1C140F]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-100/90 dark:bg-stone-950/90 z-20 backdrop-blur-xs">
              <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-serif font-bold text-amber-950 dark:text-amber-300">
                טוען את צורת הדף המקורית וניתוח המילים ({dafLabel})...
              </p>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-stone-900 rounded-2xl border border-red-300 shadow-xl m-auto z-20">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-2">
                שגיאה בטעינת צורת הדף.
              </p>
              <p className="text-xs text-stone-500 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-800 text-white rounded-xl text-xs font-bold shadow-md hover:bg-amber-900 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                נסה שוב
              </button>
            </div>
          ) : overlay ? (
            <div
              className="m-auto inline-flex items-center justify-center rounded-lg shadow-2xl overflow-hidden border border-stone-300 dark:border-stone-800 bg-white transition-transform duration-100 relative"
              style={{
                transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                transformOrigin: 'top center'
              }}
            >
              <PageOverlay
                overlayData={overlay}
                imageUrl={imageUrl}
                onWordClick={handleWordClick}
              />
            </div>
          ) : null}
        </div>

        {/* Side Commentary Panel */}
        {selectedLine && (
          <CommentaryPanel
            selectedLine={{
              lineIndex: 475,
              type: selectedLine.type,
              fullText: selectedLine.words.map(w => w.t).join(' '),
              words: selectedLine.words.map(w => ({ t: w.t, x: w.x, y: w.y, w: w.w, h: w.h, fontSize: w.fontSize, column: w.column })),
              y: selectedLine.y,
              height: selectedLine.words[0]?.h || 12,
              minX: Math.min(...selectedLine.words.map(w => w.x)),
              maxX: Math.max(...selectedLine.words.map(w => w.x + w.w))
            }}
            bookTitle={title}
            dafLabel={dafLabel}
            commentaryData={commentary}
            isLoading={false}
            onClose={() => setSelectedLine(null)}
            onRetry={() => handleWordClick(selectedLine.words[0], selectedLine)}
          />
        )}
      </div>
    </div>
  );
};
