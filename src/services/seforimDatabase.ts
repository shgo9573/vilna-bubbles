import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BookItem, CategoryNode, CatalogData, TocNode, CommentaryLink, SearchResultItem } from '../types/otzaria.js';
import { CANONICAL_BOOKS } from '../data/otzariaLibraryData.js';
import { sysLogger } from './logger.js';
import { sortCommentariesByGeneration } from '../utils/generationOrder.js';

let dbInstance: any = null;
let resolvedDbPath: string | null = null;
let isInitAttempted = false;

// Candidate locations where seforim.db can be found
const homeDir = process.env.HOME || process.env.USERPROFILE || '';
const CANDIDATE_PATHS = [
  '/var/data/otzaria/seforim.db',
  process.env.SEFORIM_DB_PATH,
  '/data/seforim.db',
  path.resolve(process.cwd(), 'seforim.db'),
  path.resolve(process.cwd(), '../seforim.db'),
  path.resolve(process.cwd(), 'data/seforim.db'),
  path.resolve(process.cwd(), '../data/seforim.db'),
  '/home/opc/seforim.db',
  '/home/opc/otzaria-backend/seforim.db',
  homeDir ? path.join(homeDir, 'seforim.db') : '',
  homeDir ? path.join(homeDir, 'otzaria-backend', 'seforim.db') : '',
  homeDir ? path.join(homeDir, 'otzaria', 'seforim.db') : '',
  '/home/ubuntu/seforim.db',
  '/home/ubuntu/otzaria-backend/seforim.db'
].filter(Boolean) as string[];

/**
 * Resolves the SQLite database file on disk
 */
export function getDatabasePath(): string | null {
  if (resolvedDbPath && fs.existsSync(resolvedDbPath)) {
    return resolvedDbPath;
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      try {
        const stats = fs.statSync(candidate);
        if (stats.size > 1000000) { // must be a real DB file (>1MB)
          resolvedDbPath = candidate;
          return resolvedDbPath;
        }
      } catch {}
    }
  }

  return null;
}

let dbEngineType: 'better-sqlite3' | 'cloud' = 'cloud';
let lastDbError: string | null = null;
let lastConnectAttempt = 0;

// High-performance in-memory cache
const tableColumnsCache = new Map<string, string[]>();
const bookLookupCache = new Map<string, { id: number; title: string } | null>();
const bookContentCache = new Map<string, { id: number | string; title: string; content: string; totalLines: number }>();
const bookTocCache = new Map<string, TocNode[]>();
const bookLinksCache = new Map<string, any>();
const inFlightLinksPromises = new Map<string, Promise<any>>();
let fullCatalogCache: CatalogData | null = null;

/**
 * Initializes and returns SQLite connection without permanent failure lock
 */
function getDatabase() {
  if (dbInstance) return dbInstance;

  // Rate limit reconnection attempts to once per 2 seconds
  const now = Date.now();
  if (now - lastConnectAttempt < 2000) {
    return null;
  }
  lastConnectAttempt = now;

  const dbPath = getDatabasePath();

  if (!dbPath) {
    lastDbError = 'קובץ seforim.db לא נמצא בנתיבי המערכת';
    return null;
  }

  console.log(`[SQLite] Connecting to seforim.db at: ${dbPath}`);
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      db.pragma('cache_size = -65536'); // 64MB cache
      db.pragma('query_only = ON');
    } catch (pe: any) {
      console.warn('[SQLite] Pragma notice:', pe.message);
    }
    
    dbEngineType = 'better-sqlite3';
    dbInstance = {
      type: 'better-sqlite3',
      rawDb: db,
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          all: (...params: any[]) => stmt.all(...params),
          get: (...params: any[]) => stmt.get(...params)
        };
      }
    };
    lastDbError = null;
    console.log(`[SQLite] Database successfully ready at ${dbPath}`);
    sysLogger.addLog('success', 'SQLite', `מסד הנתונים seforim.db חובר בהצלחה! (${dbPath})`);
    return dbInstance;
  } catch (err: any) {
    lastDbError = err.message;
    console.error(`[SQLite] Error opening ${dbPath}:`, err.message);
    sysLogger.addLog('error', 'SQLite', `שגיאה בפתיחת seforim.db: ${err.message}`);
    return null;
  }
}

/**
 * Return diagnostic report of SQLite database connectivity and tables
 */
export function getDbDiagnosticsReport(): Record<string, any> {
  const dbPath = getDatabasePath();
  const db = getDatabase();
  const status: Record<string, any> = {
    searchedPaths: CANDIDATE_PATHS,
    resolvedDbPath: dbPath,
    fileExists: dbPath ? fs.existsSync(dbPath) : false,
    fileSizeMB: dbPath && fs.existsSync(dbPath) ? Math.round(fs.statSync(dbPath).size / (1024 * 1024)) : 0,
    connected: db !== null,
    engine: dbEngineType,
    lastError: lastDbError
  };

  if (db && db.prepare) {
    try {
      const tables = queryAll<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table'`);
      status.tables = tables.map(t => t.name);

      if (status.tables.includes('book')) {
        const bookCount = queryGet<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM book`);
        status.bookCount = bookCount?.cnt || 0;
      }
      if (status.tables.includes('category')) {
        const catCount = queryGet<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM category`);
        status.categoryCount = catCount?.cnt || 0;
      }
      if (status.tables.includes('line')) {
        const lineCount = queryGet<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM line`);
        status.lineCount = lineCount?.cnt || 0;
      }
    } catch (e: any) {
      status.queryError = e.message;
    }
  }

  return status;
}

/**
 * Execute SQL query returning array of rows
 */
function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDatabase();
  if (!db || !db.prepare) return [];

  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  } catch (e: any) {
    sysLogger.addLog('error', 'SQLite', `שגיאה בהרצת שאילתה: ${e.message}`);
    return [];
  }
}

/**
 * Execute SQL query returning single row
 */
function queryGet<T = any>(sql: string, params: any[] = []): T | null {
  const db = getDatabase();
  if (!db) return null;

  if (db.prepare) {
    try {
      const stmt = db.prepare(sql);
      if (stmt.get) {
        return (stmt.get(...params) as T) || null;
      }
      const rows = stmt.all(...params);
      return rows.length > 0 ? (rows[0] as T) : null;
    } catch (e: any) {
      sysLogger.addLog('error', 'SQLite', `שגיאה בהרצת שאילתה (get): ${e.message}`);
      return null;
    }
  }

  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Database health check & status details
 */
export function getDatabaseDetails(): {
  available: boolean;
  path: string | null;
  sizeBytes: number;
  sizeGB: string;
  engine: string;
  booksCount: number;
} {
  const p = getDatabasePath();
  if (!p) {
    return {
      available: false,
      path: null,
      sizeBytes: 0,
      sizeGB: '0 GB',
      engine: 'none',
      booksCount: 0
    };
  }

  let size = 0;
  try {
    const stats = fs.statSync(p);
    size = stats.size;
  } catch {}

  let booksCount = 0;
  try {
    const countRow = queryGet<{ count: number }>('SELECT count(*) as count FROM book');
    if (countRow) booksCount = countRow.count;
  } catch {}

  return {
    available: true,
    path: p,
    sizeBytes: size,
    sizeGB: (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    engine: dbEngineType,
    booksCount
  };
}

/**
 * Is the official seforim.db active and ready?
 */
export function isSeforimDbAvailable(): boolean {
  return getDatabasePath() !== null;
}

/**
 * Retrieves table column names via standard PRAGMA table_info (cached)
 */
function getTableColumns(tableName: string): string[] {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName)!;
  }
  try {
    const rows = queryAll<{ name: string }>(`PRAGMA table_info("${tableName}")`);
    const cols = rows.map(r => r.name);
    if (cols.length > 0) {
      tableColumnsCache.set(tableName, cols);
    }
    return cols;
  } catch {
    return [];
  }
}

/**
 * Retrieves the full library catalog from the official seforim.db
 * Matching CategoryQueries.sq & BookQueries.sq dynamically
 */
export function getCatalogFromDb(): CatalogData | null {
  if (!isSeforimDbAvailable()) return null;
  if (fullCatalogCache) return fullCatalogCache;

  try {
    const catCols = getTableColumns('category');
    if (catCols.length === 0) return null;

    const catIdCol = catCols.find(c => /^id$/i.test(c)) || 'id';
    const catParentCol = catCols.find(c => /parent/i.test(c)) || 'parentId';
    const catTitleCol = catCols.find(c => /title|name/i.test(c)) || 'title';
    const catOrderCol = catCols.find(c => /order/i.test(c)) || catIdCol;

    // 1. Fetch all categories
    const categoriesRows = queryAll<any>(`
      SELECT "${catIdCol}" AS id, "${catParentCol}" AS parentId, "${catTitleCol}" AS title
      FROM category
      ORDER BY "${catOrderCol}" ASC, "${catTitleCol}" ASC
    `);

    if (categoriesRows.length === 0) return null;

    // Build category paths
    const catMap = new Map<number, { id: number; parentId: number | null; title: string; fullPath: string }>();
    categoriesRows.forEach(c => {
      catMap.set(c.id, { id: c.id, parentId: c.parentId, title: c.title, fullPath: c.title });
    });

    const resolveFullPath = (id: number): string => {
      const cat = catMap.get(id);
      if (!cat) return '';
      if (!cat.parentId) return cat.title;
      const parentPath = resolveFullPath(cat.parentId);
      return parentPath ? `${parentPath}/${cat.title}` : cat.title;
    };

    categoriesRows.forEach(c => {
      const fullPath = resolveFullPath(c.id);
      const item = catMap.get(c.id);
      if (item) item.fullPath = fullPath;
    });

    // 2. Fetch all books
    const bookCols = getTableColumns('book');
    const bookIdCol = bookCols.find(c => /^id$/i.test(c)) || 'id';
    const bookCatCol = bookCols.find(c => /category/i.test(c)) || 'categoryId';
    const bookTitleCol = bookCols.find(c => /title|name/i.test(c)) || 'title';
    const bookOrderCol = bookCols.find(c => /order/i.test(c)) || bookIdCol;
    const bookDescCol = bookCols.find(c => /desc|short/i.test(c));

    const selectDesc = bookDescCol ? `b."${bookDescCol}" AS heShortDesc,` : '';

    let booksRows: Array<{
      id: number;
      categoryId: number;
      title: string;
      heShortDesc?: string | null;
      orderIndex?: number;
      author?: string | null;
      generationName?: string | null;
    }> = [];

    // Fetch books with authors (using clean valid schema without non-existent generationId)
    const hasBookAuthor = getTableColumns('book_author').length > 0;
    if (hasBookAuthor) {
      try {
        booksRows = queryAll(`
          SELECT b."${bookIdCol}" AS id, b."${bookCatCol}" AS categoryId, b."${bookTitleCol}" AS title,
                 ${selectDesc} b."${bookOrderCol}" AS orderIndex,
                 a.name AS author
          FROM book b
          LEFT JOIN book_author ba ON b."${bookIdCol}" = ba.bookId
          LEFT JOIN author a ON ba.authorId = a.id
          ORDER BY b."${bookOrderCol}" ASC, b."${bookTitleCol}" ASC
        `);
      } catch (err: any) {
        console.warn('[SQLite Catalog] Notice on joined book query:', err.message);
      }
    }

    if (booksRows.length === 0) {
      booksRows = queryAll(`
        SELECT b."${bookIdCol}" AS id, b."${bookCatCol}" AS categoryId, b."${bookTitleCol}" AS title,
               ${selectDesc} b."${bookOrderCol}" AS orderIndex
        FROM book b
        ORDER BY b."${bookOrderCol}" ASC, b."${bookTitleCol}" ASC
      `);
    }

    if (booksRows.length === 0) return null;

    console.log(`[SQLite Catalog] Successfully loaded ${categoriesRows.length} categories and ${booksRows.length} books from seforim.db!`);

    const books: BookItem[] = booksRows.map(b => {
      const cat = catMap.get(b.categoryId);
      const catPath = cat ? cat.fullPath : 'ספרים כלליים';
      return {
        id: b.id,
        title: b.title,
        categoryPath: catPath,
        author: b.author || '',
        heCategories: catPath,
        heEra: b.generationName || '',
        fileType: 'txt',
        order: b.orderIndex || 1,
        hasToc: true,
        hasLinks: true,
        heDesc: b.heShortDesc || ''
      };
    });

    // 3. Build CategoryNode tree
    const rootCategories: CategoryNode[] = [];
    const nodeMap = new Map<number, CategoryNode>();

    categoriesRows.forEach(c => {
      const fullPath = catMap.get(c.id)?.fullPath || c.title;
      const node: CategoryNode = {
        id: String(c.id),
        name: c.title,
        path: fullPath,
        children: [],
        books: []
      };
      nodeMap.set(c.id, node);
    });

    categoriesRows.forEach(c => {
      const node = nodeMap.get(c.id)!;
      if (c.parentId && nodeMap.has(c.parentId)) {
        nodeMap.get(c.parentId)!.children!.push(node);
      } else {
        rootCategories.push(node);
      }
    });

    // Populate books into category nodes in O(N)
    books.forEach((book, i) => {
      const catId = booksRows[i]?.categoryId;
      if (catId && nodeMap.has(catId)) {
        nodeMap.get(catId)!.books!.push(book);
      }
    });

    fullCatalogCache = {
      totalBooksCount: books.length,
      categoriesCount: categoriesRows.length,
      books,
      categories: rootCategories
    };

    return fullCatalogCache;
  } catch (err: any) {
    console.error('[SQLite Catalog] Error building catalog from DB:', err.message);
    sysLogger.addLog('error', 'SQLite', `שגיאה בטעינת קטלוג מ-seforim.db: ${err.message}`);
    return null;
  }
}

/**
 * Finds a book in SQLite by ID, exact title, canonical map, or fuzzy title (cached)
 */
function findBookInDb(bookId: number | string): { id: number; title: string; totalLines?: number } | null {
  const cacheKey = String(bookId).trim();
  if (bookLookupCache.has(cacheKey)) {
    return bookLookupCache.get(cacheKey)!;
  }

  const numId = Number(bookId);
  const strId = String(bookId).trim();

  let found: { id: number; title: string } | null = null;

  // 1. Direct ID match
  if (!isNaN(numId)) {
    found = queryGet<{ id: number; title: string }>(
      'SELECT id, title FROM book WHERE id = ? LIMIT 1',
      [numId]
    );
  }

  // 2. Exact title match
  if (!found) {
    found = queryGet<{ id: number; title: string }>(
      'SELECT id, title FROM book WHERE title = ? LIMIT 1',
      [strId]
    );
  }

  // 3. Resolve canonical fallback ID (e.g. 1001 => "בראשית")
  if (!found) {
    const canonical = CANONICAL_BOOKS.find(b => b.id === numId || String(b.id) === strId);
    if (canonical) {
      found = queryGet<{ id: number; title: string }>(
        'SELECT id, title FROM book WHERE title = ? OR title LIKE ? LIMIT 1',
        [canonical.title, `%${canonical.title}%`]
      );
    }
  }

  // 4. Normalized title match
  if (!found) {
    const cleanTitle = strId
      .replace(/^תלמוד בבלי\s+/, '')
      .replace(/^משנה\s+/, '')
      .replace(/^ספר\s+/, '')
      .replace(/^חומש\s+/, '')
      .trim();

    if (cleanTitle && cleanTitle !== strId) {
      found = queryGet<{ id: number; title: string }>(
        'SELECT id, title FROM book WHERE title = ? LIMIT 1',
        [cleanTitle]
      );
    }
  }

  // 5. Fuzzy LIKE match
  if (!found) {
    const cleanTitle = strId.replace(/^(תלמוד בבלי|משנה|ספר|חומש)\s+/, '').trim();
    found = queryGet<{ id: number; title: string }>(
      'SELECT id, title FROM book WHERE title LIKE ? OR title LIKE ? LIMIT 1',
      [`%${strId}%`, `%${cleanTitle}%`]
    );
  }

  bookLookupCache.set(cacheKey, found);
  return found;
}

export interface BookLineItem {
  lineIndex: number;
  content: string;
  heRef?: string;
}

/**
 * Retrieves book content matching LineQueries.sq selectByBookId / selectByBookIdRange (cached)
 */
export function getBookContentFromDb(
  bookId: number | string,
  startLine?: number,
  endLine?: number
): { id: number | string; title: string; content: string; lines: BookLineItem[]; totalLines: number } | null {
  if (!isSeforimDbAvailable()) return null;

  const cacheKey = `${bookId}_${startLine || 0}_${endLine || 0}`;
  if (bookContentCache.has(cacheKey)) {
    return bookContentCache.get(cacheKey)! as any;
  }

  try {
    const book = findBookInDb(bookId);
    if (!book) return null;

    const lineCols = getTableColumns('line');
    const bookIdCol = lineCols.find(c => /book.*id/i.test(c)) || 'bookId';
    const contentCol = lineCols.find(c => /content|text/i.test(c)) || 'content';
    const indexCol = lineCols.find(c => /line.*index|index|num/i.test(c)) || 'lineIndex';
    const refCol = lineCols.find(c => /he.*ref|ref/i.test(c));

    const selectRef = refCol ? `, "${refCol}" AS heRef` : '';

    let linesRows: Array<{ lineIndex: number; content: string; heRef?: string }> = [];
    let totalLines = 0;

    if (startLine !== undefined && endLine !== undefined) {
      let actualStart = startLine;
      let actualEnd = endLine;

      // 1. Check total lines first
      const countRow = queryGet<{ cnt: number }>(`
        SELECT COUNT(*) AS cnt FROM line WHERE "${bookIdCol}" = ?
      `, [book.id]);
      totalLines = countRow ? countRow.cnt : 0;

      // 2. If startLine is a global line.id, resolve its local lineIndex
      const idMatch = queryGet<{ lineIndex: number }>(`
        SELECT "${indexCol}" AS lineIndex FROM line WHERE id = ? AND "${bookIdCol}" = ? LIMIT 1
      `, [actualStart, book.id]);

      if (idMatch && idMatch.lineIndex) {
        actualStart = idMatch.lineIndex;
        actualEnd = actualStart + 170;
      } else if (totalLines > 0 && actualStart > totalLines) {
        // Safe clamp: if requested line exceeds book total lines, default to start of book
        actualStart = 1;
        actualEnd = Math.min(totalLines, 170);
      } else {
        actualStart = Math.max(1, Math.min(actualStart, actualEnd));
        actualEnd = Math.max(actualStart + 50, Math.max(startLine, endLine));
      }

      // 3. Fetch target range by local lineIndex
      linesRows = queryAll<{ lineIndex: number; content: string; heRef?: string }>(`
        SELECT "${indexCol}" AS lineIndex, "${contentCol}" AS content ${selectRef}
        FROM line
        WHERE "${bookIdCol}" = ? AND "${indexCol}" >= ? AND "${indexCol}" <= ?
        ORDER BY "${indexCol}" ASC
      `, [book.id, actualStart, actualEnd]);

      // 4. Fallback: If still empty, return first chunk of book
      if (linesRows.length === 0) {
        linesRows = queryAll<{ lineIndex: number; content: string; heRef?: string }>(`
          SELECT "${indexCol}" AS lineIndex, "${contentCol}" AS content ${selectRef}
          FROM line
          WHERE "${bookIdCol}" = ?
          ORDER BY "${indexCol}" ASC
          LIMIT 170
        `, [book.id]);
      }
    } else {
      linesRows = queryAll<{ lineIndex: number; content: string; heRef?: string }>(`
        SELECT "${indexCol}" AS lineIndex, "${contentCol}" AS content ${selectRef}
        FROM line
        WHERE "${bookIdCol}" = ?
        ORDER BY "${indexCol}" ASC
        LIMIT 35000
      `, [book.id]);
      totalLines = linesRows.length;
    }

    if (linesRows.length === 0) return null;

    const content = linesRows.map(l => l.content).join('\n');
    const result = {
      id: book.id,
      title: book.title,
      content,
      lines: linesRows,
      totalLines
    };

    // Keep cache size bounded
    if (bookContentCache.size > 50) {
      const firstKey = bookContentCache.keys().next().value;
      if (firstKey) bookContentCache.delete(firstKey);
    }
    bookContentCache.set(cacheKey, result as any);

    console.log(`[SQLite Book] Loaded ${linesRows.length} lines for "${book.title}" (ID: ${book.id})`);
    return result;
  } catch (err: any) {
    console.error('[SQLite Book] Error loading content:', err.message);
    sysLogger.addLog('error', 'SQLite', `שגיאה בשליפת תוכן ספר: ${err.message}`);
    return null;
  }
}

/**
 * Retrieves Table of Contents matching TocQueries.sq selectByBookId with dynamic schema compatibility
 */
export function getBookTocFromDb(bookId: number | string): TocNode[] | null {
  if (!isSeforimDbAvailable()) return null;

  const cacheKey = String(bookId);
  if (bookTocCache.has(cacheKey)) {
    return bookTocCache.get(cacheKey)!;
  }

  try {
    const book = findBookInDb(bookId);
    if (!book) return null;

    const tocCols = getTableColumns('tocEntry');
    if (tocCols.length === 0) return [];

    const tocBookIdCol = tocCols.find(c => /book.*id/i.test(c)) || 'bookId';
    const tocLevelCol = tocCols.find(c => /level/i.test(c)) || 'level';
    const tocTextIdCol = tocCols.find(c => /text.*id/i.test(c)) || 'textId';
    const tocLineIdCol = tocCols.find(c => /line.*id/i.test(c)) || 'lineId';
    const hasTocLineIndex = tocCols.some(c => /line.*index/i.test(c));
    const tocLineIndexCol = hasTocLineIndex ? (tocCols.find(c => /line.*index/i.test(c)) || 'lineIndex') : null;

    // Total lines in book to validate that lineIndex is strictly a local line index
    const countRow = queryGet<{ cnt: number }>(`
      SELECT COUNT(*) AS cnt FROM line WHERE bookId = ?
    `, [book.id]);
    const totalLines = countRow ? countRow.cnt : 0;

    // Single fast query using dynamic schema to avoid "no such column" errors
    const selectTocLineIndex = tocLineIndexCol ? `t."${tocLineIndexCol}"` : 'NULL';
    const rows = queryAll<{
      id: number;
      level: number;
      title: string;
      lineLineIndex: number | null;
      tocLineIndex: number | null;
      rawLineId: number | null;
    }>(`
      SELECT 
        t.id,
        t."${tocLevelCol}" AS level,
        COALESCE(tt.text, '') AS title,
        l.lineIndex AS lineLineIndex,
        ${selectTocLineIndex} AS tocLineIndex,
        t."${tocLineIdCol}" AS rawLineId
      FROM tocEntry t
      LEFT JOIN tocText tt ON t."${tocTextIdCol}" = tt.id
      LEFT JOIN line l ON t."${tocLineIdCol}" = l.id
      WHERE t."${tocBookIdCol}" = ?
      ORDER BY t.id ASC
    `, [book.id]);

    const result: TocNode[] = [];
    const totalRows = rows.length;
    let lastMonotonicIndex = 1;

    rows.forEach((r, idx) => {
      // 1. Prefer local lineIndex from joined line table
      let resolvedIndex = r.lineLineIndex;

      // 2. If line table JOIN didn't resolve, check tocLineIndex if valid
      if (!resolvedIndex && r.tocLineIndex && (totalLines === 0 || r.tocLineIndex <= totalLines)) {
        resolvedIndex = r.tocLineIndex;
      }

      // 3. If lineIndex is still missing or exceeds totalLines, attempt heading search in book lines
      if (!resolvedIndex || (totalLines > 0 && resolvedIndex > totalLines)) {
        const cleanTitle = (r.title || '').replace(/[-"'\״\׳:;,.]/g, '').trim();
        if (cleanTitle.length >= 2) {
          const matchedLine = queryGet<{ lineIndex: number }>(`
            SELECT lineIndex FROM line 
            WHERE bookId = ? AND (content LIKE ? OR content LIKE ?)
            LIMIT 1
          `, [book.id, `%${cleanTitle}%`, `%${r.title}%`]);

          if (matchedLine && matchedLine.lineIndex > 0) {
            resolvedIndex = matchedLine.lineIndex;
          }
        }

        // 4. If still not found, estimate proportionally from TOC order
        if (!resolvedIndex || (totalLines > 0 && resolvedIndex > totalLines)) {
          if (totalLines > 0 && totalRows > 1) {
            resolvedIndex = Math.max(1, Math.round((idx / (totalRows - 1)) * (totalLines - 1)) + 1);
          } else {
            resolvedIndex = Math.max(1, idx + 1);
          }
        }
      }

      let finalIndex = Math.max(1, resolvedIndex || 1);
      if (finalIndex < lastMonotonicIndex) {
        finalIndex = lastMonotonicIndex;
      }
      lastMonotonicIndex = finalIndex;

      result.push({
        title: r.title || `פרק ${finalIndex}`,
        index: finalIndex,
        level: r.level || 1
      });
    });

    bookTocCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error('[SQLite TOC] Error loading TOC:', err.message);
    sysLogger.addLog('warn', 'SQLite', `שגיאה בשליפת TOC: ${err.message}`);
    return [];
  }
}

/**
 * Retrieves line commentaries matching LinkQueries.sq selectLinksBySourceLineIds (Fast 2-step indexed query & cached)
 */
export function getBookLinksFromDb(
  bookId: number | string,
  lineIndex: number
): {
  id: number | string;
  line: number;
  chapter?: number;
  verse?: number;
  dafLabel?: string;
  links: CommentaryLink[];
  allLinks: CommentaryLink[];
  availableCommentators: string[];
} | null {
  if (!isSeforimDbAvailable()) return null;

  const cacheKey = `${bookId}_${lineIndex}`;
  if (bookLinksCache.has(cacheKey)) {
    return bookLinksCache.get(cacheKey)!;
  }

  try {
    const book = findBookInDb(bookId);
    if (!book) return null;

    // Step 1: Instant lookup of source line primary key (0.1ms)
    const lineCols = getTableColumns('line');
    const bookIdCol = lineCols.find(c => /book.*id/i.test(c)) || 'bookId';
    const indexCol = lineCols.find(c => /line.*index|index|num/i.test(c)) || 'lineIndex';

    const sourceLine = queryGet<{ id: number; heRef?: string }>(`
      SELECT id, heRef
      FROM line
      WHERE "${bookIdCol}" = ? AND "${indexCol}" = ?
      LIMIT 1
    `, [book.id, lineIndex]);

    if (!sourceLine) {
      const emptyRes = {
        id: book.id,
        line: lineIndex,
        links: [],
        allLinks: [],
        availableCommentators: []
      };
      bookLinksCache.set(cacheKey, emptyRes);
      return emptyRes;
    }

    // Step 2: Direct primary-indexed join on link table (1ms)
    const linkRows = queryAll<{
      id: number;
      connectionType?: string;
      targetBookTitle: string;
      targetText: string;
      targetLineIndex: number;
      targetHeRef: string | null;
    }>(`
      SELECT l.id, ct.name AS connectionType,
             b.title AS targetBookTitle, tl.content AS targetText,
             tl.lineIndex AS targetLineIndex, tl.heRef AS targetHeRef
      FROM link l
      LEFT JOIN connection_type ct ON l.connectionTypeId = ct.id
      JOIN book b ON l.targetBookId = b.id
      JOIN line tl ON l.targetLineId = tl.id
      WHERE l.sourceLineId = ?
      ORDER BY b.orderIndex
      LIMIT 60
    `, [sourceLine.id]);

    const links: CommentaryLink[] = linkRows.map(r => ({
      sourceBook: r.targetBookTitle,
      category: r.connectionType || 'מפרש',
      line: r.targetLineIndex,
      text: r.targetText,
      dibburHamatchil: r.targetHeRef || undefined,
      isLineMatch: true
    }));

    const sortedLinks = sortCommentariesByGeneration(links);
    const availableCommentators = Array.from(new Set(sortedLinks.map(l => l.sourceBook)));

    const validDafLabel = (sourceLine.heRef && !/^\d+$/.test(sourceLine.heRef.trim())) ? sourceLine.heRef : undefined;

    const result = {
      id: book.id,
      line: lineIndex,
      dafLabel: validDafLabel,
      links: sortedLinks,
      allLinks: sortedLinks,
      availableCommentators
    };

    if (bookLinksCache.size > 200) {
      const firstK = bookLinksCache.keys().next().value;
      if (firstK) bookLinksCache.delete(firstK);
    }
    bookLinksCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    sysLogger.addLog('warn', 'SQLite', `שגיאה בשליפת קישורים: ${err.message}`);
    return null;
  }
}

const bookCommentatorsListCache = new Map<string, string[]>();

/**
 * Retrieves all commentators for a book matching Otzaria original selectCommentatorsByBook & default_commentator queries
 */
export function getAllBookCommentatorsFromDb(bookId: number | string): string[] {
  if (!isSeforimDbAvailable()) return [];

  const cacheKey = String(bookId);
  if (bookCommentatorsListCache.has(cacheKey)) {
    return bookCommentatorsListCache.get(cacheKey)!;
  }

  try {
    const book = findBookInDb(bookId);
    if (!book) return [];

    const bookCols = getTableColumns('book');
    const bookOrderCol = bookCols.find(c => /order.*index|order/i.test(c));
    const bookTitleCol = bookCols.find(c => /title|name/i.test(c)) || 'title';
    const bookIdCol = bookCols.find(c => /^id$/i.test(c)) || 'id';

    const orderClause = bookOrderCol ? `b."${bookOrderCol}" ASC, b."${bookTitleCol}" ASC` : `b."${bookTitleCol}" ASC`;

    // 1. Fetch defaults from default_commentator & default_targum if available (ordered by position)
    let defaultList: string[] = [];
    try {
      const defCols = getTableColumns('default_commentator');
      if (defCols.length > 0) {
        const defBookIdCol = defCols.find(c => /^book.*id$/i.test(c)) || 'bookId';
        const defCommBookIdCol = defCols.find(c => /commentator.*book.*id/i.test(c)) || 'commentatorBookId';
        const defPosCol = defCols.find(c => /position|order/i.test(c)) || 'position';

        const defRows = queryAll<{ targetBookTitle: string; position: number }>(`
          SELECT b."${bookTitleCol}" AS targetBookTitle, dc."${defPosCol}" AS position
          FROM default_commentator dc
          JOIN book b ON dc."${defCommBookIdCol}" = b."${bookIdCol}"
          WHERE dc."${defBookIdCol}" = ?
          ORDER BY dc."${defPosCol}" ASC
        `, [book.id]);
        defaultList.push(...defRows.map(r => r.targetBookTitle));
      }

      const targumCols = getTableColumns('default_targum');
      if (targumCols.length > 0) {
        const tBookIdCol = targumCols.find(c => /^book.*id$/i.test(c)) || 'bookId';
        const tCommBookIdCol = targumCols.find(c => /targum.*book.*id/i.test(c)) || 'targumBookId';
        const tPosCol = targumCols.find(c => /position|order/i.test(c)) || 'position';

        const targumRows = queryAll<{ targetBookTitle: string; position: number }>(`
          SELECT b."${bookTitleCol}" AS targetBookTitle, dt."${tPosCol}" AS position
          FROM default_targum dt
          JOIN book b ON dt."${tCommBookIdCol}" = b."${bookIdCol}"
          WHERE dt."${tBookIdCol}" = ?
          ORDER BY dt."${tPosCol}" ASC
        `, [book.id]);
        defaultList.push(...targumRows.map(r => r.targetBookTitle));
      }
    } catch (e: any) {
      console.warn('[SQLite Commentators] Default list notice:', e.message);
    }

    // 2. Fetch all commentators linked to this book matching Otzaria LinkQueries.sq
    let linkedTitles: string[] = [];
    const linkCols = getTableColumns('link');

    if (linkCols.length > 0) {
      const srcBookIdCol = linkCols.find(c => /source.*book.*id/i.test(c));
      const tgtBookIdCol = linkCols.find(c => /target.*book.*id/i.test(c)) || 'targetBookId';
      const connTypeCol = linkCols.find(c => /conn.*type.*id/i.test(c));
      const srcLineIdCol = linkCols.find(c => /source.*line.*id/i.test(c));

      // Strategy A: If link table has direct sourceBookId column
      if (srcBookIdCol) {
        try {
          if (connTypeCol) {
            const rows = queryAll<{ targetBookTitle: string }>(`
              SELECT DISTINCT b."${bookTitleCol}" AS targetBookTitle
              FROM link l
              JOIN connection_type ct ON l."${connTypeCol}" = ct.id
              JOIN book b ON l."${tgtBookIdCol}" = b."${bookIdCol}"
              WHERE l."${srcBookIdCol}" = ?
              AND ct.name IN ('COMMENTARY', 'SUPER_COMMENTARY', 'TARGUM', 'MIDRASH', 'PARSHANUT', 'DIBUR_HAMATCHIL', 'ELUCIDATION', 'FOOTNOTES')
              ORDER BY ${orderClause}
            `, [book.id]);
            linkedTitles = rows.map(r => r.targetBookTitle);
          } else {
            const rows = queryAll<{ targetBookTitle: string }>(`
              SELECT DISTINCT b."${bookTitleCol}" AS targetBookTitle
              FROM link l
              JOIN book b ON l."${tgtBookIdCol}" = b."${bookIdCol}"
              WHERE l."${srcBookIdCol}" = ?
              ORDER BY ${orderClause}
            `, [book.id]);
            linkedTitles = rows.map(r => r.targetBookTitle);
          }
        } catch (e: any) {
          console.warn('[SQLite Commentators] Direct link query notice:', e.message);
        }
      }

      // Strategy B: Join through sourceLine -> line.bookId if Strategy A returned 0 or wasn't available
      if (linkedTitles.length === 0 && srcLineIdCol) {
        try {
          const rows = queryAll<{ targetBookTitle: string }>(`
            SELECT DISTINCT b."${bookTitleCol}" AS targetBookTitle
            FROM link l
            JOIN line sl ON l."${srcLineIdCol}" = sl.id
            JOIN book b ON l."${tgtBookIdCol}" = b."${bookIdCol}"
            WHERE sl.bookId = ?
            ORDER BY ${orderClause}
          `, [book.id]);
          linkedTitles = rows.map(r => r.targetBookTitle);
        } catch (e: any) {
          console.warn('[SQLite Commentators] Line join query notice:', e.message);
        }
      }
    }

    // 3. Combine: defaults first (Rashi -> Tosafot -> etc.), then rest sorted by generation and authority
    const combinedSet = new Set<string>();
    defaultList.forEach(t => {
      if (t && t.trim()) combinedSet.add(t.trim());
    });

    // Sort remaining non-default commentators by generation hierarchy
    const nonDefaults = linkedTitles.filter(t => !combinedSet.has(t));
    const sortedNonDefaults = sortCommentariesByGeneration(nonDefaults);
    sortedNonDefaults.forEach(t => {
      if (t && t.trim()) combinedSet.add(t.trim());
    });

    const finalResult = Array.from(combinedSet);
    bookCommentatorsListCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (err: any) {
    console.error('[SQLite Commentators] Error:', err.message);
    return [];
  }
}

/**
 * Async wrapper with in-flight request coalescing to prevent duplicate concurrent queries
 */
export async function getBookLinksFromDbAsync(
  bookId: number | string,
  lineIndex: number
): Promise<{
  id: number | string;
  line: number;
  chapter?: number;
  verse?: number;
  dafLabel?: string;
  links: CommentaryLink[];
  allLinks: CommentaryLink[];
  availableCommentators: string[];
} | null> {
  if (!isSeforimDbAvailable()) return null;

  const cacheKey = `${bookId}_${lineIndex}`;
  if (bookLinksCache.has(cacheKey)) {
    return bookLinksCache.get(cacheKey)!;
  }

  if (inFlightLinksPromises.has(cacheKey)) {
    return inFlightLinksPromises.get(cacheKey)!;
  }

  const promise = Promise.resolve().then(() => getBookLinksFromDb(bookId, lineIndex));
  inFlightLinksPromises.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    inFlightLinksPromises.delete(cacheKey);
  }
}

/**
 * Returns raw database schema tables for diagnostics
 */
export function getDatabaseSchema(): any {
  if (!isSeforimDbAvailable()) return { error: 'DB not available' };
  try {
    const tables = queryAll<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    return { count: tables.length, tables };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Searches the database using line LIKE queries
 */
export function searchDatabase(query: string, limit: number = 60): SearchResultItem[] | null {
  if (!isSeforimDbAvailable() || !query.trim()) return null;

  const cleanQ = query.trim();
  const rows = queryAll<{
    bookId: number;
    bookTitle: string;
    categoryPath: string;
    lineIndex: number;
    content: string;
  }>(`
    SELECT l.bookId, b.title as bookTitle, l.lineIndex, l.content
    FROM line l
    JOIN book b ON l.bookId = b.id
    WHERE l.content LIKE ?
    LIMIT ?
  `, [`%${cleanQ}%`, limit]);

  return rows.map(r => ({
    bookId: r.bookId,
    bookTitle: r.bookTitle,
    categoryPath: 'ספרייה',
    lineIndex: r.lineIndex,
    snippet: r.content
  }));
}

/**
 * Retrieves all book IDs belonging to a category and all its subcategories recursively
 */
export function getBookIdsForCategory(category: string | number | Array<string | number>): number[] {
  if (!category) return [];

  const rawInputs = Array.isArray(category) ? category : [category];
  const inputs = rawInputs.filter(x => x !== null && x !== undefined && String(x).trim() !== '');
  if (inputs.length === 0) return [];

  try {
    const catCols = getTableColumns('category');
    const bookCols = getTableColumns('book');

    if (catCols.length > 0 && bookCols.length > 0) {
      const catIdCol = catCols.find(c => /^id$/i.test(c)) || 'id';
      const catParentCol = catCols.find(c => /parent/i.test(c)) || 'parentId';
      const catTitleCol = catCols.find(c => /title|name/i.test(c)) || 'title';

      const catRows = queryAll<{ id: number; parentId: number | null; title: string }>(`
        SELECT "${catIdCol}" AS id, "${catParentCol}" AS parentId, "${catTitleCol}" AS title
        FROM category
      `);

      if (catRows.length > 0) {
        // Map parent to child category IDs
        const childrenMap = new Map<number, number[]>();
        for (const row of catRows) {
          if (row.parentId !== null && row.parentId !== undefined) {
            const pId = Number(row.parentId);
            if (!childrenMap.has(pId)) {
              childrenMap.set(pId, []);
            }
            childrenMap.get(pId)!.push(Number(row.id));
          }
        }

        // Match initial categories
        const matchedCategoryIds = new Set<number>();
        for (const input of inputs) {
          const numInput = Number(input);
          const strInput = String(input).trim();
          
          for (const row of catRows) {
            if (!isNaN(numInput) && String(row.id) === String(numInput)) {
              matchedCategoryIds.add(Number(row.id));
            } else if (
              row.title === strInput ||
              row.title.trim().toLowerCase() === strInput.toLowerCase() ||
              strInput.endsWith('/' + row.title) ||
              strInput.includes('/' + row.title + '/') ||
              strInput.startsWith(row.title + '/')
            ) {
              matchedCategoryIds.add(Number(row.id));
            }
          }
        }

        // Recursively gather all subcategory IDs
        const allCategoryIds = new Set<number>();
        const queue: number[] = Array.from(matchedCategoryIds);

        while (queue.length > 0) {
          const currId = queue.shift()!;
          if (!allCategoryIds.has(currId)) {
            allCategoryIds.add(currId);
            const children = childrenMap.get(currId);
            if (children && children.length > 0) {
              queue.push(...children);
            }
          }
        }

        if (allCategoryIds.size > 0) {
          const bookIdCol = bookCols.find(c => /^id$/i.test(c)) || 'id';
          const bookCatCol = bookCols.find(c => /category/i.test(c)) || 'categoryId';

          const catIdList = Array.from(allCategoryIds);
          const placeholders = catIdList.map(() => '?').join(',');

          const bookRows = queryAll<{ id: number }>(`
            SELECT "${bookIdCol}" AS id
            FROM book
            WHERE "${bookCatCol}" IN (${placeholders})
          `, catIdList);

          return bookRows.map(b => Number(b.id)).filter(id => !isNaN(id));
        }
      }
    }
  } catch (err: any) {
    console.warn('[getBookIdsForCategory] DB query notice:', err.message);
  }

  // Fallback using loaded catalog in memory
  try {
    const catalog = getCatalogFromDb();
    if (catalog && catalog.books) {
      const bookIds: number[] = [];
      for (const b of catalog.books) {
        for (const input of inputs) {
          const strInput = String(input).trim();
          const numInput = Number(input);
          if (
            (b.categoryPath && (
              b.categoryPath === strInput ||
              b.categoryPath.startsWith(strInput + '/') ||
              b.categoryPath.includes('/' + strInput) ||
              b.categoryPath.includes(strInput)
            )) ||
            (!isNaN(numInput) && (b as any).categoryId === numInput)
          ) {
            bookIds.push(Number(b.id));
            break;
          }
        }
      }
      return bookIds;
    }
  } catch {}

  return [];
}
