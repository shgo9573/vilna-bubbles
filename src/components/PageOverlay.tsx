// src/components/PageOverlay.tsx
import { useState, useRef, useEffect } from 'react';
import { TextLine, OverlayData, Word } from '../services/pdfExtractor';

interface PageOverlayProps {
  overlayData: OverlayData;
  imageUrl: string;
  onWordClick: (word: Word, line: TextLine) => void;
}

export function PageOverlay({ overlayData, imageUrl, onWordClick }: PageOverlayProps) {
  const [hoveredWord, setHoveredWord] = useState<Word | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dynamic offset states for perfect alignment tuning
  const [debugMode, setDebugMode] = useState(false);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [scaleMultiplier, setScaleMultiplier] = useState(1.0);
  const [invertY, setInvertY] = useState(true);
  const [ascentShift, setAscentShift] = useState(0.8);

  const [scale, setScale] = useState(1);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 });

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    
    const naturalW = imgRef.current.naturalWidth;
    const naturalH = imgRef.current.naturalHeight;
    const rect = imgRef.current.getBoundingClientRect();
    const displayW = rect.width;
    const displayH = rect.height;
    
    console.log('🖼️ Image natural size:', naturalW, 'x', naturalH);
    console.log('🖼️ Image display size:', displayW, 'x', displayH);
    console.log('📐 PDF page size:', overlayData.pageWidth, 'x', overlayData.pageHeight);
    
    setImgNaturalSize({ w: naturalW, h: naturalH });
    setImgDisplaySize({ w: displayW, h: displayH });
    
    const scaleFactorX = displayW / overlayData.pageWidth;
    console.log('📏 Scale factor:', scaleFactorX.toFixed(3));
    
    setScale(scaleFactorX);
  };

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current && overlayData) {
        const rect = imgRef.current.getBoundingClientRect();
        setImgDisplaySize({ w: rect.width, h: rect.height });
        setScale(rect.width / overlayData.pageWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [overlayData]);

  const { pageWidth, pageHeight, lines } = overlayData;

  const typeColors: Record<string, { bg: string; border: string }> = {
    gemara:     { bg: 'rgba(0, 80, 220, 0.08)',   border: 'rgba(0, 80, 220, 0.25)' },
    rashi:      { bg: 'rgba(220, 120, 0, 0.08)',  border: 'rgba(220, 120, 0, 0.25)' },
    tosafot:    { bg: 'rgba(0, 160, 60, 0.08)',   border: 'rgba(0, 160, 60, 0.25)' },
    marginalia: { bg: 'rgba(130, 0, 160, 0.06)',  border: 'rgba(130, 0, 160, 0.2)' },
    header:     { bg: 'rgba(200, 0, 0, 0.06)',    border: 'rgba(200, 0, 0, 0.2)' },
  };

  const finalScale = scale * scaleMultiplier;

  return (
    <div className="relative w-full">
      {/* Absolute Debug Toggle */}
      <button
        onClick={() => setDebugMode(!debugMode)}
        className="absolute top-3 left-3 z-50 px-3 py-1.5 bg-amber-900 text-white rounded-lg text-xs font-serif font-bold shadow-md hover:bg-amber-950 transition-colors select-none cursor-pointer flex items-center gap-1"
      >
        <span>🔍</span>
        <span>{debugMode ? 'סגור פאנל כיול' : 'פאנל כיול בועות (Debug)'}</span>
      </button>

      {/* Floating Calibration Controls Panel */}
      {debugMode && (
        <div 
          className="absolute top-14 left-3 z-50 bg-stone-900/95 text-stone-100 p-4 rounded-xl shadow-2xl border border-stone-700 w-80 text-xs font-mono space-y-3.5 select-none"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
            <span className="font-bold text-amber-300">כיול בועות אינטראקטיבי</span>
            <span className="text-stone-400">v1.2</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-stone-300">
              <span>היפוך ציר Y (מערכת PDF):</span>
              <button 
                onClick={() => setInvertY(!invertY)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${invertY ? 'bg-amber-700 text-white' : 'bg-stone-700 text-stone-300'}`}
              >
                {invertY ? 'פעיל (bottom-up)' : 'כבוי (top-down)'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>הזזה ציר X (אופקי):</span>
              <span className="text-amber-300 font-bold">{xOffset}px</span>
            </div>
            <input 
              type="range" min="-100" max="100" value={xOffset} 
              onChange={e => setXOffset(parseInt(e.target.value))} 
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>הזזה ציר Y (אנכי):</span>
              <span className="text-amber-300 font-bold">{yOffset}px</span>
            </div>
            <input 
              type="range" min="-100" max="100" value={yOffset} 
              onChange={e => setYOffset(parseInt(e.target.value))} 
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>מכפיל Scale עדין:</span>
              <span className="text-amber-300 font-bold">{(scaleMultiplier).toFixed(3)}x</span>
            </div>
            <input 
              type="range" min="0.8" max="1.3" step="0.005" value={scaleMultiplier} 
              onChange={e => setScaleMultiplier(parseFloat(e.target.value))} 
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>הסטת Baseline (Ascent):</span>
              <span className="text-amber-300 font-bold">{ascentShift.toFixed(2)}x</span>
            </div>
            <input 
              type="range" min="0.0" max="2.0" step="0.05" value={ascentShift} 
              onChange={e => setAscentShift(parseFloat(e.target.value))} 
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="bg-stone-950 p-2 rounded text-[10px] space-y-1 text-stone-300 leading-normal border border-stone-800">
            <div className="text-amber-400 font-bold mb-1">נתוני ייחוס בזמן אמת:</div>
            <div>Scale בסיסי: {scale.toFixed(3)}</div>
            <div>ממדי תצוגה: {imgDisplaySize.w.toFixed(0)}x{imgDisplaySize.h.toFixed(0)}px</div>
            <div>ממדי PDF מקורי: {pageWidth}x{pageHeight}</div>
            <div>סה"כ מילים: {lines.reduce((acc, l) => acc + l.words.length, 0)}</div>
          </div>

          <div className="bg-amber-950/40 text-amber-200 p-2 rounded text-[10px] border border-amber-800/40 leading-normal font-mono select-text">
            <div className="font-bold text-amber-300 mb-0.5">נוסחת יישור (העתק קוד):</div>
            <div>const left = word.x * scale + {xOffset};</div>
            <div>const top = {invertY ? `(pageHeight - word.y - word.h * ${ascentShift}) * scale` : `word.y * scale`} + {yOffset};</div>
          </div>
        </div>
      )}

      {/* Main Container wrapping Image + Overlay with EXACT 0 padding/margin and lineHeight: 0 */}
      <div 
        ref={containerRef}
        className="relative"
        style={{ 
          padding: 0,
          margin: '0 auto',
          border: 'none',
          lineHeight: 0,
          maxWidth: '900px',
        }}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="דף גמרא"
          className="block w-full h-auto"
          style={{ 
            maxHeight: 'none',
            objectFit: 'contain',
            padding: 0,
            margin: 0,
            border: 'none',
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Word Overlay Bounding Boxes Container */}
        <div 
          className="absolute top-0 left-0 w-full h-full"
          style={{ 
            pointerEvents: 'auto',
            lineHeight: 0,
          }}
        >
          {imgNaturalSize.w > 0 && lines.map((line) => {
            const colors = typeColors[line.type] || typeColors.gemara;

            return line.words.map((word, wordIndex) => {
              const isHovered = hoveredWord === word;
              
              // Compute positioning with tuned offsets
              const left = word.x * finalScale + xOffset;
              
              // Custom inversion formulas
              const top = invertY
                ? (pageHeight - word.y - word.h * ascentShift) * finalScale + yOffset
                : word.y * finalScale + yOffset;

              const width = word.w * finalScale;
              const height = word.h * finalScale;

              return (
                <div
                  key={`${line.y}_${wordIndex}`}
                  className="absolute"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    background: isHovered ? 'rgba(255, 255, 0, 0.45)' : (debugMode ? 'rgba(0, 255, 0, 0.05)' : colors.bg),
                    border: isHovered
                      ? '2px solid rgba(255, 180, 0, 0.9)'
                      : (debugMode ? '1px solid rgba(0, 255, 0, 0.3)' : `1px solid ${colors.border}`),
                    borderRadius: '2px',
                    cursor: 'pointer',
                    transition: 'background 0.08s, border 0.08s',
                    zIndex: isHovered ? 30 : 10,
                    pointerEvents: 'auto',
                  }}
                  onMouseEnter={() => {
                    setHoveredWord(word);
                    if (debugMode) {
                      console.log(`🔍 Word "${word.t}": x=${word.x}, y=${word.y}, w=${word.w}, h=${word.h}`);
                    }
                  }}
                  onMouseLeave={() => setHoveredWord(null)}
                  onClick={() => onWordClick(word, line)}
                  title={word.t}
                />
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
