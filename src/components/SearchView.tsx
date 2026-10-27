import React, { useState, useEffect } from 'react';
import { searchLibrary } from '../services/api';
import { SearchResultItem, ReaderSettings } from '../types/otzaria';
import { sysLogger } from '../services/logger';
import {
  subscribeToSearchHistory,
  saveSearchQuery,
  SearchHistoryItem
} from '../services/userService';
import { Search, Filter, BookOpen, ChevronLeft, Hash, Clock, SlidersHorizontal, Settings2 } from 'lucide-react';

interface SearchViewProps {
  settings?: ReaderSettings;
  onOpenBookAtLine: (bookId: number | string, bookTitle: string, lineIndex: number, initialSearch?: string) => void;
}

function sanitizeSnippetHtml(snippet: string): string {
  if (!snippet) return '';
  let html = snippet
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;em&gt;/gi, '<b>')
    .replace(/&lt;\/em&gt;/gi, '</b>')
    .replace(/<em>/gi, '<b>')
    .replace(/<\/em>/gi, '</b>');

  return html;
}

export const SearchView: React.FC<SearchViewProps> = ({ settings, onOpenBookAtLine }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [exactMatch, setExactMatch] = useState(false);
  const [gematriaSearch, setGematriaSearch] = useState(false);

  // Advanced search parameters matching Otzaria SearchConfiguration
  const [mode, setMode] = useState<'advanced' | 'exact' | 'phrase' | 'fuzzy'>('advanced');
  const [slop, setSlop] = useState<number>(0);
  const [proximityScope, setProximityScope] = useState<'wordDistance' | 'sameParagraph' | 'sameSection'>('wordDistance');
  const [sortBy, setSortBy] = useState<'catalogue' | 'relevance'>('catalogue');
  const [resultGrouping, setResultGrouping] = useState<'none' | 'sameSection' | 'identicalText'>('none');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [resultsCount, setResultsCount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

  const isDark = settings?.theme === 'dark';

  // Subscribe to persistent search history
  useEffect(() => {
    const unsubscribe = subscribeToSearchHistory((searches) => {
      setRecentSearches(searches);
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    if (e) e.preventDefault();
    const targetQuery = (explicitQuery !== undefined ? explicitQuery : query).trim();
    if (!targetQuery) return;

    if (explicitQuery !== undefined) {
      setQuery(targetQuery);
    }

    setIsSearching(true);
    const activeMode = exactMatch ? 'exact' : (mode === 'exact' ? 'advanced' : mode);
    const activeSlop = exactMatch ? 0 : slop;

    sysLogger.addLog(
      'info',
      'Search',
      `ביצוע חיפוש במאגר: "${targetQuery}" (מצב: ${activeMode}, מרווח slop: ${activeSlop}, קטגוריה: ${category})`
    );

    // Save search history
    saveSearchQuery(targetQuery, category);

    try {
      const data = await searchLibrary(
        targetQuery,
        category,
        exactMatch,
        gematriaSearch,
        50,
        {
          mode: activeMode,
          slop: activeSlop,
          proximityScope,
          sortBy,
          resultGrouping
        }
      );
      setResults(data.results);
      setResultsCount(data.resultsCount);
      sysLogger.addLog(
        'success',
        'Search',
        `החיפוש עבור "${targetQuery}" הושלם: נמצאו ${data.resultsCount} מופעים`
      );
    } catch (err: any) {
      console.error('Search error', err);
      sysLogger.addLog('error', 'Search', `שגיאה בחיפוש "${targetQuery}": ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-y-auto p-6 md:p-10 select-none ${
      isDark ? 'bg-[#18110D] text-stone-100' : 'bg-[#FAF8F5] text-stone-900'
    }`}>
      <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">
        {/* Search Header Card */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col gap-4 ${
          isDark ? 'bg-[#211711] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-800 text-amber-100 rounded-2xl shadow-inner">
                <Search className="w-6 h-6 text-amber-200" />
              </div>
              <div>
                <h2 className={`text-2xl font-bold font-serif ${isDark ? 'text-amber-200' : 'text-amber-950'}`}>
                  חיפוש במאגר הספרים
                </h2>
                <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  חיפוש טקסטואלי מלא בתוך כל עשרות אלפי הקטעים והספרים במאגר
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                showAdvancedOptions
                  ? 'bg-amber-800 text-white border-amber-800'
                  : isDark
                  ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                  : 'bg-stone-100 border-stone-300 text-stone-800 hover:bg-stone-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>הגדרות חיפוש מתקדם</span>
            </button>
          </div>

          {/* Search Input & Controls */}
          <form onSubmit={handleSearch} className="flex flex-col gap-3">
            <div className="relative flex items-center">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="הקלד מילה, פסוק, ביטוי או נושא לחיפוש..."
                className={`w-full rounded-2xl pr-11 pl-32 py-3.5 text-base font-serif focus:outline-none focus:ring-2 focus:ring-amber-700/50 ${
                  isDark
                    ? 'bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-500'
                    : 'bg-stone-50 border border-stone-300 text-stone-900 placeholder-stone-400'
                }`}
              />
              <Search className={`w-5 h-5 absolute right-4 pointer-events-none ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />

              <button
                type="submit"
                disabled={isSearching}
                className="absolute left-2 bg-amber-800 hover:bg-amber-900 text-amber-50 px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSearching ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-amber-100 border-t-transparent" />
                ) : (
                  <>
                    <span>חפש</span>
                    <ChevronLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Scope & Basic Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-sans">
              <div className="flex items-center gap-2">
                <span className={`font-semibold flex items-center gap-1 ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  סינון קטגוריה:
                </span>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={`border rounded-lg px-3 py-1.5 focus:outline-none ${
                    isDark ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-stone-300 text-stone-800'
                  }`}
                >
                  <option value="all">כל המאגר</option>
                  <option value='תנ"ך'>תנ"ך</option>
                  <option value='מפרשי תנ"ך'>מפרשי תנ"ך</option>
                  <option value="משנה">משנה</option>
                  <option value="מפרשי משנה">מפרשי משנה</option>
                  <option value="גמרא">גמרא (בבלי וירושלמי)</option>
                  <option value="הלכה">הלכה ושולחן ערוך</option>
                  <option value="ראשונים">שו"ת וראשונים</option>
                  <option value="מדרש">מדרשים</option>
                  <option value="מוסר">מחשבה ומוסר</option>
                  <option value="חסידות">חסידות</option>
                  <option value="קבלה">קבלה וסוד</option>
                  <option value="תפילה">תפילה ומנהגים</option>
                </select>
              </div>

              <div className={`flex items-center gap-4 font-medium ${isDark ? 'text-stone-300' : 'text-stone-800'}`}>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exactMatch}
                    onChange={e => {
                      const isChecked = e.target.checked;
                      setExactMatch(isChecked);
                      if (isChecked) {
                        setMode('exact');
                        setSlop(0);
                      } else {
                        setMode('advanced');
                        setSlop(0);
                      }
                    }}
                    className="accent-amber-800 rounded"
                  />
                  <span>ביטוי מדויק</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gematriaSearch}
                    onChange={e => setGematriaSearch(e.target.checked)}
                    className="accent-amber-800 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-amber-600" />
                    חיפוש בגימטריא
                  </span>
                </label>
              </div>
            </div>

            {/* Advanced Search Options Panel */}
            {showAdvancedOptions && (
              <div className={`p-4 rounded-2xl border mt-2 flex flex-col gap-3 animate-in fade-in duration-150 ${
                isDark ? 'bg-stone-900/90 border-stone-700' : 'bg-amber-50/90 border-amber-200'
              }`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 border-b pb-2 dark:border-stone-800">
                  <Settings2 className="w-4 h-4 text-amber-600" />
                  <span>הגדרות חיפוש מתקדם (Otzaria Search Engine):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {/* Mode Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-stone-700 dark:text-stone-300">מצב חיפוש:</label>
                    <select
                      value={mode}
                      onChange={e => setMode(e.target.value as any)}
                      className={`border rounded-lg p-1.5 ${
                        isDark ? 'bg-stone-950 border-stone-700 text-stone-200' : 'bg-white border-stone-300 text-stone-800'
                      }`}
                    >
                      <option value="advanced">מתקדם (קידומות/סיומות/מרווחים)</option>
                      <option value="exact">מדויק (ללא התאמות מקורבות)</option>
                      <option value="phrase">ביטוי ("רצף מילים מדויק")</option>
                      <option value="fuzzy">מקורב (שיבושי כתיב קלים/Fuzzy)</option>
                    </select>
                  </div>

                  {/* Slop / Word Distance */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-stone-700 dark:text-stone-300">מרווח מילים (Slop): {slop}</label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={slop}
                      onChange={e => setSlop(Number(e.target.value))}
                      className="accent-amber-800 cursor-pointer"
                    />
                  </div>

                  {/* Proximity Scope */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-stone-700 dark:text-stone-300">טווח הקרבה:</label>
                    <select
                      value={proximityScope}
                      onChange={e => setProximityScope(e.target.value as any)}
                      className={`border rounded-lg p-1.5 ${
                        isDark ? 'bg-stone-950 border-stone-700 text-stone-200' : 'bg-white border-stone-300 text-stone-800'
                      }`}
                    >
                      <option value="wordDistance">מרווח בין מילים</option>
                      <option value="sameParagraph">באותה פסקה</option>
                      <option value="sameSection">תחת אותה כותרת/סעיף</option>
                    </select>
                  </div>

                  {/* Sort By */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-stone-700 dark:text-stone-300">מיון תוצאות:</label>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className={`border rounded-lg p-1.5 ${
                        isDark ? 'bg-stone-950 border-stone-700 text-stone-200' : 'bg-white border-stone-300 text-stone-800'
                      }`}
                    >
                      <option value="catalogue">סדר קטלוגי (לפי ספרים/פרקים)</option>
                      <option value="relevance">לפי רלוונטיות (Relevance Score)</option>
                    </select>
                  </div>

                  {/* Result Grouping */}
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-stone-700 dark:text-stone-300">איחוד תוצאות:</label>
                    <select
                      value={resultGrouping}
                      onChange={e => setResultGrouping(e.target.value as any)}
                      className={`border rounded-lg p-1.5 ${
                        isDark ? 'bg-stone-950 border-stone-700 text-stone-200' : 'bg-white border-stone-300 text-stone-800'
                      }`}
                    >
                      <option value="none">ללא איחוד (רשימה שטוחה)</option>
                      <option value="sameSection">לפי טווח/סעיף</option>
                      <option value="identicalText">טקסט זהה בין ספרים</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className={`pt-2 border-t flex flex-col gap-1.5 ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>חיפושים אחרונים שלך:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.slice(0, 8).map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSearch(undefined, s.query)}
                    className={`px-2.5 py-1 border rounded-lg text-xs font-serif transition-colors flex items-center gap-1 cursor-pointer ${
                      isDark
                        ? 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-200'
                        : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-800'
                    }`}
                  >
                    <span>{s.query}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Searching State */}
        {isSearching && (
          <div className={`p-5 rounded-2xl border shadow-xs flex items-center gap-4 animate-pulse ${
            isDark ? 'bg-stone-900 border-amber-900/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="p-3 bg-amber-800 text-amber-100 rounded-xl">
              <span className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-100 border-t-transparent" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-bold font-serif">
                סורק את המאגר עבור: "{query}"...
              </span>
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        {resultsCount !== null && (
          <div className={`flex items-center justify-between px-5 py-2.5 rounded-2xl border font-serif font-bold text-sm ${
            isDark ? 'bg-stone-900 border-stone-800 text-amber-300' : 'bg-amber-100/70 border-amber-200 text-amber-950'
          }`}>
            <span>
              תוצאות חיפוש עבור "{query}": {resultsCount} מופעים במאגר
            </span>
            <span className={`text-xs font-sans font-normal ${isDark ? 'text-stone-400' : 'text-stone-600'}`}>
              לחץ על תוצאה כדי לפתוח ישירות בקורא הספרים
            </span>
          </div>
        )}

        {/* Results List */}
        <div className="flex flex-col gap-3">
          {results.map((res, i) => (
            <div
              key={i}
              onClick={() => {
                sysLogger.addLog('info', 'Search', `פתיחת ספר מתוצאת חיפוש: "${res.bookTitle}" (שורה ${res.lineIndex})`);
                onOpenBookAtLine(res.bookId, res.bookTitle, res.lineIndex, query);
              }}
              className={`group p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 ${
                isDark
                  ? 'bg-[#211711] border-stone-800 hover:border-amber-700/60'
                  : 'bg-white border-stone-200 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <h3 className={`text-base font-bold font-serif ${
                    isDark ? 'text-stone-100 group-hover:text-amber-300' : 'text-stone-900 group-hover:text-amber-900'
                  }`}>
                    {res.bookTitle}
                  </h3>
                  <span className={`text-xs font-sans ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                    • שורה #{res.lineIndex}
                  </span>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-sans font-medium ${
                  isDark ? 'bg-stone-800 text-amber-300' : 'bg-amber-100 text-amber-900'
                }`}>
                  {res.categoryPath}
                </span>
              </div>

              <p
                className={`text-sm font-serif leading-relaxed p-3 rounded-xl border ${
                  isDark
                    ? 'bg-stone-900/80 border-stone-800 text-stone-200'
                    : 'bg-stone-50 border-stone-200/80 text-stone-800'
                }`}
                dangerouslySetInnerHTML={{ __html: `"${sanitizeSnippetHtml(res.snippet)}"` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
