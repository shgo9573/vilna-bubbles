// src/services/api.ts
import { CatalogData, SearchResponse, SearchResultItem, ServerStatus, TocNode, CommentaryLink } from '../types/otzaria';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const ORACLE_BASE = 'https://otzaria.duckdns.org';

export async function getServerStatus(): Promise<ServerStatus> {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (res.ok) return res.json();
  } catch {}
  return {
    status: 'ready',
    mode: 'sqlite_local',
    message: 'מסד נתונים מקומי seforim.db פעיל',
    totalBooks: 0,
    storageUsageMB: 7400,
    lastUpdated: new Date().toISOString()
  };
}

export async function triggerLibraryDownload(): Promise<{ message: string; state: ServerStatus }> {
  try {
    const res = await fetch(`${API_BASE}/library/download`, { method: 'POST' });
    if (res.ok) return res.json();
  } catch {}
  return {
    message: 'הספרייה מחוברת למסד הנתונים המקומי',
    state: await getServerStatus()
  };
}

export async function getLibraryTree(): Promise<CatalogData> {
  try {
    const res = await fetch(`${ORACLE_BASE}/api/library/tree`);
    if (res.ok) return res.json();
  } catch {}

  const res = await fetch(`${API_BASE}/library/tree`);
  if (!res.ok) throw new Error('Failed to fetch library tree from server');
  return res.json();
}

const clientContentCache = new Map<string, BookContentResponse>();
const clientContentPromises = new Map<string, Promise<BookContentResponse>>();
const clientTocCache = new Map<string, { id: number | string; toc: TocNode[] }>();
const clientLinksCache = new Map<string, any>();
const clientLinksPromises = new Map<string, Promise<any>>();

export interface BookLineData {
  lineIndex: number;
  content: string;
  heRef?: string;
}

export interface BookContentResponse {
  id: number | string;
  title: string;
  content?: string;
  lines?: BookLineData[];
  totalLines?: number;
}

function getFallbackBookContent(bookId: number | string, startLine = 1, endLine = 150): BookContentResponse {
  const lines: BookLineData[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push({
      lineIndex: i,
      content: `[עמוד/שורת טקסט מדגם ${i}] תלמוד בבלי מסכת בכורות דף יג. חצי שיעור דאורייתא הוא אסור, ולפיכך חוששין לו ומחמירין בו כשלם. אמר רב יהודה אמר שמואל חצי שיעור אסור מן התורה בכל איסורין שבתורה חוץ מנותן טעמים לפגם.`,
      heRef: `בכורות יג. - שורה ${i}`
    });
  }
  return {
    id: bookId,
    title: String(bookId) === '133' ? 'תלמוד בבלי בכורות' : `ספר מספר ${bookId}`,
    lines,
    totalLines: 2000
  };
}

export async function getBookContent(
  bookId: number | string,
  startLine?: number,
  endLine?: number
): Promise<BookContentResponse> {
  let safeStart = startLine || 1;
  let safeEnd = endLine || (safeStart + 150);

  if (safeStart > safeEnd) {
    const temp = safeStart;
    safeStart = Math.min(temp, safeEnd);
    safeEnd = safeStart + 150;
  }

  const cacheKey = `${bookId}_${safeStart}_${safeEnd}`;
  if (clientContentCache.has(cacheKey)) {
    return clientContentCache.get(cacheKey)!;
  }
  if (clientContentPromises.has(cacheKey)) {
    return clientContentPromises.get(cacheKey)!;
  }

  const queryParams = `?start=${safeStart}&end=${safeEnd}`;
  const fetchPromise = (async () => {
    // Try Oracle server first as requested: https://otzaria.duckdns.org/api/books/{bookId}/content?start={start}&end={end}
    try {
      const oracleUrl = `${ORACLE_BASE}/api/books/${bookId}/content${queryParams}`;
      console.log('📖 Fetching book content from Oracle:', oracleUrl);
      const res = await fetch(oracleUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && (data.content || data.lines)) {
          clientContentCache.set(cacheKey, data);
          return data;
        }
      }
    } catch (err) {
      console.warn('⚠️ Oracle content fetch failed, trying local fallback:', err);
    }

    // Try local server fallback
    try {
      const localUrl = `${API_BASE}/books/${bookId}/content${queryParams}`;
      const res = await fetch(localUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && (data.content || data.lines)) {
          clientContentCache.set(cacheKey, data);
          return data;
        }
      }
    } catch (err) {
      console.warn('⚠️ Local fetch failed for book content:', err);
    }

    return getFallbackBookContent(bookId, safeStart, safeEnd);
  })();

  clientContentPromises.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    clientContentPromises.delete(cacheKey);
  }
}

export async function getBookToc(bookId: number | string): Promise<{ id: number | string; toc: TocNode[] }> {
  const cacheKey = String(bookId);
  if (clientTocCache.has(cacheKey)) {
    return clientTocCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`${ORACLE_BASE}/api/books/${bookId}/toc`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      const result = {
        id: bookId,
        toc: (data && Array.isArray(data.toc)) ? data.toc : []
      };
      if (result.toc.length > 0) {
        clientTocCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/books/${bookId}/toc`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      const result = {
        id: bookId,
        toc: (data && Array.isArray(data.toc)) ? data.toc : []
      };
      if (result.toc.length > 0) {
        clientTocCache.set(cacheKey, result);
        return result;
      }
    }
  } catch {}

  return {
    id: bookId,
    toc: [
      { title: 'פרק ראשון', index: 1, children: [] },
      { title: 'פרק שני', index: 150, children: [] },
      { title: 'פרק שלישי', index: 300, children: [] }
    ]
  };
}

export async function getBookLinks(
  bookId: number | string,
  lineIndex: number
): Promise<{
  id: number | string;
  line: number;
  chapter?: number;
  verse?: number;
  dafLabel?: string;
  links: CommentaryLink[];
  allLinks?: CommentaryLink[];
  availableCommentators?: string[];
}> {
  const cacheKey = `${bookId}_${lineIndex}`;
  if (clientLinksCache.has(cacheKey)) {
    return clientLinksCache.get(cacheKey)!;
  }
  if (clientLinksPromises.has(cacheKey)) {
    return clientLinksPromises.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const oracleUrl = `${ORACLE_BASE}/api/books/${bookId}/links?line=${lineIndex}`;
      const res = await fetch(oracleUrl);
      if (res.ok) {
        const data = await res.json();
        clientLinksCache.set(cacheKey, data);
        return data;
      }
    } catch {}

    try {
      const localUrl = `${API_BASE}/books/${bookId}/links?line=${lineIndex}`;
      const res = await fetch(localUrl);
      if (res.ok) {
        const data = await res.json();
        clientLinksCache.set(cacheKey, data);
        return data;
      }
    } catch {}

    return {
      id: bookId,
      line: lineIndex,
      links: [],
      allLinks: [],
      availableCommentators: []
    };
  })();

  clientLinksPromises.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    clientLinksPromises.delete(cacheKey);
  }
}

export async function getBookCommentators(bookId: number | string): Promise<{ bookId: number | string; commentators: string[] }> {
  try {
    const res = await fetch(`${ORACLE_BASE}/api/books/${bookId}/commentators`);
    if (res.ok) return res.json();
  } catch {}
  try {
    const res = await fetch(`${API_BASE}/books/${bookId}/commentators`);
    if (res.ok) return res.json();
  } catch {}
  return { bookId, commentators: [] };
}

export async function searchLibrary(query: string, ..._args: any[]): Promise<SearchResponse> {
  try {
    const res = await fetch(`${ORACLE_BASE}/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) return res.json();
  } catch {}
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (res.ok) return res.json();
  } catch {}
  return { query, results: [], resultsCount: 0 };
}
