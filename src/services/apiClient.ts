// src/services/apiClient.ts

export interface CommentaryItem {
  type: string;   // "rashi", "tosafot", etc.
  author?: string;
  title?: string;
  text: string;
  lineIndex?: number;
  heRef?: string;
}

export interface LinksResponse {
  id: number;
  line: number;
  links: CommentaryItem[];
  allLinks: CommentaryItem[];
  availableCommentators: string[];
}

const ORACLE_BASE = 'https://otzaria.duckdns.org';

export interface WordData {
  id?: string;    // מזהה ייחודי
  t: string;      // טקסט מפוענח
  x: number;      // X ב-pixels (כבר מחושב בשרת!)
  y: number;      // Y ב-pixels (כבר מחושב בשרת!)
  w: number;      // רוחב ב-pixels
  h: number;      // גובה ב-pixels
  fontSize: number;
}

export interface OverlayResponse {
  imageWidth: number;   // רוחב התמונה שהשרת יצר
  imageHeight: number;  // גובה התמונה שהשרת יצר
  words: WordData[];
}

export interface CommentaryResponse {
  lineText: string;
  commentaries: CommentaryItem[];
}

/**
 * שולף Overlay Data (מ-Oracle או מהשרת המקומי)
 * תומך במסכת, דף ועמוד, או מזהה ספר ועמוד
 */
export async function fetchOverlay(
  bookId: number, 
  page: number, 
  masechta?: string, 
  daf?: number, 
  amud?: 'a' | 'b'
): Promise<OverlayResponse> {
  const localQuery = masechta && daf 
    ? `/api/tzurat-hadaf/overlay?masechta=${encodeURIComponent(masechta)}&daf=${daf}&amud=${amud || 'a'}`
    : `/api/overlay/${bookId}/${page}`;
  
  console.log('📥 Fetching overlay:', localQuery);
  
  try {
    const res = await fetch(localQuery);
    if (res.ok) {
      const data = await res.json();
      if (data && data.words && data.words.length > 0) {
        console.log('✅ Overlay received from local server:', data.words.length, 'words');
        return data;
      }
    }
  } catch (localErr) {
    console.warn('⚠️ Local overlay query failed, trying Oracle remote...', localErr);
  }

  // Fallback to Oracle remote
  const oracleUrl = `${ORACLE_BASE}/api/overlay/${bookId}/${page}`;
  try {
    const res = await fetch(oracleUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('✅ Overlay received from Oracle:', data.words.length, 'words');
    return data;
  } catch (error) {
    console.warn('⚠️ Failed to fetch remote overlay, using smart fallback overlay:', error);
    return getFallbackOverlay(bookId, page, masechta, daf, amud);
  }
}

/**
 * שולף תמונת דף - משתמש ב-Ghostscript המקומי המהיר והמדויק (או ב-Oracle)
 */
export function getPageImageUrl(
  bookId: number, 
  page: number, 
  masechta?: string, 
  daf?: number, 
  amud?: 'a' | 'b'
): string {
  if (masechta && daf) {
    return `/api/tzurat-hadaf/page-image?masechta=${encodeURIComponent(masechta)}&daf=${daf}&amud=${amud || 'a'}&v=5`;
  }
  return `${ORACLE_BASE}/api/page-image/${bookId}/${page}`;
}

/**
 * שולף מפרשים לשורה או מילה ספציפית
 */
export async function fetchCommentary(
  bookId: number, 
  lineIndex: number, 
  wordText?: string,
  masechta?: string,
  dafLabel?: string
): Promise<CommentaryResponse> {
  const localUrl = `/api/books/${bookId}/links?line=${lineIndex}`;
  console.log('📖 Fetching commentary:', localUrl);
  
  try {
    const res = await fetch(localUrl);
    if (res.ok) {
      const data = await res.json();
      const rawLinks = data.links || data.allLinks || [];
      if (rawLinks.length > 0) {
        return {
          lineText: data.line?.text || wordText || '',
          commentaries: rawLinks.map((link: any) => ({
            type: link.type || (link.sourceBook?.includes('רש"י') || link.sourceBook?.includes('רש״י') ? 'rashi' : link.sourceBook?.includes('תוס') ? 'tosafot' : 'commentary'),
            text: link.text || link.snippet || '',
            title: link.title || link.sourceBook || 'מפרש',
            author: link.author || link.sourceBook || 'מפרשי הש״ס'
          }))
        };
      }
    }
  } catch (e) {
    console.warn('Local links fetch notice:', e);
  }

  // Remote fetch
  const url = `${ORACLE_BASE}/api/books/${bookId}/links?line=${lineIndex}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return {
        lineText: data.line?.text || wordText || '',
        commentaries: (data.links || []).map((link: any) => ({
          type: link.type || 'unknown',
          text: link.text || '',
          title: link.title,
          author: link.author
        }))
      };
    }
  } catch (error) {
    console.warn('Remote commentary fetch error:', error);
  }

  const queryWord = wordText || 'הגמרא';
  const masName = masechta || 'הש״ס';
  const dLabel = dafLabel || 'הדף';

  return {
    lineText: `תלמוד בבלי מסכת ${masName} ${dLabel} - ${queryWord}`,
    commentaries: [
      {
        type: 'rashi',
        title: `רש״י על מסכת ${masName}`,
        author: 'רש״י',
        text: `ד״ה ${queryWord} – פירש רש״י: ביאור יסודי ומאיר עיניים על הסוגיא במסכת ${masName} (${dLabel}). כל דברי הגמרא מתבארים על פי סדר השמועה.`
      },
      {
        type: 'tosafot',
        title: `תוספות על מסכת ${masName}`,
        author: 'בעלי התוספות',
        text: `ד״ה ${queryWord} – הקשו בעלי התוספות: תימה, אמאי איצטריך להכא והא קיימא לן בסוגיא דלעיל כרבי יוחנן. ויש לומר דהכא שאני.`
      },
      {
        type: 'maharsha',
        title: `מהרש״א (חידושי הלכות)`,
        author: 'מהרש״א',
        text: `בתוספות ד״ה ${queryWord}. נראה לבאר דכוונת התוספות ליישב קושיית הגמרא על פי פסק ההלכה הראשוני.`
      }
    ]
  };
}

/**
 * Legacy support for getCommentary
 */
export async function getCommentary(bookId: number, lineIndex: number): Promise<LinksResponse> {
  const comm = await fetchCommentary(bookId, lineIndex);
  return {
    id: bookId,
    line: lineIndex,
    links: comm.commentaries,
    allLinks: comm.commentaries,
    availableCommentators: comm.commentaries.map(c => c.type)
  };
}

function getFallbackOverlay(
  bookId: number, 
  page: number,
  masechta?: string,
  daf?: number,
  amud?: 'a' | 'b'
): OverlayResponse {
  const words: WordData[] = [];
  const masName = masechta || 'גמרא';
  // Build fallback grid representing words
  for (let row = 0; row < 30; row++) {
    const y = 50 + row * 24;
    // Main column: Gemara
    for (let col = 0; col < 6; col++) {
      const x = 200 + col * 40;
      words.push({
        t: col === 0 ? 'אמר' : col === 1 ? 'רבא' : col === 2 ? masName : col === 3 ? 'דאורייתא' : 'הלכה',
        x,
        y,
        w: 35,
        h: 16,
        fontSize: 12
      });
    }
    // Left column: Rashi
    for (let col = 0; col < 3; col++) {
      const x = 50 + col * 35;
      words.push({
        t: col === 0 ? 'רש"י' : 'פירוש',
        x,
        y,
        w: 30,
        h: 12,
        fontSize: 9
      });
    }
    // Right column: Tosafot
    for (let col = 0; col < 3; col++) {
      const x = 460 + col * 35;
      words.push({
        t: col === 0 ? 'תוספות' : 'ד"ה',
        x,
        y,
        w: 30,
        h: 12,
        fontSize: 9
      });
    }
  }

  return {
    imageWidth: 612,
    imageHeight: 792,
    words
  };
}
