import React, { useState, useEffect } from 'react';
import { 
  TabItem, 
  ReaderSettings, 
  DEFAULT_READER_SETTINGS, 
  CatalogData, 
  BookmarkItem,
  BookItem 
} from './types/otzaria';
import { CANONICAL_BOOKS, CANONICAL_CATEGORIES } from './data/otzariaLibraryData';
import { Header } from './components/Header';
import { Sidebar, MainNavScreen } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { BookReader } from './components/BookReader';
import { TzuratHaDafTabView } from './components/TzuratHaDafTabView';
import { SearchView } from './components/SearchView';
import { FindRefView } from './components/FindRefView';
import { BookmarksView } from './components/BookmarksView';
import { ToolsPanel } from './components/ToolsPanel';
import { SettingsModal } from './components/SettingsModal';
import { 
  subscribeToBookmarks, 
  addBookmarkToCloud, 
  removeBookmarkFromCloud,
  subscribeToUserSettings,
  saveUserSettingsToCloud
} from './services/userService';

export default function App() {
  // ── ניהול טאבים (כולל צורת הדף, ספרייה, ספרים פתוחים) ──
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab_tzurat_hadaf_default',
      type: 'tzurat_hadaf',
      title: 'צורת הדף - ברכות (דף ב ע״א)',
      masechta: 'ברכות',
      dafNum: 2,
      amud: 'a'
    },
    {
      id: 'tab_library_default',
      type: 'library',
      title: 'ספרייה'
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_tzurat_hadaf_default');

  // ── ניהול מסך ראשי וסרגל צד ──
  const [activeScreen, setActiveScreen] = useState<MainNavScreen>('reading');

  // ── הגדרות משתמש ──
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem('otzaria_reader_settings');
      if (saved) return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_READER_SETTINGS;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── סימניות וספרייה ──
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogData>({
    categories: CANONICAL_CATEGORIES,
    books: CANONICAL_BOOKS,
    totalBooksCount: CANONICAL_BOOKS.length,
    categoriesCount: CANONICAL_CATEGORIES.length
  });
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // סנכרון הגדרות וסימניות מול שירות המשתמש
  useEffect(() => {
    const unsubBookmarks = subscribeToBookmarks(bList => setBookmarks(bList));
    const unsubSettings = subscribeToUserSettings(s => {
      if (s) {
        setSettings(prev => ({ ...prev, ...s }));
        try {
          localStorage.setItem('otzaria_reader_settings', JSON.stringify({ ...settings, ...s }));
        } catch {}
      }
    });

    return () => {
      unsubBookmarks();
      unsubSettings();
    };
  }, []);

  // טעינת עץ ספרייה מלא מהשרת (SQLite / Local)
  useEffect(() => {
    let isMounted = true;
    setIsCatalogLoading(true);

    fetch('/api/library/tree')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data && Array.isArray(data.books) && data.books.length > 0) {
          setCatalog({
            categories: data.categories || CANONICAL_CATEGORIES,
            books: data.books,
            totalBooksCount: data.totalBooksCount || data.books.length,
            categoriesCount: data.categoriesCount || (data.categories?.length || 0)
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsCatalogLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // עדכון הגדרות
  const handleUpdateSettings = (newSettings: Partial<ReaderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem('otzaria_reader_settings', JSON.stringify(updated));
    } catch {}
    saveUserSettingsToCloud(newSettings);
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_READER_SETTINGS);
    try {
      localStorage.setItem('otzaria_reader_settings', JSON.stringify(DEFAULT_READER_SETTINGS));
    } catch {}
    saveUserSettingsToCloud(DEFAULT_READER_SETTINGS);
  };

  // ── ניהול טאבים ──
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    const target = tabs.find(t => t.id === id);
    if (target?.type === 'library') {
      setActiveScreen('library');
    } else if (target?.type === 'search') {
      setActiveScreen('search');
    } else if (target?.type === 'find') {
      setActiveScreen('find');
    } else if (target?.type === 'tools') {
      setActiveScreen('tools');
    } else {
      setActiveScreen('reading');
    }
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleNewTab = () => {
    const newId = `tab_${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      type: 'tzurat_hadaf',
      title: 'צורת הדף - ברכות (דף ב ע״א)',
      masechta: 'ברכות',
      dafNum: 2,
      amud: 'a'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setActiveScreen('reading');
  };

  // פתיחת ספר בטאב חדש
  const handleOpenBook = (
    bookId: number | string, 
    bookTitle: string, 
    lineIndex?: number, 
    initialSearch?: string
  ) => {
    const existing = tabs.find(t => t.type === 'book' && String(t.bookId) === String(bookId));
    if (existing) {
      setActiveTabId(existing.id);
      setActiveScreen('reading');
      return;
    }

    const newId = `tab_book_${bookId}_${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      type: 'book',
      title: bookTitle,
      bookId,
      bookTitle,
      initialLine: lineIndex,
      initialSearch
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setActiveScreen('reading');
  };

  // פתיחת צורת הדף בטאב
  const handleOpenTzuratHaDafTab = (bookTitle: string, dafNum?: number, amud?: 'a' | 'b') => {
    const dNum = dafNum || 2;
    const aMud = amud || 'a';
    const newId = `tab_tzurat_hadaf_${Date.now()}`;
    const newTab: TabItem = {
      id: newId,
      type: 'tzurat_hadaf',
      title: `צורת הדף - ${bookTitle}`,
      bookTitle,
      masechta: bookTitle,
      dafNum: dNum,
      amud: aMud
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setActiveScreen('reading');
  };

  // מעבר מסכים מסרגל הצד
  const handleSelectScreen = (screen: MainNavScreen) => {
    setActiveScreen(screen);

    if (screen === 'library') {
      const libTab = tabs.find(t => t.type === 'library');
      if (libTab) {
        setActiveTabId(libTab.id);
      } else {
        const id = `tab_library_${Date.now()}`;
        setTabs(prev => [...prev, { id, type: 'library', title: 'ספרייה' }]);
        setActiveTabId(id);
      }
    } else if (screen === 'search') {
      const searchTab = tabs.find(t => t.type === 'search');
      if (searchTab) {
        setActiveTabId(searchTab.id);
      } else {
        const id = `tab_search_${Date.now()}`;
        setTabs(prev => [...prev, { id, type: 'search', title: 'חיפוש' }]);
        setActiveTabId(id);
      }
    } else if (screen === 'find') {
      const findTab = tabs.find(t => t.type === 'find');
      if (findTab) {
        setActiveTabId(findTab.id);
      } else {
        const id = `tab_find_${Date.now()}`;
        setTabs(prev => [...prev, { id, type: 'find', title: 'איתור' }]);
        setActiveTabId(id);
      }
    } else if (screen === 'tools') {
      const toolsTab = tabs.find(t => t.type === 'tools');
      if (toolsTab) {
        setActiveTabId(toolsTab.id);
      } else {
        const id = `tab_tools_${Date.now()}`;
        setTabs(prev => [...prev, { id, type: 'tools', title: 'כלים' }]);
        setActiveTabId(id);
      }
    } else if (screen === 'settings') {
      setIsSettingsOpen(true);
    }
  };

  const isDark = settings.theme === 'dark';
  const isSepia = settings.theme === 'sepia';

  return (
    <div 
      dir="rtl" 
      className={`flex flex-col h-screen w-screen overflow-hidden select-none font-sans ${
        isDark ? 'dark bg-[#18110D] text-stone-100' : isSepia ? 'bg-[#FAF6EC] text-stone-900' : 'bg-[#FAF8F5] text-stone-900'
      }`}
    >
      {/* ── כותרת ורצועת טאבים עליונה (אוצריה מקורית) ── */}
      <Header
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* ── גוף האפליקציה: סרגל ניווט צדדי + חלון תוכן ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* סרגל ניווט צידי */}
        <Sidebar
          activeScreen={activeScreen}
          onSelectScreen={handleSelectScreen}
          hasOpenBooks={tabs.some(t => t.type === 'book' || t.type === 'tzurat_hadaf')}
        />

        {/* שטח התצוגה המרכזי לפי הטאב הפעיל */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white dark:bg-stone-900">
          {activeTab.type === 'tzurat_hadaf' ? (
            <TzuratHaDafTabView
              bookTitle={activeTab.masechta || activeTab.bookTitle || 'ברכות'}
              initialDafNum={activeTab.dafNum || 2}
              initialAmud={activeTab.amud || 'a'}
              settings={settings}
              onUpdateTitle={newTitle => {
                setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, title: newTitle } : t));
              }}
            />
          ) : activeTab.type === 'library' ? (
            <LibraryView
              catalog={catalog}
              settings={settings}
              onOpenBook={handleOpenBook}
              isLoading={isCatalogLoading}
              onUpdateSettings={handleUpdateSettings}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          ) : activeTab.type === 'book' ? (
            <BookReader
              bookId={activeTab.bookId || 101}
              bookTitle={activeTab.bookTitle || 'ספר'}
              initialLine={activeTab.initialLine}
              initialSearch={activeTab.initialSearch}
              settings={settings}
              onAddBookmark={bm => addBookmarkToCloud(bm)}
              onOpenTzuratHaDafTab={handleOpenTzuratHaDafTab}
            />
          ) : activeTab.type === 'search' ? (
            <SearchView
              settings={settings}
              onOpenBookAtLine={(bId, bTitle, line, sText) => {
                handleOpenBook(bId, bTitle, line, sText);
              }}
            />
          ) : activeTab.type === 'find' ? (
            <FindRefView
              catalog={catalog}
              settings={settings}
              onOpenBook={(bId, bTitle, line) => {
                handleOpenBook(bId, bTitle, line);
              }}
            />
          ) : activeTab.type === 'bookmarks' ? (
            <BookmarksView
              bookmarks={bookmarks}
              settings={settings}
              onRemoveBookmark={bId => removeBookmarkFromCloud(bId)}
              onOpenBookAtLine={(bId, bTitle, line) => {
                handleOpenBook(bId, bTitle, line);
              }}
            />
          ) : activeTab.type === 'tools' ? (
            <ToolsPanel
              bookmarks={bookmarks}
              settings={settings}
              onRemoveBookmark={bId => removeBookmarkFromCloud(bId)}
              onOpenBookAtLine={(bId, bTitle, line) => {
                handleOpenBook(bId, bTitle, line);
              }}
              onOpenBookTitle={title => {
                const found = catalog.books.find(b => b.title === title || b.title.includes(title));
                if (found) {
                  handleOpenBook(found.id, found.title);
                } else {
                  handleOpenBook(101, title);
                }
              }}
              catalogBooks={catalog.books}
              onUpdateSettings={handleUpdateSettings}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 font-serif text-stone-500">
              בחר טאב או פתח ספר מהספרייה
            </div>
          )}
        </main>
      </div>

      {/* ── מודל הגדרות ── */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
        catalogBooks={catalog.books}
      />
    </div>
  );
}
