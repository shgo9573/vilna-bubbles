import React, { useState, useMemo, useRef } from 'react';
import { CatalogData, BookItem, CategoryNode, ReaderSettings } from '../types/otzaria';
import { getDailyStudySchedule, findMatchingBookForDailyStudy, DailyStudyItem } from '../utils/hebrewCalendar';
import { CustomStudyModal } from './CustomStudyModal';
import { sysLogger } from '../services/logger';
import {
  Search,
  Folder,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  BookMarked,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Layers
} from 'lucide-react';

interface LibraryViewProps {
  catalog: CatalogData | null;
  settings?: ReaderSettings;
  onOpenBook: (bookId: number | string, bookTitle: string, lineIndex?: number, initialSearch?: string) => void;
  isLoading: boolean;
  onUpdateSettings?: (newSettings: Partial<ReaderSettings>) => void;
  onOpenSettings?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  catalog,
  settings,
  onOpenBook,
  isLoading,
  onUpdateSettings,
  onOpenSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [previewBook, setPreviewBook] = useState<BookItem | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const bannerScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollBanner = (direction: 'left' | 'right') => {
    if (bannerScrollRef.current) {
      bannerScrollRef.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth'
      });
    }
  };

  const isDark = settings?.theme === 'dark';
  const isSepia = settings?.theme === 'sepia';
  const viewMode = settings?.libraryViewMode || 'grid';
  const showDailyBanner = settings?.showDailyStudy !== false;

  // Only use official catalog from DB
  const books = catalog?.books || [];
  const categories = catalog?.categories || [];

  // All Daily studies (calculated based on tracks & custom tracks)
  const dailyStudyList = useMemo(() => {
    return getDailyStudySchedule(settings?.dailyStudyTracks, {
      halachaYomitScheduleType: settings?.halachaYomitScheduleType,
      chofetzChaimScheduleType: settings?.chofetzChaimScheduleType,
      customDailyStudies: settings?.customDailyStudies
    });
  }, [settings?.dailyStudyTracks, settings?.halachaYomitScheduleType, settings?.chofetzChaimScheduleType, settings?.customDailyStudies]);

  // Handle opening a daily study item directly in reader
  const handleOpenDailyStudy = (item: DailyStudyItem) => {
    const matched = findMatchingBookForDailyStudy(item, books);

    // Extract pure navigation target without book title redundancy
    let navTarget = item.portion;
    if (item.type === 'daf_yomi') {
      // e.g. "בכורות דף יב" -> "דף יב"
      const dafMatch = item.portion.match(/דף\s+[א-ת]+(?:\s*[.:])?/);
      if (dafMatch) {
        navTarget = dafMatch[0].trim();
      }
    } else if (item.type === 'chofetz_chaim') {
      // e.g. "הלכות לשון הרע: כלל ה׳, סעיפים א׳-ב׳" -> "כלל ה"
      const klalMatch = item.portion.match(/כלל\s+[א-ת]+/);
      const shaarMatch = item.portion.match(/שער\s+[א-ת]+(?:\s+פרק\s+[א-ת]+)?/);
      if (klalMatch) {
        navTarget = klalMatch[0].trim();
      } else if (shaarMatch) {
        navTarget = shaarMatch[0].trim();
      }
    } else if (item.type === 'halacha_yomit') {
      const simanMatch = item.portion.match(/סימן\s+[א-ת]+/);
      if (simanMatch) {
        navTarget = simanMatch[0].trim();
      }
    }

    if (matched) {
      sysLogger.addLog('info', 'DailyStudy', `פתיחת לימוד יומי "${item.title}" - ספר: ${matched.title}, יעד ניווט: "${navTarget}"`);
      onOpenBook(matched.id, matched.title, undefined, navTarget);
    } else {
      // If book not explicitly found in catalog list, try by item.bookTitle
      onOpenBook(item.bookId || item.bookTitle, item.bookTitle, undefined, navTarget);
    }
  };

  // Helper to recursively collect books from a node and its descendants
  const collectBooksFromNode = (node: CategoryNode): BookItem[] => {
    let result: BookItem[] = [...(node.books || [])];
    if (node.children) {
      for (const child of node.children) {
        result = result.concat(collectBooksFromNode(child));
      }
    }
    return result;
  };

  // Find currently active CategoryNode
  const currentActiveNode = useMemo<CategoryNode | null>(() => {
    if (currentPath.length === 0) return null;
    let currentNodes: CategoryNode[] = categories;
    let foundNode: CategoryNode | null = null;
    for (const step of currentPath) {
      const match = currentNodes.find(n => n.name === step);
      if (match) {
        foundNode = match;
        currentNodes = match.children || [];
      } else {
        return null;
      }
    }
    return foundNode;
  }, [categories, currentPath]);

  // Current subcategories if browsing by path
  const currentSubCategories = useMemo(() => {
    if (searchQuery.trim()) return [];
    if (currentPath.length === 0) {
      return categories;
    }
    return currentActiveNode?.children || [];
  }, [categories, currentPath, searchQuery, currentActiveNode]);

  // Filter books matching search or path
  const filteredBooks = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return books.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q)) ||
          b.categoryPath.toLowerCase().includes(q)
      );
    }

    if (currentPath.length === 0) {
      return [];
    }

    if (currentActiveNode) {
      if (currentActiveNode.books && currentActiveNode.books.length > 0) {
        return currentActiveNode.books;
      }
      return collectBooksFromNode(currentActiveNode);
    }

    const currentCategoryPathStr = currentPath.join('/');
    return books.filter(b => {
      const norm = b.categoryPath.replace(/\s*\/\s*/g, '/').trim();
      return norm === currentCategoryPathStr || norm.startsWith(currentCategoryPathStr + '/');
    });
  }, [books, searchQuery, currentPath, currentActiveNode]);

  if (isLoading && books.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${isDark ? 'bg-[#18110D] text-stone-300' : 'bg-[#FAF8F5] text-stone-700'}`}>
        <div className="animate-spin rounded-full h-9 w-9 border-3 border-amber-800 border-t-transparent mb-3" />
        <p className="text-sm font-serif font-bold">
          טוען את ספריית אוצריה...
        </p>
      </div>
    );
  }

  const navigateToCategory = (catName: string) => {
    const newPath = [...currentPath, catName];
    setCurrentPath(newPath);
    setSearchQuery('');
    sysLogger.addLog('info', 'Library', `ניווט לקטגוריה: "${newPath.join(' / ')}"`);
  };

  const navigateBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
      sysLogger.addLog('info', 'Library', 'חזרה לדף ראשי בספרייה');
    } else {
      const newPath = currentPath.slice(0, index + 1);
      setCurrentPath(newPath);
      sysLogger.addLog('info', 'Library', `ניווט בנתיב: "${newPath.join(' / ')}"`);
    }
    setSearchQuery('');
  };

  return (
    <div className={`flex-1 flex flex-col h-full select-none overflow-hidden ${
      isDark ? 'bg-[#18110D] text-stone-100' : 'bg-[#FAF8F5] text-stone-900'
    }`}>
      {/* Top Search & Breadcrumb Bar */}
      <div className={`px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b shadow-xs ${
        isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
      }`}>
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => navigateBreadcrumb(-1)}
            className={`font-semibold hover:text-amber-600 transition-colors flex items-center gap-1 cursor-pointer ${
              currentPath.length === 0
                ? isDark ? 'text-amber-400 font-bold' : 'text-amber-900 font-bold'
                : isDark ? 'text-stone-400' : 'text-stone-500'
            }`}
          >
            <span>ספרייה</span>
          </button>

          {currentPath.map((segment, idx) => (
            <React.Fragment key={idx}>
              <ChevronLeft className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-stone-600' : 'text-stone-400'}`} />
              <button
                onClick={() => navigateBreadcrumb(idx)}
                className={`truncate max-w-[140px] hover:text-amber-600 transition-colors cursor-pointer ${
                  idx === currentPath.length - 1
                    ? isDark ? 'text-amber-300 font-bold' : 'text-amber-900 font-bold'
                    : isDark ? 'text-stone-400 font-medium' : 'text-stone-600 font-medium'
                }`}
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Library Quick Filter Box */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="איתור כותרת או ספר..."
            className={`w-full rounded-lg pr-9 pl-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-700/50 ${
              isDark
                ? 'bg-stone-900/90 border border-stone-700 text-stone-100 placeholder-stone-500'
                : 'bg-stone-50 border border-stone-300 text-stone-900 placeholder-stone-400'
            }`}
          />
          <Search className={`w-4 h-4 absolute right-3 top-2 pointer-events-none ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute left-2.5 top-1.5 text-[10px] px-1 rounded cursor-pointer ${
                isDark ? 'text-stone-400 hover:text-stone-200 bg-stone-800' : 'text-stone-400 hover:text-stone-800 bg-stone-200/60'
              }`}
            >
              נקה
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Grid / List View & Preview Pane */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        <div className="flex-1 overflow-y-auto pr-1">
          {/* Compact Single-Row Daily Studies Banner - Scrolls up naturally with the library */}
          {!searchQuery && currentPath.length === 0 && showDailyBanner && dailyStudyList.length > 0 && (
            <div className={`mb-5 p-2 rounded-xl border flex items-center gap-2 shadow-2xs ${
              isDark
                ? 'bg-[#201610] border-amber-900/40 text-stone-200'
                : 'bg-gradient-to-l from-amber-100/70 via-amber-50/50 to-white border-amber-200/90 text-stone-900'
            }`}>
              {/* Leading Label & Actions */}
              <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-amber-800/15">
                <div className="w-6 h-6 rounded-lg bg-amber-800 text-amber-100 flex items-center justify-center font-bold shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-amber-200" />
                </div>
                <span className={`text-xs font-bold font-serif hidden sm:inline ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
                  לימוד יומי
                </span>

                <button
                  onClick={() => setIsCustomModalOpen(true)}
                  className="p-1 text-amber-800 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 hover:bg-amber-800/10 rounded-md transition-colors cursor-pointer"
                  title="הוסף לימוד יומי מותאם אישית"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark
                        ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                    }`}
                    title="הגדרות סדרי לימוד"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Scroll Right Button */}
              <button
                onClick={() => handleScrollBanner('right')}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-amber-100 text-stone-600'
                }`}
                title="גלול ימינה"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Single-row Horizontal Scrollable Track Capsules */}
              <div
                ref={bannerScrollRef}
                className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 select-none"
              >
                {dailyStudyList.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shrink-0 text-xs transition-all shadow-2xs hover:shadow-xs ${
                      isDark
                        ? 'bg-stone-900/90 border-stone-800 hover:border-amber-700/60'
                        : 'bg-white/95 border-amber-200/70 hover:border-amber-400'
                    }`}
                  >
                    {/* Badge */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.isCustom
                        ? isDark ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-purple-100 text-purple-900'
                        : isDark ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {item.badge || item.title}
                    </span>

                    {/* Title & Portion in single compact line */}
                    <div className="flex items-center gap-1 font-serif whitespace-nowrap">
                      <span className={`font-bold ${isDark ? 'text-stone-200' : 'text-stone-900'}`}>
                        {item.title}:
                      </span>
                      <span className={`font-semibold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                        {item.portion}
                      </span>
                    </div>

                    {/* Direct Open Button */}
                    <button
                      onClick={() => handleOpenDailyStudy(item)}
                      className="mr-1 px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded text-xs font-semibold shadow-2xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                      title={`פתח את ${item.bookTitle}`}
                    >
                      <span>פתח</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Scroll Left Button */}
              <button
                onClick={() => handleScrollBanner('left')}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-amber-100 text-stone-600'
                }`}
                title="גלול שמאלה"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Subcategories */}
          {currentSubCategories.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                <Folder className="w-3.5 h-3.5 text-amber-600" />
                <span>מדורי הספרייה</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {currentSubCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => navigateToCategory(cat.name)}
                    className={`p-3 border rounded-xl text-right flex flex-col justify-between h-24 transition-all duration-150 shadow-xs hover:shadow-sm group cursor-pointer ${
                      isDark
                        ? 'bg-[#211711] hover:bg-[#2D1F17] border-stone-800 hover:border-amber-700/60'
                        : 'bg-white hover:bg-amber-50/60 border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isDark ? 'bg-amber-950 text-amber-300 group-hover:bg-amber-800 group-hover:text-white' : 'bg-amber-100/70 text-amber-900 group-hover:bg-amber-800 group-hover:text-white'
                      }`}>
                        <Folder className="w-4 h-4" />
                      </div>
                      <ChevronLeft className={`w-4 h-4 transition-colors ${isDark ? 'text-stone-600 group-hover:text-amber-400' : 'text-stone-400 group-hover:text-amber-800'}`} />
                    </div>
                    <div>
                      <div className={`text-xs font-bold font-serif truncate ${
                        isDark ? 'text-stone-100 group-hover:text-amber-200' : 'text-stone-900 group-hover:text-amber-950'
                      }`}>
                        {cat.name}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                        קטגוריה
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Books List or Grid */}
          {(currentPath.length > 0 || searchQuery.trim() !== '') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {searchQuery ? `תוצאות סינון (${filteredBooks.length})` : `ספרים במדור זה (${filteredBooks.length})`}
                  </span>
                </h3>
              </div>

              {filteredBooks.length === 0 ? (
                <div className={`text-center py-12 border rounded-xl p-8 ${
                  isDark ? 'bg-[#211711] border-stone-800 text-stone-400' : 'bg-white border-stone-200 text-stone-700'
                }`}>
                  <BookOpen className={`w-10 h-10 mx-auto mb-2 ${isDark ? 'text-stone-600' : 'text-stone-300'}`} />
                  <p className="text-sm font-serif font-bold">לא נמצאו ספרים</p>
                  <p className="text-xs text-stone-500 mt-1">נסה לשנות את מילת החיפוש או לבחור קטגוריה אחרת</p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="flex flex-col gap-2">
                  {filteredBooks.map(book => {
                    const isSelected = previewBook?.id === book.id;
                    return (
                      <div
                        key={`book-${book.id}-${book.title}`}
                        onClick={() => setPreviewBook(book)}
                        onDoubleClick={() => onOpenBook(book.id, book.title)}
                        className={`p-3 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? isDark
                              ? 'border-amber-600 ring-2 ring-amber-600/30 bg-amber-950/40'
                              : 'border-amber-800 ring-2 ring-amber-800/10 bg-amber-50/40'
                            : isDark
                            ? 'bg-[#211711] border-stone-800 hover:border-amber-700/60'
                            : 'bg-white border-stone-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <BookMarked className="w-4 h-4 text-amber-600 shrink-0" />
                          <div className="truncate">
                            <span className={`text-sm font-bold font-serif ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                              {book.title}
                            </span>
                            {book.author && (
                              <span className={`text-xs mr-2 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                ({book.author})
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onOpenBook(book.id, book.title);
                          }}
                          className="px-3 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-md text-xs font-semibold shrink-0 cursor-pointer"
                        >
                          פתח
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredBooks.map(book => {
                    const isSelected = previewBook?.id === book.id;
                    return (
                      <div
                        key={`book-${book.id}-${book.title}`}
                        onClick={() => setPreviewBook(book)}
                        onDoubleClick={() => onOpenBook(book.id, book.title)}
                        className={`p-3.5 border rounded-xl flex flex-col justify-between gap-3 cursor-pointer transition-all duration-150 shadow-xs hover:shadow-sm ${
                          isSelected
                            ? isDark
                              ? 'border-amber-600 ring-2 ring-amber-600/30 bg-amber-950/40'
                              : 'border-amber-800 ring-2 ring-amber-800/10 bg-amber-50/20'
                            : isDark
                            ? 'bg-[#211711] border-stone-800 hover:border-amber-700/60'
                            : 'bg-white border-stone-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 truncate">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isDark ? 'bg-amber-950 text-amber-300' : 'bg-amber-100/60 text-amber-900'
                            }`}>
                              <BookMarked className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="truncate">
                              <h4 className={`text-sm font-bold font-serif truncate ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                                {book.title}
                              </h4>
                              <p className={`text-[11px] truncate ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                                {book.author || book.categoryPath}
                              </p>
                            </div>
                          </div>

                          {book.heEra && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
                              isDark ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {book.heEra}
                            </span>
                          )}
                        </div>

                        {/* Action footer */}
                        <div className={`flex items-center justify-between pt-2 border-t text-xs ${
                          isDark ? 'border-stone-800/80' : 'border-stone-100'
                        }`}>
                          <span className={`text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                            {book.hasLinks ? 'כולל מפרשים' : 'טקסט מלא'}
                          </span>

                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onOpenBook(book.id, book.title);
                            }}
                            className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>פתח</span>
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Preview Panel */}
        {previewBook && (
          <div className={`w-72 border rounded-xl p-5 shadow-xs flex flex-col justify-between shrink-0 h-fit ${
            isDark ? 'bg-[#211711] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div>
              <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
                <span className={`text-[11px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                  פרטי הספר
                </span>
                <button
                  onClick={() => setPreviewBook(null)}
                  className={`text-xs cursor-pointer ${isDark ? 'text-stone-500 hover:text-stone-300' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  ✕
                </button>
              </div>

              <div className="mt-4">
                <h4 className="text-lg font-bold font-serif leading-snug">
                  {previewBook.title}
                </h4>
                {previewBook.author && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                    <strong>מחבר:</strong> {previewBook.author}
                  </p>
                )}
                <p className={`text-xs mt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                  <strong>קטגוריה:</strong> {previewBook.categoryPath}
                </p>
                {previewBook.heEra && (
                  <p className={`text-xs mt-1 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    <strong>תקופת הדור:</strong> {previewBook.heEra}
                  </p>
                )}
              </div>

              <div className={`mt-4 p-3 border rounded-lg text-xs leading-relaxed font-serif ${
                isDark ? 'bg-stone-900/60 border-stone-800 text-stone-300' : 'bg-stone-50 border-stone-200 text-stone-600'
              }`}>
                ספר יסוד בארון הספרים היהודי מתוך ספריית אוצריה. כולל ניווט בראשי פרקים, חלוקה מדויקת לסעיפים וחיבור למפרשים מקבילים.
              </div>
            </div>

            <div className={`mt-6 pt-4 border-t flex flex-col gap-2 ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
              <button
                onClick={() => onOpenBook(previewBook.id, previewBook.title)}
                className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>פתח ספר בלשונית חדשה</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Study Track Creator Modal */}
      {settings && onUpdateSettings && (
        <CustomStudyModal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          settings={settings}
          catalogBooks={books}
          onUpdateSettings={onUpdateSettings}
        />
      )}
    </div>
  );
};
