import React from 'react';
import {
  Library,
  Compass,
  BookOpen,
  Search,
  Sparkles,
  Settings,
  HardDrive
} from 'lucide-react';

export type MainNavScreen = 'library' | 'find' | 'reading' | 'search' | 'tools' | 'settings' | 'bookmarks';

interface SidebarProps {
  activeScreen: MainNavScreen;
  onSelectScreen: (screen: MainNavScreen) => void;
  hasOpenBooks: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
  hasOpenBooks
}) => {
  // Main Nav Items matching Otzaria Flutter _navData exactly:
  // 1. Library (ספרייה)
  // 2. Find (איתור)
  // 3. Reading (עיון)
  // 4. Search (חיפוש)
  // 5. Tools (כלים)
  // 6. Settings (הגדרות)
  const topNavItems = [
    {
      id: 'library' as MainNavScreen,
      label: 'ספרייה',
      icon: Library,
      tooltip: 'ספרייה - עיון בקטלוג הספרים'
    },
    {
      id: 'find' as MainNavScreen,
      label: 'איתור',
      icon: Compass,
      tooltip: 'איתור - איתור מהיר של מקור לפי ספר, פרק ופסוק'
    },
    {
      id: 'reading' as MainNavScreen,
      label: 'עיון',
      icon: BookOpen,
      tooltip: 'עיון - מעבר לספרים הפתוחים',
      badge: hasOpenBooks
    },
    {
      id: 'search' as MainNavScreen,
      label: 'חיפוש',
      icon: Search,
      tooltip: 'חיפוש - מנוע חיפוש במאגר'
    },
    {
      id: 'tools' as MainNavScreen,
      label: 'כלים',
      icon: Sparkles,
      tooltip: 'כלים - דף יומי, גימטריה, תאריכון, סימניות והערות'
    }
  ];

  return (
    <aside className="w-16 bg-[#24150B] text-amber-100 border-l border-[#3D2312] flex flex-col items-center py-2.5 justify-between shrink-0 select-none shadow-md z-10">
      {/* Top Main Navigation Items */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
        {topNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectScreen(item.id)}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group relative ${
                isActive
                  ? 'bg-amber-800/90 text-[#FFF5E6] font-bold shadow-xs'
                  : 'text-amber-200/70 hover:bg-[#3D2312]/80 hover:text-amber-100'
              }`}
              title={item.tooltip}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-amber-100' : 'text-amber-300/80'
                  }`}
                />
                {item.badge && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className="text-[11px] font-sans font-medium tracking-tight">
                {item.label}
              </span>

              {/* Active Right Indicator Bar */}
              {isActive && (
                <span className="absolute right-0 top-2 bottom-2 w-1 bg-amber-400 rounded-l-full shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Settings Navigation Item */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5 pt-2 border-t border-[#3D2312]/80">
        <button
          onClick={() => onSelectScreen('settings')}
          className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group relative ${
            activeScreen === 'settings'
              ? 'bg-amber-800/90 text-[#FFF5E6] font-bold shadow-xs'
              : 'text-amber-200/70 hover:bg-[#3D2312]/80 hover:text-amber-100'
          }`}
          title="הגדרות תצוגה, גופנים וערכות נושא"
        >
          <Settings
            className={`w-5 h-5 transition-transform group-hover:rotate-45 ${
              activeScreen === 'settings' ? 'text-amber-100' : 'text-amber-300/80'
            }`}
          />
          <span className="text-[11px] font-sans font-medium tracking-tight">
            הגדרות
          </span>

          {activeScreen === 'settings' && (
            <span className="absolute right-0 top-2 bottom-2 w-1 bg-amber-400 rounded-l-full shadow-xs" />
          )}
        </button>
      </div>
    </aside>
  );
};
