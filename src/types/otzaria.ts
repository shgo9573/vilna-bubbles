export interface BookItem {
  id: number | string;
  title: string;
  categoryPath: string;
  author?: string;
  heCategories?: string;
  heEra?: string;
  fileType: string;
  order?: number;
  hasToc?: boolean;
  hasLinks?: boolean;
  remotePath?: string;
  heDesc?: string;
  pubDate?: string;
  pubPlace?: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  path: string;
  children?: CategoryNode[];
  books?: BookItem[];
}

export interface CatalogData {
  categories: CategoryNode[];
  books: BookItem[];
  totalBooksCount?: number;
  categoriesCount?: number;
}

export interface TocNode {
  title: string;
  index: number;
  lineIndex?: number;
  level?: number;
  children?: TocNode[];
}

export interface CommentaryLink {
  sourceBook: string;
  category: string;
  line: number;
  text: string;
  dibburHamatchil?: string;
  isLineMatch?: boolean;
}

export interface SearchResultItem {
  bookId: number | string;
  bookTitle: string;
  categoryPath: string;
  lineIndex: number;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  resultsCount: number;
  results: SearchResultItem[];
}

export interface ServerStatus {
  status: 'initializing' | 'downloading' | 'busy' | 'ready' | 'error';
  mode?: 'sqlite_local' | 'cloud_online';
  step?: string;
  progress?: number;
  downloadedBytes?: number;
  totalBooks: number;
  storageUsageMB: number;
  databasePath?: string;
  databaseSize?: string;
  databaseEngine?: string;
  lastUpdated: string;
  message?: string;
}

export interface TabItem {
  id: string;
  type: 'library' | 'search' | 'book' | 'bookmarks' | 'find' | 'tools' | 'history' | 'settings' | 'tzurat_hadaf';
  title: string;
  bookId?: number | string;
  bookTitle?: string;
  initialLine?: number;
  initialSearch?: string;
  initialHighlight?: string;
  masechta?: string;
  dafNum?: number;
  amud?: 'a' | 'b';
}

export interface BookmarkItem {
  id: string;
  bookId: number | string;
  bookTitle: string;
  lineIndex: number;
  snippet: string;
  note?: string;
  createdAt: string;
}

export interface CustomDailyStudy {
  id: string;
  title: string;
  bookTitle: string;
  bookId?: number | string;
  paceType: 'page' | 'daf' | 'chapter' | 'siman' | 'custom';
  unitsPerDay?: number;
  totalUnits?: number;
  currentUnit?: number;
  startDate?: string;
  description?: string;
  active: boolean;
}

export interface ReaderSettings {
  // גופנים ומראה
  fontFamily: 'Frank Ruhl Hofshi' | 'David Libre' | 'Heebo' | 'Taamey Frank CLM' | 'Keter YG';
  fontSize: number;
  commentaryFontFamily?: 'Frank Ruhl Hofshi' | 'David Libre' | 'Heebo' | 'Rashi';
  commentaryFontSize?: number;
  theme: 'light' | 'sepia' | 'dark';

  // 1. מבנה העמוד והקריאה
  lineHeight: number; // 1.0, 1.2, 1.5, 1.8, 2.0
  textMaxWidth: '70%' | '80%' | '90%' | '100%';
  continuousReadingMode: boolean; // קריאה רציפה בתנ"ך ובתלמוד

  // 2. מדיניות ניקוד, טעמים ושמות קדושים
  showNikud: boolean;
  nikudPolicy: 'all' | 'none' | 'tanakh_only';
  showTeamim: boolean;
  showPunctuation: boolean;
  holyNameReplacement: "ה'" | "יי" | "ד'" | "יהוה";
  showCommentaryMarkers: boolean; // ציוני מפרשים בגוף הטקסט
  commentaryViewMode?: 'auto' | 'side_panel' | 'inline'; // אופן תצוגת מפרשים: אוטומטי (מובייל=משולב, מחשב=פאנל צד), פאנל צדדי, או משולב מתחת לשורה

  // 3. הגדרות העתקה
  copyIncludeHeader: 'always' | 'never' | 'ask';
  copyHeaderFormat: 'title_and_ref' | 'title_only' | 'full_path';

  // 4. ספרייה
  libraryViewMode: 'list' | 'grid';
  showBookPreview: boolean;

  // 5. לוח שנה וזמני היום
  calendarLocation: string; // ירושלים, בני ברק, צפת, חיפה, באר שבע, ניו יורק, לונדון
  zmanimMethod: 'gra' | 'mga' | 'baal_hatanya';
  showDailyStudy: boolean;
  halachaYomitScheduleType?: 'dirshu_mishna_berura' | 'shulchan_aruch' | 'kitzur_shulchan_aruch' | 'rambam_halacha';
  chofetzChaimScheduleType?: 'world_three_times' | 'world_annual' | 'world_biannual' | 'daily_order';
  dailyStudyTracks?: {
    dafYomi: boolean;
    parasha: boolean;
    chofetzChaim: boolean;
    mishnahYomi: boolean;
    rambam: boolean;
    halachaYomit: boolean;
    tanakhYomi: boolean;
  };
  customDailyStudies?: CustomDailyStudy[];

  // 6. מחשבון גימטריה
  gematriaMethod: 'standard' | 'small' | 'atbash' | 'albam';
  gematriaIncludeSofiyot: boolean;

  // 7. תיקון קוראים
  tiqqunShowColumns: boolean;
  tiqqunHighlightKamatzKatan: boolean;

  // 8. קיצורי מקשים
  shortcuts: {
    nextPage: string;
    prevPage: string;
    nextChapter: string;
    prevChapter: string;
    searchBook: string;
    searchGlobal: string;
    toggleCommentary: string;
    toggleToc: string;
    increaseFont: string;
    decreaseFont: string;
  };

  // 9. מערכת
  perBookSettingsEnabled: boolean;
  rollingBackupsEnabled: boolean;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontFamily: 'Frank Ruhl Hofshi',
  fontSize: 20,
  commentaryFontFamily: 'Frank Ruhl Hofshi',
  commentaryFontSize: 16,
  theme: 'sepia',
  lineHeight: 1.8,
  textMaxWidth: '90%',
  continuousReadingMode: false,
  showNikud: true,
  nikudPolicy: 'all',
  showTeamim: true,
  showPunctuation: true,
  holyNameReplacement: "ה'",
  showCommentaryMarkers: true,
  commentaryViewMode: 'auto',
  copyIncludeHeader: 'always',
  copyHeaderFormat: 'title_and_ref',
  libraryViewMode: 'grid',
  showBookPreview: true,
  calendarLocation: 'ירושלים',
  zmanimMethod: 'gra',
  showDailyStudy: true,
  halachaYomitScheduleType: 'dirshu_mishna_berura',
  chofetzChaimScheduleType: 'world_three_times',
  dailyStudyTracks: {
    dafYomi: true,
    parasha: true,
    chofetzChaim: true,
    mishnahYomi: true,
    rambam: true,
    halachaYomit: true,
    tanakhYomi: true
  },
  customDailyStudies: [],
  gematriaMethod: 'standard',
  gematriaIncludeSofiyot: false,
  tiqqunShowColumns: true,
  tiqqunHighlightKamatzKatan: true,
  shortcuts: {
    nextPage: 'PageDown',
    prevPage: 'PageUp',
    nextChapter: 'Alt+ArrowDown',
    prevChapter: 'Alt+ArrowUp',
    searchBook: 'Ctrl+F',
    searchGlobal: 'Ctrl+Shift+F',
    toggleCommentary: 'Ctrl+M',
    toggleToc: 'Ctrl+T',
    increaseFont: 'Ctrl+=',
    decreaseFont: 'Ctrl+-'
  },
  perBookSettingsEnabled: true,
  rollingBackupsEnabled: true
};
