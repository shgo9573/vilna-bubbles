import React, { useState } from 'react';
import { X, BookOpen, Copy, Check, RefreshCw, Layers, Sparkles, Filter } from 'lucide-react';
import { CommentaryItem, LinksResponse } from '../services/apiClient';
import { ClassifiedLine } from '../services/classifier';

interface CommentaryPanelProps {
  selectedLine: ClassifiedLine | null;
  bookTitle: string;
  dafLabel: string;
  commentaryData: LinksResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const CommentaryPanel: React.FC<CommentaryPanelProps> = ({
  selectedLine,
  bookTitle,
  dafLabel,
  commentaryData,
  isLoading,
  onClose,
  onRetry
}) => {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!selectedLine) return null;

  const links = commentaryData?.links || [];
  const availableCommentators = commentaryData?.availableCommentators || [];

  const filteredLinks = links.filter((item) => {
    if (selectedTypeFilter === 'all') return true;
    return item.type?.toLowerCase() === selectedTypeFilter.toLowerCase();
  });

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="w-full md:w-96 h-full flex flex-col bg-white dark:bg-stone-900 border-r border-amber-200/80 dark:border-stone-800 shadow-2xl z-30 transition-all duration-200">
      {/* Top Header */}
      <div className="px-4 py-3 bg-amber-100/90 dark:bg-stone-800/90 border-b border-amber-200 dark:border-stone-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-800 text-white rounded-lg shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-serif text-stone-900 dark:text-stone-100">
              מפרשים לשורה הנבחרת
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 font-serif">
              {bookTitle} ({dafLabel}) – שורה {selectedLine.lineIndex}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-amber-200/60 dark:hover:bg-stone-700 rounded-lg cursor-pointer transition-colors"
          title="סגור פאנל"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Line Text Preview */}
      <div className="px-4 py-3 bg-amber-50/50 dark:bg-stone-950/50 border-b border-amber-200/60 dark:border-stone-800">
        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block mb-1">
          טקסט השורה ({selectedLine.type === 'gemara' ? 'גמרא' : selectedLine.type === 'rashi' ? 'רש״י' : selectedLine.type === 'tosafot' ? 'תוספות' : 'הערת שוליים'}):
        </span>
        <p className="text-sm font-serif font-bold text-stone-800 dark:text-stone-200 leading-relaxed bg-white dark:bg-stone-900 p-2.5 rounded-lg border border-amber-200/70 dark:border-stone-800 shadow-2xs">
          "{selectedLine.fullText}"
        </p>
      </div>

      {/* Commentators Filter Bar */}
      {availableCommentators.length > 0 && (
        <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none bg-stone-50 dark:bg-stone-900">
          <Filter className="w-3.5 h-3.5 text-amber-800 dark:text-amber-400 shrink-0 mx-1" />
          <button
            onClick={() => setSelectedTypeFilter('all')}
            className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 ${
              selectedTypeFilter === 'all'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
            }`}
          >
            הכל ({links.length})
          </button>

          {availableCommentators.map((cType) => (
            <button
              key={cType}
              onClick={() => setSelectedTypeFilter(cType)}
              className={`px-2.5 py-1 text-xs font-serif font-bold rounded-full transition-all cursor-pointer shrink-0 capitalize ${
                selectedTypeFilter === cType
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100'
              }`}
            >
              {cType === 'rashi' ? 'רש״י' : cType === 'tosafot' ? 'תוספות' : cType}
            </button>
          ))}
        </div>
      )}

      {/* Main Commentary Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-stone-500">
            <div className="w-8 h-8 border-3 border-amber-800 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-serif font-bold text-amber-900 dark:text-amber-300">
              שולף מפרשים משרת אוצריה...
            </p>
          </div>
        ) : filteredLinks.length > 0 ? (
          filteredLinks.map((item, idx) => (
            <div
              key={`commentary-${idx}`}
              className="p-3.5 rounded-xl border border-amber-200/80 dark:border-stone-800 bg-amber-50/20 dark:bg-stone-800/40 hover:border-amber-400 transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-serif font-bold px-2 py-0.5 rounded-md bg-amber-800 text-white shadow-2xs">
                  {item.author || (item.type === 'rashi' ? 'רש״י' : item.type === 'tosafot' ? 'תוספות' : 'מפרש')}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(item.text, idx)}
                    className="p-1 text-stone-500 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-stone-700 rounded transition-colors cursor-pointer"
                    title="העתק טקסט מפרש"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {item.heRef && (
                <p className="text-[11px] font-serif text-stone-500 dark:text-stone-400 mb-1.5 font-semibold">
                  {item.heRef}
                </p>
              )}

              <p className="text-sm font-serif text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
                {item.text}
              </p>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-48 p-6 text-center bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-dashed border-stone-300 dark:border-stone-800">
            <Layers className="w-8 h-8 text-stone-400 mb-2" />
            <p className="text-sm font-bold font-serif text-stone-700 dark:text-stone-300 mb-1">
              אין מפרשים לשורה זו
            </p>
            <p className="text-xs text-stone-500 mb-4">
              לא נמצאו קישורים ישירים לשורה המבוקשת במסד הנתונים
            </p>
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-amber-900 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              רענן מפרשים
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
