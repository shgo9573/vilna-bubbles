import React, { useState, useEffect, useMemo } from 'react';
import { CatalogData, BookItem, ReaderSettings, TocNode } from '../types/otzaria';
import { getBookToc } from '../services/api';
import { sysLogger } from '../services/logger';
import { Search, Compass, BookOpen, ArrowRight, CornerDownLeft, Loader2, ListTree } from 'lucide-react';
import { numberToHebrew } from '../utils/gematria';

interface FindRefViewProps {
  catalog: CatalogData | null;
  settings?: ReaderSettings;
  onOpenBook: (bookId: number | string, bookTitle: string, lineIndex?: number) => void;
}

/**
 * Helper to recursively flatten TocNodes for quick filtering
 */
function flattenTocWithLineIndex(nodes: TocNode[]): TocNode[] {
  let result: TocNode[] = [];
  for (const node of nodes) {
    const idx = node.lineIndex ?? node.index;
    if (idx && idx > 0) {
      result.push(node);
    }
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTocWithLineIndex(node.children));
    }
  }
  return result;
}

export const FindRefView: React.FC<FindRefViewProps> = ({ catalog, settings, onOpenBook }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);

  // Real TOC state from database/book
  const [tocNodes, setTocNodes] = useState<TocNode[]>([]);
  const [isLoadingToc, setIsLoadingToc] = useState<boolean>(false);
  const [selectedChapterNode, setSelectedChapterNode] = useState<TocNode | null>(null);
  const [selectedSectionNode, setSelectedSectionNode] = useState<TocNode | null>(null);
  const [tocFilterQuery, setTocFilterQuery] = useState<string>('');

  const isDark = settings?.theme === 'dark';

  // Books list from catalog
  const books = catalog?.books || [];

  // Filter books matching search and selected category filter
  const filteredBooks = useMemo(() => {
    let result = books;

    if (selectedCategory !== 'all') {
      result = result.filter(b => {
        const cat = b.categoryPath || '';
        const t = b.title || '';
        if (selectedCategory === 'תנ"ך') return cat.includes('תנ"ך') || cat.includes('תנך');
        if (selectedCategory === 'משנה') return cat.includes('משנה') && !cat.includes('משנה תורה');
        if (selectedCategory === 'ש"ס') return cat.includes('גמרא') || t.includes('תלמוד בבלי') || t.includes('תלמוד ירושלמי');
        if (selectedCategory === 'רמב"ם') return cat.includes('רמב"ם') || t.includes('משנה תורה');
        if (selectedCategory === 'שולחן ערוך') return cat.includes('שולחן ערוך') || cat.includes('הלכה') || t.includes('טור');
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q)) ||
          b.categoryPath.toLowerCase().includes(q)
      );
    }

    return result;
  }, [books, searchQuery, selectedCategory]);

  const displayedBooks = useMemo(() => {
    return filteredBooks.slice(0, 100);
  }, [filteredBooks]);

  // Load real TOC when selectedBook changes
  useEffect(() => {
    if (!selectedBook) {
      setTocNodes([]);
      setSelectedChapterNode(null);
      setSelectedSectionNode(null);
      return;
    }

    setIsLoadingToc(true);
    setTocFilterQuery('');

    getBookToc(selectedBook.id)
      .then(res => {
        const fetchedToc = res.toc || [];
        setTocNodes(fetchedToc);
        if (fetchedToc.length > 0) {
          setSelectedChapterNode(fetchedToc[0]);
          if (fetchedToc[0].children && fetchedToc[0].children.length > 0) {
            setSelectedSectionNode(fetchedToc[0].children[0]);
          } else {
            setSelectedSectionNode(null);
          }
        } else {
          setSelectedChapterNode(null);
          setSelectedSectionNode(null);
        }
      })
      .catch(err => {
        console.warn('Failed to load TOC for FindRefView:', err);
        setTocNodes([]);
      })
      .finally(() => {
        setIsLoadingToc(false);
      });
  }, [selectedBook?.id]);

  // Handle Chapter node click
  const handleSelectChapterNode = (node: TocNode) => {
    setSelectedChapterNode(node);
    if (node.children && node.children.length > 0) {
      setSelectedSectionNode(node.children[0]);
    } else {
      setSelectedSectionNode(null);
    }
  };

  // Open book at target line
  const handleOpenAtLine = (targetLine?: number, title?: string) => {
    if (!selectedBook) return;
    const finalLine = targetLine || selectedSectionNode?.lineIndex || selectedSectionNode?.index || selectedChapterNode?.lineIndex || selectedChapterNode?.index || 1;
    sysLogger.addLog(
      'info',
      'FindRef',
      `איתור מקור: "${selectedBook.title}" -> ${title || selectedSectionNode?.title || selectedChapterNode?.title || 'תחילה'} (שורה ${finalLine})`
    );
    onOpenBook(selectedBook.id, selectedBook.title, finalLine);
  };

  // Filtered TOC nodes when search text is entered in TOC search box
  const filteredTocList = useMemo(() => {
    if (!tocFilterQuery.trim() || tocNodes.length === 0) return [];
    const q = tocFilterQuery.trim().toLowerCase();
    const flat = flattenTocWithLineIndex(tocNodes);
    return flat.filter(n => n.title.toLowerCase().includes(q));
  }, [tocFilterQuery, tocNodes]);

  return (
    <div className={`flex-1 flex flex-col h-full select-none overflow-hidden ${
      isDark ? 'bg-[#18110D] text-stone-100' : 'bg-[#FAF8F5] text-stone-900'
    }`}>
      {/* Top Banner */}
      <div className={`px-6 py-3.5 flex items-center justify-between border-b shadow-xs ${
        isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
            isDark ? 'bg-amber-950 text-amber-300' : 'bg-amber-100/80 text-amber-900'
          }`}>
            <Compass className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className={`text-base font-bold font-serif ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
              איתור מקור מהיר מתוך ראשי הפרקים
            </h2>
            <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              {selectedBook
                ? `ספר: ${selectedBook.title} ${selectedChapterNode ? `| ${selectedChapterNode.title}` : ''} ${selectedSectionNode ? `-> ${selectedSectionNode.title}` : ''}`
                : 'בחר ספר לקבלת תוכן העניינים וראשי הפרקים האמיתיים'}
            </p>
          </div>
        </div>

        {selectedBook && (
          <button
            onClick={() => handleOpenAtLine()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <span>פתח ספר במיקום הנבחר</span>
            <CornerDownLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Container: 2 Columns */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Right Column: Book Selector with Search */}
        <div className={`w-full md:w-80 border-l flex flex-col p-4 gap-3 shrink-0 ${
          isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
        }`}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="חפש ספר (למשל: בראשית, ברכות, שולחן ערוך)..."
              className={`w-full rounded-lg pr-9 pl-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-700/50 ${
                isDark
                  ? 'bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-500'
                  : 'bg-stone-50 border border-stone-300 text-stone-900 placeholder-stone-400'
              }`}
              autoFocus
            />
            <Search className={`w-4 h-4 absolute right-3 top-2.5 ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'תנ"ך', label: 'תנ"ך' },
              { id: 'משנה', label: 'משנה' },
              { id: 'ש"ס', label: 'ש"ס' },
              { id: 'רמב"ם', label: 'רמב"ם' },
              { id: 'שולחן ערוך', label: 'הלכה' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-800 text-white font-bold'
                    : isDark
                    ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className={`flex items-center justify-between text-[11px] font-medium px-1 ${
            isDark ? 'text-stone-400' : 'text-stone-500'
          }`}>
            <span>רשימת ספרים ({filteredBooks.length})</span>
            {filteredBooks.length > 100 && (
              <span className="text-amber-500">מציג 100 ראשונים</span>
            )}
          </div>

          {/* Books List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {displayedBooks.map(book => {
              const isSelected = selectedBook?.id === book.id;
              return (
                <button
                  key={book.id}
                  onClick={() => setSelectedBook(book)}
                  className={`w-full text-right px-3 py-2.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-800 text-white font-bold shadow-xs'
                      : isDark
                      ? 'hover:bg-stone-800 text-stone-200'
                      : 'hover:bg-amber-50 text-stone-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen
                      className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-200' : isDark ? 'text-stone-500' : 'text-stone-400'}`}
                    />
                    <span className="truncate">{book.title}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-amber-700/60 text-amber-100'
                        : isDark
                        ? 'bg-stone-800 text-stone-400'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {book.heEra || book.categoryPath.split('/')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Left Column: Real TOC & Chapters View */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {selectedBook ? (
            <>
              {/* Selected Book Header Card */}
              <div className={`border rounded-2xl p-5 shadow-xs flex items-center justify-between ${
                isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
              }`}>
                <div>
                  <div className={`text-xs font-semibold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                    {selectedBook.categoryPath}
                  </div>
                  <h3 className={`text-xl font-bold font-serif ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                    {selectedBook.title}
                  </h3>
                  {selectedBook.author && (
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                      מחבר: {selectedBook.author} {selectedBook.heEra ? `· תקופה: ${selectedBook.heEra}` : ''}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleOpenAtLine()}
                  className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>פתח ספר זה</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>

              {/* TOC Filter Search Field */}
              <div className="relative">
                <input
                  type="text"
                  value={tocFilterQuery}
                  onChange={e => setTocFilterQuery(e.target.value)}
                  placeholder={`סנן ראשי פרקים ב-${selectedBook.title} (למשל: פרק ג, הלכות שבת, סימן קנט)...`}
                  className={`w-full rounded-xl pr-9 pl-3 py-2.5 text-xs font-serif focus:outline-none focus:ring-2 focus:ring-amber-700/50 ${
                    isDark
                      ? 'bg-stone-900 border border-stone-700 text-stone-100 placeholder-stone-500'
                      : 'bg-stone-50 border border-stone-300 text-stone-900 placeholder-stone-400'
                  }`}
                />
                <Search className={`w-4 h-4 absolute right-3 top-3 ${isDark ? 'text-stone-500' : 'text-stone-400'}`} />
              </div>

              {/* Loading TOC Indicator */}
              {isLoadingToc ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-2" />
                  <span className="text-xs font-serif font-bold text-stone-500">
                    טוען את ראשי הפרקים ותוכן העניינים של "{selectedBook.title}"...
                  </span>
                </div>
              ) : filteredTocList.length > 0 ? (
                /* Filtered Search Results from TOC */
                <div className={`border rounded-2xl p-5 shadow-xs flex flex-col gap-2 ${
                  isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
                }`}>
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                    תוצאות סינון בראשי הפרקים ({filteredTocList.length}):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                    {filteredTocList.map((node, i) => {
                      const idx = node.lineIndex || node.index || 1;
                      return (
                        <button
                          key={i}
                          onClick={() => handleOpenAtLine(idx, node.title)}
                          className={`text-right p-3 rounded-xl border text-xs font-serif font-bold transition-all cursor-pointer flex items-center justify-between ${
                            isDark
                              ? 'bg-stone-900 border-stone-700 hover:border-amber-600 text-stone-200'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-400 text-stone-800'
                          }`}
                        >
                          <span>{node.title}</span>
                          <span className="text-[10px] text-stone-400 font-sans font-normal">
                            שורה #{idx}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : tocNodes.length > 0 ? (
                /* Display REAL TOC Headings & Sections */
                <div className="flex flex-col gap-6">
                  {/* Level 1: Primary Chapter / Section Headings */}
                  <div className={`border rounded-2xl p-5 shadow-xs ${
                    isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
                  }`}>
                    <div className={`flex items-center justify-between mb-3 border-b pb-2 ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
                      <h4 className={`text-sm font-bold font-serif flex items-center gap-1.5 ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                        <ListTree className="w-4 h-4 text-amber-600" />
                        <span>ראשי פרקים וחטיבות ראשיות</span>
                      </h4>
                      {selectedChapterNode && (
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          נבחר: {selectedChapterNode.title}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                      {tocNodes.map((node, idx) => {
                        const isSelected = selectedChapterNode?.title === node.title;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectChapterNode(node)}
                            className={`p-3 rounded-xl text-xs font-serif font-bold text-right transition-all border cursor-pointer flex flex-col justify-between gap-1 ${
                              isSelected
                                ? 'bg-amber-800 border-amber-800 text-white shadow-xs scale-[1.02]'
                                : isDark
                                ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
                                : 'bg-stone-50 hover:bg-amber-100/60 border-stone-200 text-stone-800'
                            }`}
                          >
                            <span className="line-clamp-2">{node.title}</span>
                            {node.children && node.children.length > 0 && (
                              <span className={`text-[10px] font-sans font-normal ${isSelected ? 'text-amber-200' : 'text-stone-400'}`}>
                                {node.children.length} תת-סעיפים
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Level 2: Sub-sections / Verses / Halachot */}
                  {selectedChapterNode && selectedChapterNode.children && selectedChapterNode.children.length > 0 && (
                    <div className={`border rounded-2xl p-5 shadow-xs ${
                      isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
                    }`}>
                      <div className={`flex items-center justify-between mb-3 border-b pb-2 ${isDark ? 'border-stone-800' : 'border-stone-100'}`}>
                        <h4 className={`text-sm font-bold font-serif ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                          תת-סעיפים / פרקים בתוך "{selectedChapterNode.title}"
                        </h4>
                        {selectedSectionNode && (
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            נבחר: {selectedSectionNode.title}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                        {selectedChapterNode.children.map((subNode, sIdx) => {
                          const isSelected = selectedSectionNode?.title === subNode.title;
                          const subIdx = subNode.lineIndex || subNode.index || 1;
                          return (
                            <button
                              key={sIdx}
                              onClick={() => {
                                setSelectedSectionNode(subNode);
                                handleOpenAtLine(subIdx, subNode.title);
                              }}
                              className={`p-2.5 rounded-xl text-xs font-serif font-bold text-center transition-all border cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? 'bg-amber-800 border-amber-800 text-white shadow-xs scale-105'
                                  : isDark
                                  ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-200'
                                  : 'bg-stone-50 hover:bg-amber-100/60 border-stone-200 text-stone-800'
                              }`}
                            >
                              <span className="truncate w-full">{subNode.title}</span>
                              <span className={`text-[9px] font-sans font-normal ${isSelected ? 'text-amber-200' : 'text-stone-400'}`}>
                                שורה #{subIdx}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Launch Button */}
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      onClick={() => handleOpenAtLine()}
                      className="px-6 py-3 bg-amber-800 hover:bg-amber-900 text-white rounded-2xl text-sm font-bold shadow-md flex items-center gap-2.5 transition-transform active:scale-95 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>
                        פתח את {selectedBook.title}{' '}
                        {selectedSectionNode
                          ? `(${selectedSectionNode.title})`
                          : selectedChapterNode
                          ? `(${selectedChapterNode.title})`
                          : ''}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Fallback for books without pre-generated TOC tree */
                <div className={`border rounded-2xl p-6 shadow-xs flex flex-col items-center text-center gap-4 ${
                  isDark ? 'bg-[#211711] border-stone-800' : 'bg-white border-stone-200'
                }`}>
                  <BookOpen className="w-10 h-10 text-amber-600" />
                  <div>
                    <h4 className="text-base font-bold font-serif mb-1">
                      פתח את הספר "{selectedBook.title}"
                    </h4>
                    <p className="text-xs text-stone-500 max-w-md mx-auto">
                      ניתן לפתוח ספר זה ישירות וקורא הספרים יציג את הניווט המלא ואפשרויות הלימוד.
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenAtLine(1, 'תחילת הספר')}
                    className="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                  >
                    פתח את הספר מתחילתו
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Compass className={`w-12 h-12 mb-3 ${isDark ? 'text-stone-600' : 'text-stone-300'}`} />
              <h3 className={`text-base font-bold font-serif mb-1 ${isDark ? 'text-stone-300' : 'text-stone-600'}`}>
                בחר ספר מהרשימה בצד ימין
              </h3>
              <p className={`text-xs max-w-sm ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
                לאחר בחירת הספר ייטענו ראשי הפרקים ותוכן העניינים האמיתיים של הספר למעבר ישיר ומדויק.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
