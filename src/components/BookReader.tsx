import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { getBookContent, getBookToc, getBookLinks, getBookCommentators, BookLineData } from '../services/api';
import { TocNode, CommentaryLink, ReaderSettings, BookmarkItem } from '../types/otzaria';
import { stripNikud, numberToHebrew, hebrewToNumber } from '../utils/gematria';
import { sortCommentariesByGeneration } from '../utils/generationOrder';
import { sysLogger } from '../services/logger';
import { TzuratHaDafModal, findShasTractate, parseDafString } from './TzuratHaDafModal';
import {
  List,
  Search,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Share2,
  Copy,
  Layers,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Settings,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal
} from 'lucide-react';

interface BookReaderProps {
  bookId: number | string;
  bookTitle: string;
  initialLine?: number;
  initialSearch?: string;
  initialHighlight?: string;
  settings: ReaderSettings;
  onAddBookmark: (bookmark: Omit<BookmarkItem, 'id' | 'createdAt'>) => void;
  onOpenTzuratHaDafTab?: (bookTitle: string, dafNum?: number, amud?: 'a' | 'b') => void;
}

/**
 * Builds flexible Hebrew regex:
 * - If user typed gershayim/quotes: strict search for that exact term with quotes (normalized)
 * - If user typed without gershayim: allows optional gershayim in the text (e.g. "רמבן" matches "רמב״ן", "רמב"ן", "רמבן")
 */
function buildHebrewSearchRegex(query: string): RegExp | null {
  const rawQ = query.trim();
  if (!rawQ) return null;

  const hasGershayim = /["'״׳]/.test(rawQ);

  if (hasGershayim) {
    const escaped = rawQ
      .split('')
      .map(char => {
        if (/["'״׳]/.test(char)) return '["\'״׳]';
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('');
    return new RegExp(`(${escaped})`, 'gi');
  } else {
    const escaped = rawQ
      .split('')
      .map(char => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\'"״׳]?');
    return new RegExp(`(${escaped})`, 'gi');
  }
}

/**
 * Extracts a snippet containing 5 words before and 5 words after the first search match
 */
function extractSearchSnippet(
  htmlText: string,
  regex: RegExp
): { snippet: string; totalMatches: number; firstMatchIndex: number } {
  const cleanText = htmlText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanText) return { snippet: '', totalMatches: 0, firstMatchIndex: -1 };

  const words = cleanText.split(' ');
  let firstMatchWordIdx = -1;
  let matchCount = 0;

  for (let i = 0; i < words.length; i++) {
    regex.lastIndex = 0;
    if (regex.test(words[i])) {
      matchCount++;
      if (firstMatchWordIdx === -1) {
        firstMatchWordIdx = i;
      }
    }
  }

  if (firstMatchWordIdx === -1) {
    const defaultWords = words.slice(0, 11);
    return {
      snippet: defaultWords.join(' ') + (words.length > 11 ? '...' : ''),
      totalMatches: 0,
      firstMatchIndex: -1
    };
  }

  const startIdx = Math.max(0, firstMatchWordIdx - 5);
  const endIdx = Math.min(words.length, firstMatchWordIdx + 6);

  const snippetWords = words.slice(startIdx, endIdx);
  let snippet = snippetWords.join(' ');

  if (startIdx > 0) snippet = '...' + snippet;
  if (endIdx < words.length) snippet = snippet + '...';

  return {
    snippet,
    totalMatches: matchCount,
    firstMatchIndex: firstMatchWordIdx
  };
}

function highlightSearchText(content: string, regex: RegExp | null): string {
  if (!regex || !content) return content;
  regex.lastIndex = 0;
  return content.replace(
    regex,
    '<mark class="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">$1</mark>'
  );
}

function flattenTocNodes(nodes: TocNode[]): TocNode[] {
  let result: TocNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTocNodes(node.children));
    }
  }
  return result;
}

function resolveActualBookLine(
  node: TocNode,
  allTocNodes: TocNode[],
  bookLines: BookLineData[],
  totalBookLines?: number
): number {
  const total = totalBookLines || 0;
  const rawIdx = node.index;

  // 1. If rawIdx already fits inside the book (1 <= rawIdx <= total), it's a valid local line index!
  if (total > 0 && rawIdx >= 1 && rawIdx <= total) {
    return rawIdx;
  }

  // 2. Try to find the exact heading line in bookLines by node.title
  if (node.title && bookLines && bookLines.length > 0) {
    const cleanTitle = stripNikud(node.title).replace(/[-"'\״\׳:;,.]/g, ' ').trim().toLowerCase();
    const headingMatch = bookLines.find(l => {
      if (!l.content) return false;
      const cleanContent = stripNikud(l.content).replace(/[-"'\״\׳:;,.]/g, ' ').trim().toLowerCase();
      return cleanContent === cleanTitle || cleanContent.includes(cleanTitle) || cleanTitle.includes(cleanContent);
    });
    if (headingMatch) {
      return headingMatch.lineIndex;
    }
  }

  // 3. If rawIdx is a large global line.id, estimate position proportionally from TOC position
  if (total > 0 && allTocNodes.length > 1) {
    const flat = flattenTocNodes(allTocNodes);
    const nodeIdx = flat.findIndex(n => n.index === rawIdx || n.title === node.title);
    if (nodeIdx >= 0) {
      const estimated = Math.round((nodeIdx / (flat.length - 1)) * (total - 1)) + 1;
      return Math.max(1, Math.min(total, estimated));
    }
  }

  // Fallback: clamp to valid book bounds
  if (total > 0 && rawIdx > total) {
    return Math.min(total, Math.max(1, rawIdx % total || 1));
  }

  return Math.max(1, rawIdx || 1);
}

/**
 * Resolves exact Talmud Daf & Amud for any line in a Talmud book.
 * Handles cases where initial TOC entries (e.g. Daf 2-4) might share the same line index
 * or where Daf 5 was erroneously matched for early pages.
 */
function resolveTalmudDafForLine(
  targetLineIndex: number,
  tocList: TocNode[],
  bookLines?: BookLineData[],
  allProcessedLines?: Array<{ index: number; rawText: string; isHeading: boolean; headingText: string }>
): { dafNum: number; amud: 'a' | 'b'; dafLabel: string } | null {
  if (!targetLineIndex || targetLineIndex < 1) return null;

  // 1. Check allProcessedLines backwards first (highest fidelity - actual text headings in book)
  if (allProcessedLines && allProcessedLines.length > 0) {
    for (let i = allProcessedLines.length - 1; i >= 0; i--) {
      const line = allProcessedLines[i];
      if (line.index > targetLineIndex) continue;

      const text = line.rawText || line.headingText || '';
      const dotColonMatch = text.match(/דף\s+([א-ת]+)([\.:])/i);
      if (dotColonMatch) {
        const num = hebrewToNumber(dotColonMatch[1]);
        if (num >= 2) {
          const amud: 'a' | 'b' = dotColonMatch[2] === ':' ? 'b' : 'a';
          const dafLabel = `דף ${numberToHebrew(num)} ע״${amud === 'a' ? 'א' : 'ב'}`;
          return { dafNum: num, amud, dafLabel };
        }
      }

      const wordMatch = text.match(/דף\s+([א-ת]+)\s*(?:ע[״"']?([אב])|עמוד\s*([אב]|ראשון|שני)|[,/]\s*([אב]))/i);
      if (wordMatch) {
        const num = hebrewToNumber(wordMatch[1]);
        if (num >= 2) {
          const amudPart = wordMatch[2] || wordMatch[3] || wordMatch[4] || 'א';
          const amud: 'a' | 'b' = (amudPart.includes('ב') || amudPart.includes('שני')) ? 'b' : 'a';
          const dafLabel = `דף ${numberToHebrew(num)} ע״${amud === 'a' ? 'א' : 'ב'}`;
          return { dafNum: num, amud, dafLabel };
        }
      }
    }
  }

  // 2. Scan raw book lines if provided
  if (bookLines && bookLines.length > 0) {
    for (let i = bookLines.length - 1; i >= 0; i--) {
      const l = bookLines[i];
      if (l.lineIndex > targetLineIndex) continue;
      const text = l.content || '';
      const dotColonMatch = text.match(/דף\s+([א-ת]+)([\.:])/i);
      if (dotColonMatch) {
        const num = hebrewToNumber(dotColonMatch[1]);
        if (num >= 2) {
          const amud: 'a' | 'b' = dotColonMatch[2] === ':' ? 'b' : 'a';
          const dafLabel = `דף ${numberToHebrew(num)} ע״${amud === 'a' ? 'א' : 'ב'}`;
          return { dafNum: num, amud, dafLabel };
        }
      }
    }
  }

  // 3. Check TOC with monotonic ordering & boundary protection
  if (tocList && tocList.length > 0) {
    const flatNodes = flattenTocNodes(tocList);
    const dafEntries: Array<{ node: TocNode; parsed: { dafNum: number; amud: 'a' | 'b' }; effectiveIndex: number }> = [];

    let runningIndex = 1;
    for (const node of flatNodes) {
      if (!node.title) continue;
      const isDaf = /דף\s+[א-ת0-9]+|^[א-ת]{1,3}[\.:]/i.test(node.title);
      if (isDaf) {
        const parsed = parseDafString(node.title, 2, 180);
        if (parsed.dafNum >= 2) {
          // Guarantee strictly increasing index so later dappim (like Daf 5) never shadow earlier ones (Daf 2-4)
          const nodeIdx = node.index && node.index > 0 ? node.index : runningIndex;
          const effectiveIndex = Math.max(runningIndex, nodeIdx);
          runningIndex = effectiveIndex + 1;
          dafEntries.push({ node, parsed, effectiveIndex: node.index || runningIndex });
        }
      }
    }

    if (dafEntries.length > 0) {
      // Find the last daf entry whose starting line <= targetLineIndex
      let bestEntry = dafEntries[0];
      for (const entry of dafEntries) {
        if (entry.effectiveIndex <= targetLineIndex) {
          bestEntry = entry;
        } else {
          break;
        }
      }

      // If user is in the very first lines of the tractate (e.g. lines 1-15), force first daf (דף ב ע״א)
      if (targetLineIndex <= 15 && dafEntries[0].parsed.dafNum === 2) {
        bestEntry = dafEntries[0];
      }

      const dafHebrew = numberToHebrew(bestEntry.parsed.dafNum);
      const dafLabel = `דף ${dafHebrew} ע״${bestEntry.parsed.amud === 'a' ? 'א' : 'ב'}`;
      return { dafNum: bestEntry.parsed.dafNum, amud: bestEntry.parsed.amud, dafLabel };
    }
  }

  // Fallback for beginning of any Talmud tractate
  if (targetLineIndex <= 30) {
    return { dafNum: 2, amud: 'a', dafLabel: 'דף ב ע״א' };
  }

  return null;
}

function findTargetLineForQuery(
  query: string,
  tocList: TocNode[],
  bookLines: BookLineData[],
  totalBookLines?: number
): number | null {
  if (!query) return null;

  const clean = (s: string) =>
    stripNikud(s)
      .replace(/[-"'\״\׳:;,.]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const cleanTarget = clean(query);
  if (!cleanTarget) return null;

  // Extract high-specificity structural tokens (e.g. "כלל ב", "דף יב", "פרק א", "סימן א", "סעיף א")
  const specificMatches = cleanTarget.match(/(כלל\s+[א-ת]+|דף\s+[א-ת]+(?:\s+[א-ב])?|סימן\s+[א-ת]+|פרק\s+[א-ת]+|סעיף\s+[א-ת]+|שער\s+[א-ת]+)/gi);
  const primarySpecificToken = specificMatches && specificMatches[0] ? clean(specificMatches[0]) : null;

  // Extract pure Daf letters (e.g., "יב" from "דף יב")
  const dafTokenMatch = cleanTarget.match(/דף\s+([א-ת]+)/);
  const dafLetters = dafTokenMatch ? dafTokenMatch[1] : null;

  // 1. FIRST PRIORITY: Search in complete Table of Contents (TOC) across whole book
  if (tocList && tocList.length > 0) {
    const flatNodes = flattenTocNodes(tocList);
    let chosenNode: TocNode | null = null;
    let bestScore = 0;
    let bestNodeIndexInList = -1;

    flatNodes.forEach((node, i) => {
      if (!node.title) return;
      const cleanTitle = clean(node.title);
      const rawTitle = (node.title || '').trim();
      let score = 0;

      // Exact title match
      if (cleanTitle === cleanTarget) {
        score = 250;
      }
      // Daf Yomi specific matching (supports "דף יב.", "דף יב:", "יב.", "יב:", "דף יב", "יב")
      else if (dafLetters) {
        if (cleanTitle === `דף ${dafLetters}` || cleanTitle === `דף ${dafLetters} א` || cleanTitle === `דף ${dafLetters} עא`) {
          score = 220;
        } else if (rawTitle.startsWith(`${dafLetters}.`) || rawTitle.startsWith(`דף ${dafLetters}.`) || rawTitle.startsWith(`${dafLetters}:`)) {
          score = 210;
        } else if (cleanTitle === dafLetters) {
          score = 200;
        } else if (cleanTitle.startsWith(`דף ${dafLetters}`) || cleanTitle.includes(` ${dafLetters} `)) {
          score = 160;
        }
      }
      // Exact structural token match (e.g. "כלל ב" in "הלכות לשון הרע כלל ב")
      else if (primarySpecificToken && cleanTitle.includes(primarySpecificToken)) {
        score = 180;
        // Bonus if topic also matches (e.g. "לשון הרע" vs "רכילות")
        if (cleanTarget.includes('רכילות') && cleanTitle.includes('רכילות')) score += 40;
        if (cleanTarget.includes('לשון הרע') && cleanTitle.includes('לשון הרע')) score += 40;
      }
      // Substring match
      else if (cleanTitle.includes(cleanTarget) || cleanTarget.includes(cleanTitle)) {
        score = 90;
      }

      if (score > bestScore && score >= 90) {
        bestScore = score;
        chosenNode = node;
        bestNodeIndexInList = i;
      }
    });

    if (chosenNode) {
      const nodeObj: TocNode = chosenNode;
      const rawIdx = nodeObj.index;
      const total = totalBookLines || 0;

      if (total > 0 && rawIdx <= total && rawIdx >= 1) {
        return rawIdx;
      }

      // If rawIdx is an unmapped global ID, estimate position proportionally from TOC index
      if (total > 0 && flatNodes.length > 1 && bestNodeIndexInList >= 0) {
        const estimatedLine = Math.round((bestNodeIndexInList / (flatNodes.length - 1)) * (total - 1)) + 1;
        return Math.max(1, Math.min(total, estimatedLine));
      }

      return total > 0 ? Math.min(total, Math.max(1, rawIdx)) : rawIdx;
    }
  }

  // 2. SECOND PRIORITY: Search in loaded book lines (only for specific section tokens or headings)
  if (bookLines && bookLines.length > 0) {
    const searchToken = primarySpecificToken || cleanTarget;
    if (searchToken && searchToken.length >= 3) {
      for (const line of bookLines) {
        if (!line.content) continue;
        const cleanLine = clean(line.content);
        // Only match if line starts with the token or is an HTML heading
        const isHtmlHeading = line.content.trim().startsWith('<h');
        if (cleanLine.startsWith(searchToken) || cleanLine.includes(` ${searchToken} `) || (isHtmlHeading && cleanLine.includes(searchToken))) {
          return line.lineIndex;
        }
      }
    }
  }

  return null;
}

export const BookReader: React.FC<BookReaderProps> = ({
  bookId,
  bookTitle,
  initialLine,
  initialSearch,
  initialHighlight,
  settings,
  onAddBookmark,
  onOpenTzuratHaDafTab
}) => {
  const [content, setContent] = useState<string>('');
  const [bookLines, setBookLines] = useState<BookLineData[]>([]);
  const [totalBookLines, setTotalBookLines] = useState<number>(0);
  const [toc, setToc] = useState<TocNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Shared text fragment highlight state (from deep link)
  const [highlightedPhrase, setHighlightedPhrase] = useState<string | undefined>(initialHighlight);

  // Floating text selection share popover
  const [textSharePopover, setTextSharePopover] = useState<{
    lineIndex: number;
    selectedText: string;
    coords: { x: number; y: number };
  } | null>(null);
  const [shareLinkCopiedLine, setShareLinkCopiedLine] = useState<number | null>(null);
  const [shareToastMessage, setShareToastMessage] = useState<string | null>(null);

  const CHUNK_SIZE = 150;
  const [startLineIndex, setStartLineIndex] = useState<number>(1);
  const [endLineIndex, setEndLineIndex] = useState<number>(CHUNK_SIZE);
  const loadedLineRangesRef = useRef<Set<number>>(new Set());
  const isLoadingMoreRef = useRef<boolean>(false);

  // Panels state
  const [showTocPanel, setShowTocPanel] = useState<boolean>(false);
  const [showCommentaryPanel, setShowCommentaryPanel] = useState<boolean>(true);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(initialLine || null);
  const [commentaries, setCommentaries] = useState<CommentaryLink[]>([]);
  const [allCommentaries, setAllCommentaries] = useState<CommentaryLink[]>([]);
  const [selectedVerseInfo, setSelectedVerseInfo] = useState<{ chapter?: number; verse?: number; dafLabel?: string } | null>(null);
  const [inBookSearch, setInBookSearch] = useState<string>('');
  const [showInBookSearchBox, setShowInBookSearchBox] = useState<boolean>(false);
  const [locationNavMessage, setLocationNavMessage] = useState<string | null>(null);
  const initialNavDoneRef = useRef<boolean>(false);
  const [searchMatchIndices, setSearchMatchIndices] = useState<number[]>([]);
  const [currentMatchPointer, setCurrentMatchPointer] = useState<number>(0);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);

  // Commentary panel enhancements (collapse, filtering, user preferences)
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [showCommentarySettings, setShowCommentarySettings] = useState<boolean>(false);
  const [availableBookCommentators, setAvailableBookCommentators] = useState<string[]>([]);
  const [commentatorSearchFilter, setCommentatorSearchFilter] = useState<string>('');
  const [commentaryContentQuery, setCommentaryContentQuery] = useState<string>('');
  const [searchViewMode, setSearchViewMode] = useState<'partial' | 'fully_collapsed' | 'fully_expanded'>('partial');
  const [expandedDuringSearch, setExpandedDuringSearch] = useState<Record<string, boolean>>({});
  const [enabledCommentaryCategories, setEnabledCommentaryCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`otzaria_comm_prefs_${bookTitle}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reader typography settings
  const [fontSize, setFontSize] = useState<number>(settings.fontSize || 20);
  const [showNikud, setShowNikud] = useState<boolean>(settings.showNikud ?? true);

  // Tzurat HaDaf modal state
  const [isTzuratHaDafOpen, setIsTzuratHaDafOpen] = useState<boolean>(false);
  const isShasBook = useMemo(() => findShasTractate(bookTitle) !== null, [bookTitle]);

  // Responsive mobile detection & Inline Commentary configuration
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync initialHighlight if prop changes
  useEffect(() => {
    if (initialHighlight) {
      setHighlightedPhrase(initialHighlight);
    }
  }, [initialHighlight]);

  // Listen to text selection inside reader lines to display the floating share button
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setTextSharePopover(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < 2) {
        setTextSharePopover(null);
        return;
      }

      const anchor = selection.anchorNode;
      const anchorEl = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      const lineEl = anchorEl?.closest('[id^="reader-line-"]');

      if (lineEl) {
        const match = lineEl.id.match(/^reader-line-(\d+)$/);
        if (match) {
          const lineIdx = parseInt(match[1], 10);
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            setTextSharePopover({
              lineIndex: lineIdx,
              selectedText: text,
              coords: {
                x: Math.max(50, rect.left + rect.width / 2),
                y: Math.max(35, rect.top - 8)
              }
            });
          } catch {
            setTextSharePopover(null);
          }
          return;
        }
      }

      setTextSharePopover(null);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const isInlineCommentary =
    settings.commentaryViewMode === 'inline' ||
    (settings.commentaryViewMode !== 'side_panel' && isMobile);

  const linesContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingLoadingRef = useRef<boolean>(false);
  const lastInitialLineRef = useRef<number | null>(null);
  const pendingTopScrollAdjustRef = useRef<{
    prevScrollHeight: number;
    prevScrollTop: number;
    anchorId: string | null;
    anchorOffsetTop: number;
  } | null>(null);

  // Synchronously restore scroll position before browser paints when new top lines are prepended
  useLayoutEffect(() => {
    if (pendingTopScrollAdjustRef.current && linesContainerRef.current) {
      const { prevScrollHeight, prevScrollTop, anchorId, anchorOffsetTop } = pendingTopScrollAdjustRef.current;
      pendingTopScrollAdjustRef.current = null;

      const container = linesContainerRef.current;
      
      if (anchorId) {
        const anchorElem = document.getElementById(anchorId);
        if (anchorElem) {
          container.scrollTop = anchorElem.offsetTop - anchorOffsetTop;
        } else {
          const heightDiff = container.scrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + heightDiff;
        }
      } else {
        const heightDiff = container.scrollHeight - prevScrollHeight;
        container.scrollTop = prevScrollTop + heightDiff;
      }

      setTimeout(() => {
        isScrollingLoadingRef.current = false;
        isLoadingMoreRef.current = false;
      }, 150);
    }
  }, [bookLines, startLineIndex]);

  // Load initial 150 lines instantly (<10KB), while TOC and commentators load in background
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loadedLineRangesRef.current.clear();
    sysLogger.addLog('info', 'BookReader', `פתיחת ספר לקריאה מיידית: "${bookTitle}" (מזהה: ${bookId})`);

    const targetLine = initialLine || 1;
    const initialStart = Math.max(1, targetLine - 20);
    const initialEnd = initialStart + CHUNK_SIZE;

    // 1. Fetch content lines first - makes text appear in 10ms
    getBookContent(bookId, initialStart, initialEnd)
      .then(contentData => {
        if (!isMounted) return;
        const fetchedLines = contentData.lines || [];
        setBookLines(fetchedLines);
        fetchedLines.forEach(l => loadedLineRangesRef.current.add(l.lineIndex));

        const total = contentData.totalLines || fetchedLines.length || 1;
        setTotalBookLines(total);
        setIsLoading(false);
        setStartLineIndex(initialStart);
        setEndLineIndex(Math.min(total, initialEnd));
        sysLogger.addLog(
          'success',
          'BookReader',
          `הספר "${bookTitle}" נפתח מיידית! נטענו ${fetchedLines.length} שורות ראשונות מתוך ${total}`
        );
      })
      .catch(err => {
        if (isMounted) setIsLoading(false);
        sysLogger.addLog('error', 'BookReader', `שגיאה בטעינת הספר "${bookTitle}": ${err.message}`);
      });

    // 2. Fetch TOC in background
    getBookToc(bookId)
      .then(tocData => {
        if (isMounted && tocData && tocData.toc && tocData.toc.length > 0) {
          setToc(tocData.toc);
        }
      })
      .catch(() => {});

    // 3. Fetch Commentators in background
    getBookCommentators(bookId)
      .then(commData => {
        if (isMounted && commData && commData.commentators) {
          setAvailableBookCommentators(commData.commentators);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [bookId, bookTitle]);

  // Fallback: If TOC is empty, automatically extract chapters/headings from loaded lines
  useEffect(() => {
    if (toc.length === 0 && bookLines.length > 0) {
      const extracted: TocNode[] = [];
      const seenTitles = new Set<string>();

      bookLines.forEach(l => {
        const trimmed = (l.content || '').trim();
        const headingMatch = trimmed.match(/^<h([1-6])(?:\s+[^>]*)?>(.*?)<\/h\1>$/i);
        if (headingMatch) {
          const title = headingMatch[2].replace(/<[^>]+>/g, '').trim();
          if (title && title !== bookTitle && !seenTitles.has(title)) {
            seenTitles.add(title);
            extracted.push({
              title,
              index: l.lineIndex,
              level: parseInt(headingMatch[1], 10) || 1
            });
          }
        } else {
          const chapMatch = trimmed.match(/^(?:פרק|סימן|דף|כלל)\s+([א-ת]+(?:\s+[א-ת]+)?)/i);
          if (chapMatch) {
            const title = chapMatch[0];
            if (!seenTitles.has(title)) {
              seenTitles.add(title);
              extracted.push({
                title,
                index: l.lineIndex,
                level: 1
              });
            }
          }
        }
      });

      if (extracted.length > 0) {
        setToc(extracted);
      }
    }
  }, [bookLines, toc.length, bookTitle]);

  // Fetch more lines on demand (returns true if lines loaded or already present)
  const fetchLineRange = async (start: number, end: number): Promise<boolean> => {
    if (isLoadingMoreRef.current) return false;
    isLoadingMoreRef.current = true;
    try {
      const data = await getBookContent(bookId, start, end);
      if (data.lines && data.lines.length > 0) {
        setBookLines(prev => {
          const map = new Map<number, BookLineData>();
          prev.forEach(l => map.set(l.lineIndex, l));
          data.lines!.forEach(l => {
            map.set(l.lineIndex, l);
            loadedLineRangesRef.current.add(l.lineIndex);
          });
          return Array.from(map.values()).sort((a, b) => a.lineIndex - b.lineIndex);
        });
      }
      if (data.totalLines) {
        setTotalBookLines(data.totalLines);
      }
      return true;
    } catch (err: any) {
      console.warn('Failed to fetch line range:', err.message);
      return false;
    } finally {
      isLoadingMoreRef.current = false;
    }
  };

  // Load commentaries for a line
  const loadLineCommentaries = async (lineIdx: number) => {
    try {
      const data = await getBookLinks(bookId, lineIdx);
      const fullList = data.allLinks || data.links;
      const lineMatches = data.links;
      setAllCommentaries(fullList);
      setCommentaries(lineMatches);
      if (data.availableCommentators && data.availableCommentators.length > 0) {
        setAvailableBookCommentators(prev => Array.from(new Set([...prev, ...data.availableCommentators!])));
      }

      const hasMeaningfulDaf = data.dafLabel && !/^\d+$/.test(data.dafLabel) && !data.dafLabel.startsWith('שורה');
      if (hasMeaningfulDaf) {
        setSelectedVerseInfo({ chapter: data.chapter, verse: data.verse, dafLabel: data.dafLabel });
      } else {
        const resolvedDaf = isShasBook ? resolveTalmudDafForLine(lineIdx, toc, bookLines, allProcessedLines) : null;
        if (resolvedDaf) {
          setSelectedVerseInfo({ chapter: data.chapter, verse: data.verse, dafLabel: resolvedDaf.dafLabel });
        } else if (data.chapter || data.verse) {
          setSelectedVerseInfo({ chapter: data.chapter, verse: data.verse });
        } else {
          setSelectedVerseInfo(null);
        }
      }
    } catch (err) {
      console.error('Failed to load line commentaries', err);
    }
  };

  const handleLineClick = (idx: number) => {
    if (selectedLineIndex === idx && isInlineCommentary && showCommentaryPanel) {
      setShowCommentaryPanel(false);
      return;
    }
    setSelectedLineIndex(idx);
    if (isShasBook) {
      const resolvedDaf = resolveTalmudDafForLine(idx, toc, bookLines, allProcessedLines);
      if (resolvedDaf) {
        setSelectedVerseInfo({ dafLabel: resolvedDaf.dafLabel });
      }
    }
    loadLineCommentaries(idx);
    setShowCommentaryPanel(true);
    sysLogger.addLog('info', 'BookReader', `בחירת שורה ${idx} בספר "${bookTitle}"`);
  };

  const scrollToLine = async (lineIdx: number, snapWindow = true) => {
    if (!lineIdx || lineIdx < 1) return;
    
    const targetLine = Math.max(1, Math.round(lineIdx));

    // Prevent scroll event thrashing during jump
    isScrollingLoadingRef.current = true;
    setSelectedLineIndex(targetLine);
    loadLineCommentaries(targetLine);

    const newStart = Math.max(1, targetLine - 15);
    const newEnd = newStart + CHUNK_SIZE + 20;

    // 1. Fetch lines FIRST if not already in memory
    const isLineLoaded = loadedLineRangesRef.current.has(targetLine);
    if (!isLineLoaded) {
      await fetchLineRange(newStart, newEnd);
    }

    // 2. Update start and end line indices so DOM renders the exact chunk with target line
    setStartLineIndex(newStart);
    setEndLineIndex(newEnd);

    // 3. Scroll container smoothly & reliably with retry for DOM render readiness
    let attempts = 0;
    const tryScroll = () => {
      const elem = document.getElementById(`reader-line-${targetLine}`);
      if (elem) {
        elem.scrollIntoView({ block: 'start', behavior: 'auto' });
        setTimeout(() => {
          isScrollingLoadingRef.current = false;
        }, 150);
      } else if (attempts < 8) {
        attempts++;
        setTimeout(tryScroll, 35);
      } else {
        isScrollingLoadingRef.current = false;
      }
    };

    requestAnimationFrame(() => {
      setTimeout(tryScroll, 20);
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const total = totalBookLines || 35000;
    if (isLoadingMoreRef.current || isScrollingLoadingRef.current) return;

    // Predictive forward loading: when approaching within ~800px (~20-25 lines) of the bottom of loaded content
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 800) {
      const nextStart = endLineIndex + 1;
      const nextEnd = nextStart + CHUNK_SIZE;
      setEndLineIndex(nextEnd);
      fetchLineRange(nextStart, nextEnd);
    }

    // Predictive backward loading: when approaching within ~800px (~20-25 lines) of the top of loaded content
    if (target.scrollTop <= 800 && startLineIndex > 1) {
      loadPreviousLines();
    }
  };

  const loadPreviousLines = async () => {
    if (startLineIndex <= 1 || isLoadingMoreRef.current || isScrollingLoadingRef.current) return;
    const container = linesContainerRef.current;
    if (!container) return;

    isScrollingLoadingRef.current = true;
    isLoadingMoreRef.current = true;

    // Find the first line element that is currently visible in the container viewport
    const lineElements = container.querySelectorAll('[id^="reader-line-"]');
    let anchorId: string | null = null;
    let anchorOffsetTop = 0;

    for (let i = 0; i < lineElements.length; i++) {
      const el = lineElements[i] as HTMLElement;
      if (el.offsetTop + el.offsetHeight >= container.scrollTop) {
        anchorId = el.id;
        anchorOffsetTop = el.offsetTop - container.scrollTop;
        break;
      }
    }

    pendingTopScrollAdjustRef.current = {
      prevScrollHeight: container.scrollHeight,
      prevScrollTop: container.scrollTop,
      anchorId,
      anchorOffsetTop
    };

    const prevStart = Math.max(1, startLineIndex - CHUNK_SIZE);
    const prevEnd = startLineIndex - 1;

    try {
      const data = await getBookContent(bookId, prevStart, prevEnd);
      if (data.lines && data.lines.length > 0) {
        setBookLines(prev => {
          const map = new Map<number, BookLineData>();
          prev.forEach(l => map.set(l.lineIndex, l));
          data.lines!.forEach(l => {
            map.set(l.lineIndex, l);
            loadedLineRangesRef.current.add(l.lineIndex);
          });
          return Array.from(map.values()).sort((a, b) => a.lineIndex - b.lineIndex);
        });
      }
      if (data.totalLines) {
        setTotalBookLines(data.totalLines);
      }
      setStartLineIndex(prevStart);
    } catch (err: any) {
      console.warn('Failed to fetch previous lines:', err.message);
      pendingTopScrollAdjustRef.current = null;
      isScrollingLoadingRef.current = false;
      isLoadingMoreRef.current = false;
    }
  };

  // Automatically scroll when initialLine prop changes or when content finishes loading
  useEffect(() => {
    if (initialLine && !isLoading && content) {
      if (lastInitialLineRef.current !== initialLine) {
        lastInitialLineRef.current = initialLine;
        scrollToLine(initialLine, true);
      }
    } else if (!isLoading && content && !selectedLineIndex) {
      loadLineCommentaries(1);
    }
  }, [initialLine, isLoading, content]);

  // Smart Navigation to initial position (e.g. from Daily Study "כלל א", "דף ב ע״א", "פרק א")
  useEffect(() => {
    if (!initialSearch || initialNavDoneRef.current || isLoading) return;

    const targetLine = findTargetLineForQuery(initialSearch, toc, bookLines, totalBookLines);
    if (targetLine && targetLine > 0) {
      initialNavDoneRef.current = true;
      scrollToLine(targetLine, true);
      setLocationNavMessage(`קפצת למיקום הלימוד: "${initialSearch}"`);
      sysLogger.addLog('info', 'BookReader', `ניווט חכם למיקום "${initialSearch}" (שורה ${targetLine} בספר "${bookTitle}")`);
    }
  }, [initialSearch, toc, bookLines, isLoading, totalBookLines, bookId]);

  // Compute in-book search matches when search text changes
  useEffect(() => {
    const q = stripNikud(inBookSearch).trim().toLowerCase();
    if (!q || !content) {
      setSearchMatchIndices([]);
      setCurrentMatchPointer(0);
      return;
    }

    const rawLinesList = content.split('\n');
    const matches: number[] = [];

    rawLinesList.forEach((line, idx) => {
      const cleanLine = stripNikud(line).toLowerCase();
      if (cleanLine.includes(q)) {
        matches.push(idx + 1); // 1-based index
      }
    });

    setSearchMatchIndices(matches);
    setCurrentMatchPointer(0);

    sysLogger.addLog(
      'info',
      'BookReader',
      `חיפוש בתוך הספר "${bookTitle}": "${inBookSearch}" - נמצאו ${matches.length} תוצאות`
    );

    if (matches.length > 0) {
      scrollToLine(matches[0]);
    }
  }, [inBookSearch, content, bookTitle]);

  const handleNextSearchMatch = () => {
    if (searchMatchIndices.length === 0) return;
    const nextPtr = (currentMatchPointer + 1) % searchMatchIndices.length;
    setCurrentMatchPointer(nextPtr);
    scrollToLine(searchMatchIndices[nextPtr]);
  };

  const handlePrevSearchMatch = () => {
    if (searchMatchIndices.length === 0) return;
    const prevPtr = (currentMatchPointer - 1 + searchMatchIndices.length) % searchMatchIndices.length;
    setCurrentMatchPointer(prevPtr);
    scrollToLine(searchMatchIndices[prevPtr]);
  };

  const handleCopyLine = (text: string, idx: number) => {
    const clean = text.replace(/<[^>]+>/g, '').trim();
    let copiedString = clean;

    const includeHeader = settings.copyIncludeHeader || 'always';
    if (includeHeader !== 'never') {
      const format = settings.copyHeaderFormat || 'title_and_ref';
      if (format === 'title_only') {
        copiedString = `${bookTitle}:\n${clean}`;
      } else if (format === 'full_path') {
        copiedString = `אוצריא > ${bookTitle} (שורה ${idx}):\n${clean}`;
      } else {
        copiedString = `${bookTitle} (${numberToHebrew(idx)}):\n${clean}`;
      }
    }

    navigator.clipboard.writeText(copiedString).catch(() => {});
    setCopiedLine(idx);
    sysLogger.addLog('info', 'BookReader', `הועתקה שורה ${idx} מתוך "${bookTitle}"`);
    setTimeout(() => setCopiedLine(null), 1500);
  };

  const handleBookmarkCurrentLine = (lineIdx: number, text: string) => {
    const clean = text.replace(/<[^>]+>/g, '').trim();
    onAddBookmark({
      bookId,
      bookTitle,
      lineIndex: lineIdx,
      snippet: clean.slice(0, 100)
    });
    sysLogger.addLog('success', 'BookReader', `נוספה סימניה בשורה ${lineIdx} בספר "${bookTitle}"`);
  };

  // Share direct deep link to this line or selected text snippet
  const handleShareTextFragment = (lineIdx: number, textToShare?: string) => {
    const rawSnippet = textToShare || textSharePopover?.selectedText || '';
    const cleanSnippet = rawSnippet.replace(/<[^>]+>/g, '').trim();

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('book', String(bookId));
    url.searchParams.set('line', String(lineIdx));
    if (cleanSnippet) {
      url.searchParams.set('highlight', cleanSnippet);
    }

    const fullUrl = url.toString() + (cleanSnippet ? `#:~:text=${encodeURIComponent(cleanSnippet)}` : '');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).catch(() => {});
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setShareLinkCopiedLine(lineIdx);
      setShareToastMessage('הקישור לקטע הטקסט הועתק בהצלחה ללוח!');
      sysLogger.addLog('info', 'BookReader', `נוצר קישור ישיר לטקסט: "${cleanSnippet.slice(0, 30)}..." (שורה ${lineIdx})`);

      setTimeout(() => {
        setShareLinkCopiedLine(null);
        setShareToastMessage(null);
        setTextSharePopover(null);
      }, 2500);
    } catch (err) {
      console.error('Failed to copy direct link:', err);
    }
  };

  // Accurately highlights a shared snippet within line HTML text, accounting for nikud and tags
  const highlightSnippetInText = (htmlText: string, phraseToHighlight: string): string => {
    const cleanPhrase = phraseToHighlight.trim();
    if (!cleanPhrase || cleanPhrase.length < 1) return htmlText;

    if (htmlText.includes('otzaria-shared-highlight')) return htmlText;

    try {
      const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const directRegex = new RegExp(`(${escaped})`, 'gi');
      if (directRegex.test(htmlText)) {
        return htmlText.replace(
          directRegex,
          '<mark class="otzaria-shared-highlight bg-amber-300 dark:bg-amber-500/80 text-amber-950 dark:text-stone-950 px-1 py-0.5 rounded shadow-xs font-semibold ring-2 ring-amber-400/90 transition-all duration-300">$1</mark>'
        );
      }

      const unpointed = stripNikud(cleanPhrase);
      if (unpointed && unpointed.length > 1) {
        const pattern = unpointed
          .split('')
          .map(c => {
            if (/[\u0590-\u05FF]/.test(c)) {
              return c + '[\\u0591-\\u05C7]*';
            }
            if (/\s+/.test(c)) {
              return '\\s+';
            }
            return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('');
        const nikudRegex = new RegExp(`(${pattern})`, 'gi');
        if (nikudRegex.test(htmlText)) {
          return htmlText.replace(
            nikudRegex,
            '<mark class="otzaria-shared-highlight bg-amber-300 dark:bg-amber-500/80 text-amber-950 dark:text-stone-950 px-1 py-0.5 rounded shadow-xs font-semibold ring-2 ring-amber-400/90 transition-all duration-300">$1</mark>'
          );
        }
      }
    } catch (err) {
      console.warn('highlightSnippetInText notice:', err);
    }

    return htmlText;
  };

  // Helper to sanitize and format Otzaria HTML tags and apply text display policies
  const renderFormattedText = (rawText: string) => {
    let text = rawText;

    // 1. Process nikud according to policy
    const policy = settings.nikudPolicy || (showNikud ? 'all' : 'none');
    if (policy === 'none' || (!showNikud && policy !== 'tanakh_only')) {
      text = stripNikud(text);
    }

    // 2. Process Teamim (cantillation marks: \u0591-\u05AF)
    if (settings.showTeamim === false) {
      text = text.replace(/[\u0591-\u05AF]/g, '');
    }

    // 3. Process Punctuation
    if (settings.showPunctuation === false) {
      text = text.replace(/[׃׀]/g, ' ');
    }

    // 4. Holy Name Replacement (שם הוי"ה)
    const replacement = settings.holyNameReplacement || "ה'";
    if (replacement !== 'יהוה') {
      text = text.replace(/(?:יהוה|יְהֹוָה|יְהוָה)/g, replacement);
    }

    // Clean specific Otzaria markers if needed, or leave formatting
    text = text.replace(/&thinsp;/g, ' ').replace(/&nbsp;/g, ' ');

    // 5. Highlight shared deep-link text snippet if active
    if (highlightedPhrase && highlightedPhrase.trim()) {
      text = highlightSnippetInText(text, highlightedPhrase);
    }

    // Render HTML safely
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  // Process lines with accurate chapter, verse and database lineIndex
  const allProcessedLines = useMemo(() => {
    let linesToProcess: Array<{ lineIndex: number; content: string; heRef?: string }> = [];

    if (bookLines && bookLines.length > 0) {
      linesToProcess = bookLines;
    } else if (content) {
      linesToProcess = content.split(/\r?\n/).map((c, i) => ({ lineIndex: i + 1, content: c }));
    }

    let curChapter = 1;
    let curVerse = 0;

    return linesToProcess
      .map((item, idx) => {
        const lineIndex = item.lineIndex;
        const trimmed = (item.content || '').trim();
        if (!trimmed) return null;

        // Check if this line is a heading (supports attributes like <h2 id="...">)
        const headingMatch = trimmed.match(/^<h([1-6])(?:\s+[^>]*)?>(.*?)<\/h\1>$/i);
        const isHeading = !!headingMatch;
        const headingLevel = headingMatch ? parseInt(headingMatch[1]) : 0;
        const headingText = headingMatch ? headingMatch[2].replace(/<[^>]+>/g, '').trim() : '';

        // Skip redundant main book title ONLY if heading level 1 matches exact book title at very top
        if (isHeading && headingLevel === 1 && headingText === bookTitle && idx === 0) {
          return null;
        }

        if (isHeading) {
          const chapMatch = headingText.match(/(?:פרק|סימן|דף)\s+([א-ת]+)/i);
          if (chapMatch) {
            const num = hebrewToNumber(chapMatch[1]);
            if (num > 0) {
              curChapter = num;
              curVerse = 0;
            }
          }
        } else {
          const verseMatch = trimmed.match(/^\(([א-ת]+)\)|^\b([א-ת]+)\./);
          if (verseMatch) {
            const letter = verseMatch[1] || verseMatch[2];
            const num = hebrewToNumber(letter);
            if (num > 0) {
              curVerse = num;
            } else {
              curVerse++;
            }
          } else {
            curVerse++;
          }
        }

        const verseDisplay = item.heRef || (curVerse > 0 ? numberToHebrew(curVerse) : numberToHebrew(lineIndex));
        const displayText = showNikud ? trimmed : stripNikud(trimmed);
        const isSelected = selectedLineIndex === lineIndex;
        const activeQuery = inBookSearch.trim() || initialSearch?.trim() || '';
        const matchesSearch = activeQuery
          ? displayText.toLowerCase().includes(activeQuery.toLowerCase())
          : false;

        return {
          index: lineIndex,
          verseDisplay,
          text: displayText,
          rawText: trimmed,
          isHeading,
          headingLevel,
          headingText,
          isSelected,
          matchesSearch
        };
      })
      .filter(Boolean) as Array<{
        index: number;
        verseDisplay: string;
        text: string;
        rawText: string;
        isHeading: boolean;
        headingLevel: number;
        headingText: string;
        isSelected: boolean;
        matchesSearch: boolean;
      }>;
  }, [bookLines, content, bookTitle, showNikud, selectedLineIndex, inBookSearch]);

  const totalLinesCount = allProcessedLines.length;

  // Render only lines within the active 150-line window
  const processedLines = allProcessedLines.filter(
    line => line.index >= startLineIndex && line.index <= endLineIndex
  );

  const isDark = settings.theme === 'dark';
  const isSepia = settings.theme === 'sepia';

  const renderCommentarySettingsPopover = () => {
    const rawAvailableList = Array.from(
      new Set([
        ...availableBookCommentators,
        ...allCommentaries.map(c => c.sourceBook),
        ...commentaries.map(c => c.sourceBook),
        ...enabledCommentaryCategories.filter(c => c !== '__NONE__')
      ])
    ).filter(Boolean);
    const allAvailableList = sortCommentariesByGeneration(rawAvailableList);
    const currentLineCommentatorNames = new Set(
      commentaries.map(c => c.sourceBook || c.category)
    );

    const filteredDisplayList = commentatorSearchFilter.trim()
      ? allAvailableList.filter(c =>
          c.toLowerCase().includes(commentatorSearchFilter.trim().toLowerCase())
        )
      : allAvailableList;

    const isAllEnabled = enabledCommentaryCategories.length === 0;

    return (
      <div className={`p-3.5 ${isDark ? 'bg-stone-900 border-stone-700' : 'bg-amber-50/95 border-amber-200'} rounded-xl border mb-3 shadow-inner select-none animate-in fade-in slide-in-from-top-2 duration-150`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
            <span>בחירת מפרשים מוצגים ({bookTitle})</span>
            <span className={`${isDark ? 'bg-stone-800 text-stone-300' : 'bg-amber-200/70 text-amber-900'} text-[10px] font-normal px-1.5 py-0.2 rounded-full`}>
              {allAvailableList.length} זמינים
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEnabledCommentaryCategories([]);
                localStorage.removeItem(`otzaria_comm_prefs_${bookTitle}`);
              }}
              className="text-[11px] text-amber-600 font-bold hover:underline cursor-pointer"
            >
              בחר הכל
            </button>
            <span className="text-stone-400 text-xs">|</span>
            <button
              onClick={() => {
                const noneArr = ['__NONE__'];
                setEnabledCommentaryCategories(noneArr);
                localStorage.setItem(`otzaria_comm_prefs_${bookTitle}`, JSON.stringify(noneArr));
              }}
              className="text-[11px] text-stone-400 hover:text-stone-300 hover:underline cursor-pointer"
            >
              נקה הכל
            </button>
          </div>
        </div>

        {allAvailableList.length > 6 && (
          <div className="relative mb-2">
            <input
              type="text"
              value={commentatorSearchFilter}
              onChange={e => setCommentatorSearchFilter(e.target.value)}
              placeholder="חיפוש מפרש..."
              className={`w-full text-xs px-2.5 py-1 pr-7 ${isDark ? 'bg-stone-950 border-stone-700 text-stone-100' : 'bg-white border-stone-200 text-stone-800'} border rounded-md focus:outline-none focus:border-amber-500`}
            />
            <Search className="w-3 h-3 text-stone-400 absolute right-2 top-2" />
            {commentatorSearchFilter && (
              <button
                onClick={() => setCommentatorSearchFilter('')}
                className="absolute left-2 top-1.5 text-stone-400 hover:text-stone-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {filteredDisplayList.map(cat => {
            const isChecked =
              isAllEnabled ||
              (enabledCommentaryCategories.includes(cat) &&
                !enabledCommentaryCategories.includes('__NONE__'));

            const hasTextOnCurrentLine =
              currentLineCommentatorNames.has(cat) ||
              commentaries.some(c => c.sourceBook.includes(cat) || cat.includes(c.sourceBook));

            return (
              <label
                key={cat}
                className={`flex items-center justify-between gap-1 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                  isChecked
                    ? isDark ? 'bg-stone-800 border-amber-600 font-bold text-stone-100 shadow-2xs' : 'bg-white border-amber-300 font-bold text-stone-900 shadow-2xs'
                    : isDark ? 'bg-stone-950/60 border-stone-800 text-stone-500 opacity-60 hover:opacity-100' : 'bg-stone-100/70 border-stone-200 text-stone-400 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      let next: string[];
                      if (isAllEnabled) {
                        next = allAvailableList.filter(c => c !== cat);
                      } else if (enabledCommentaryCategories.includes(cat)) {
                        next = enabledCommentaryCategories.filter(c => c !== cat && c !== '__NONE__');
                        if (next.length === 0) next = ['__NONE__'];
                      } else {
                        next = enabledCommentaryCategories.filter(c => c !== '__NONE__');
                        next.push(cat);
                        if (next.length >= allAvailableList.length) next = [];
                      }
                      setEnabledCommentaryCategories(next);
                      if (next.length > 0) {
                        localStorage.setItem(
                          `otzaria_comm_prefs_${bookTitle}`,
                          JSON.stringify(next)
                        );
                      } else {
                        localStorage.removeItem(`otzaria_comm_prefs_${bookTitle}`);
                      }
                    }}
                    className="rounded text-amber-800 focus:ring-amber-500 w-3.5 h-3.5 shrink-0"
                  />
                  <span className="truncate">{cat}</span>
                </div>
                {hasTextOnCurrentLine && (
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-medium px-1 rounded shrink-0">
                    קיים
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCommentariesList = (isInlineMode: boolean) => {
    const baseFiltered = sortCommentariesByGeneration(
      commentaries.filter(c => {
        if (enabledCommentaryCategories.length > 0) {
          if (enabledCommentaryCategories.includes('__NONE__')) return false;
          const isCategoryEnabled =
            enabledCommentaryCategories.includes(c.sourceBook) ||
            enabledCommentaryCategories.includes(c.category) ||
            enabledCommentaryCategories.some(
              cat => c.sourceBook.includes(cat) || cat.includes(c.sourceBook) || cat.includes(c.category)
            );
          if (!isCategoryEnabled) return false;
        }
        return true;
      })
    );

    const searchRegex = buildHebrewSearchRegex(commentaryContentQuery);

    const filtered = searchRegex
      ? baseFiltered.filter(c => {
          const name = c.sourceBook || c.category || '';
          const dh = c.dibburHamatchil || '';
          const txt = c.text || '';
          searchRegex.lastIndex = 0;
          if (searchRegex.test(name)) return true;
          searchRegex.lastIndex = 0;
          if (searchRegex.test(dh)) return true;
          searchRegex.lastIndex = 0;
          return searchRegex.test(txt);
        })
      : baseFiltered;

    if (filtered.length === 0) {
      return (
        <div className={`text-center py-6 sm:py-8 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
          <BookOpen className={`w-7 h-7 mx-auto mb-2 ${isDark ? 'text-stone-600' : 'text-stone-300'}`} />
          <p className="text-xs font-serif font-bold">
            {commentaryContentQuery.trim()
              ? `לא נמצאו תוצאות עבור "${commentaryContentQuery}"`
              : 'אין מפרשים מוצגים לפי הסינון הנוכחי'}
          </p>
          <p className="text-[11px] text-stone-400 mt-1">
            {commentaryContentQuery.trim()
              ? 'נסה לחפש מילה אחרת או נקה את שורת החיפוש'
              : 'לחץ על שורה או פסוק אחר בספר כדי לראות את המפרשים המקבילים'}
          </p>
        </div>
      );
    }

    const commFontFamily = settings.commentaryFontFamily || (settings.fontFamily || 'Frank Ruhl Hofshi');
    const commFontSize = settings.commentaryFontSize || Math.max(14, fontSize - 3);

    const items = filtered.map((com, idx) => {
      const itemKey = `comm_${idx}`;
      const isSearching = Boolean(searchRegex);

      let isFullyOpen = false;
      let isFullyClosed = false;

      if (isSearching) {
        if (expandedDuringSearch[itemKey] !== undefined) {
          isFullyOpen = expandedDuringSearch[itemKey];
          isFullyClosed = !expandedDuringSearch[itemKey];
        } else if (searchViewMode === 'fully_expanded') {
          isFullyOpen = true;
        } else if (searchViewMode === 'fully_collapsed') {
          isFullyClosed = true;
        }
      } else {
        isFullyClosed = Boolean(collapsedItems[itemKey]);
        isFullyOpen = !isFullyClosed;
      }

      const snippetInfo = isSearching && searchRegex
        ? extractSearchSnippet(com.text, searchRegex)
        : null;

      return (
        <div
          key={idx}
          className={`border rounded-xl transition-all shadow-2xs overflow-hidden ${
            isDark
              ? 'bg-[#18110D] border-stone-800 hover:border-amber-800/60'
              : 'bg-white border-amber-200/80 hover:border-amber-300'
          }`}
          style={{ fontFamily: commFontFamily }}
        >
          {/* Header with Collapsible Toggle */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (isSearching) {
                setExpandedDuringSearch(prev => ({
                  ...prev,
                  [itemKey]: !isFullyOpen
                }));
              } else {
                setCollapsedItems(prev => ({
                  ...prev,
                  [itemKey]: !prev[itemKey]
                }));
              }
            }}
            className={`p-2.5 sm:p-3 flex items-center justify-between cursor-pointer select-none transition-colors ${
              isDark ? 'hover:bg-stone-900/60' : 'hover:bg-amber-50/40'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-0.5">
              <span className="text-stone-400 shrink-0">
                {isFullyClosed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </span>
              <span className={`text-xs font-bold font-serif truncate ${isDark ? 'text-amber-200' : 'text-amber-950'}`}>
                <span className="font-black text-amber-700 dark:text-amber-400">
                  {com.sourceBook || com.category}:
                </span>{' '}
                {com.dibburHamatchil && (
                  <span
                    className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchText(com.dibburHamatchil, searchRegex)
                    }}
                  />
                )}
              </span>
            </div>
          </div>

          {/* Content Body */}
          {!isFullyClosed && (
            <div
              className={`px-3.5 pb-3.5 pt-1 text-xs leading-relaxed font-serif border-t ${
                isDark ? 'text-stone-200 border-stone-800' : 'text-stone-800 border-stone-100'
              }`}
            >
              {isSearching && !isFullyOpen && snippetInfo ? (
                <div>
                  <div
                    className={`p-2 rounded-lg border italic leading-relaxed ${
                      isDark ? 'bg-amber-950/20 border-amber-900/40 text-stone-300' : 'bg-amber-50/40 border-amber-200/60 text-stone-700'
                    }`}
                    style={{ fontSize: `${commFontSize}px` }}
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchText(snippetInfo.snippet, searchRegex)
                    }}
                  />
                  <div className="flex items-center justify-between mt-2 pt-1 text-[11px]">
                    {snippetInfo.totalMatches > 1 ? (
                      <span className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-sans font-semibold px-2 py-0.5 rounded-full text-[10px]">
                        + עוד {snippetInfo.totalMatches - 1} תוצאות במפרש זה
                      </span>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDuringSearch(prev => ({
                          ...prev,
                          [itemKey]: true
                        }));
                      }}
                      className="text-amber-800 dark:text-amber-300 hover:underline font-bold font-sans text-[11px] cursor-pointer"
                    >
                      פתח פירוש מלא ▾
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{ fontSize: `${commFontSize}px` }}
                    dangerouslySetInnerHTML={{
                      __html: highlightSearchText(com.text, searchRegex)
                    }}
                  />
                  {isSearching && (
                    <div className="mt-2 pt-1 border-t border-stone-200/50 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDuringSearch(prev => ({
                            ...prev,
                            [itemKey]: false
                          }));
                        }}
                        className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-sans text-[11px] underline cursor-pointer"
                      >
                        הצג תקציר בלבד ▴
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });

    const hiddenCount = allCommentaries.length - filtered.length;
    return (
      <>
        {items}
        {hiddenCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCommentaries(allCommentaries);
            }}
            className={`w-full py-2 px-3 text-center text-xs font-serif font-bold rounded-xl transition-colors cursor-pointer shadow-2xs mt-2 ${
              isDark
                ? 'text-amber-300 bg-amber-950/60 hover:bg-amber-950 border border-amber-900'
                : 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            + הצג עוד {hiddenCount} מפרשים נוספים של הדף
          </button>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 ${isDark ? 'bg-[#18110D] text-stone-300' : 'bg-[#FAF8F5] text-stone-700'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-800 border-t-transparent mb-3" />
        <p className={`text-sm font-serif font-bold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
          טוען את הספר {bookTitle}...
        </p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col h-full ${isDark ? 'bg-[#18110D] text-stone-100' : isSepia ? 'bg-[#FAF6EE] text-stone-900' : 'bg-[#FAF8F5] text-stone-900'} select-none overflow-hidden`}>
      {/* Top Book Toolbar (סרגל הכלים של הספר באוצרייה) */}
      <div className={`${isDark ? 'bg-[#211711] border-stone-800 text-stone-200' : 'bg-white border-stone-200 text-stone-900'} border-b px-4 py-2 flex items-center justify-between shadow-xs z-10`}>
        {/* Right side: TOC Toggle, Title & Chapter Breadcrumb */}
        <div className="flex items-center gap-2">
          {/* Table of Contents Button */}
          <button
            onClick={() => setShowTocPanel(!showTocPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              showTocPanel
                ? 'bg-amber-800 border-amber-800 text-white'
                : isDark
                ? 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-200'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
            }`}
            title="תוכן עניינים (ראשי פרקים)"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">ראשי פרקים</span>
          </button>

          <div className={`h-4 w-px ${isDark ? 'bg-stone-700' : 'bg-stone-200'} mx-1`} />

          {/* Book Title */}
          <div className="flex items-center gap-2">
            <h2 className={`text-sm font-bold font-serif ${isDark ? 'text-amber-200' : 'text-stone-900'} truncate max-w-[200px] sm:max-w-none`}>
              {bookTitle}
            </h2>
            {selectedLineIndex && (
              <span className={`text-[11px] ${isDark ? 'text-amber-300 bg-amber-950/80 border-amber-800/80' : 'text-amber-800 bg-amber-50 border-amber-200/80'} border px-2 py-0.5 rounded-full font-medium font-serif`}>
                סעיף {numberToHebrew(selectedLineIndex)}
              </span>
            )}
          </div>
        </div>

        {/* Center / Left: Search, Font size, Nikud, Split commentary toggle */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* In-Book Search Toggle */}
          <button
            onClick={() => setShowInBookSearchBox(!showInBookSearchBox)}
            className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              showInBookSearchBox || inBookSearch
                ? 'bg-amber-800 border-amber-700 text-white'
                : isDark
                ? 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-300'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
            }`}
            title="חיפוש בתוך הספר"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Font Controls */}
          <div className={`flex items-center ${isDark ? 'bg-stone-800/80 border-stone-700' : 'bg-stone-50 border-stone-200'} border rounded-lg p-0.5`}>
            <button
              onClick={() => setFontSize(s => Math.min(36, s + 2))}
              className={`p-1 ${isDark ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-200/70 text-stone-700'} rounded cursor-pointer`}
              title="הגדל גופן"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className={`text-[11px] font-mono px-1.5 ${isDark ? 'text-stone-300' : 'text-stone-600'} select-none`}>
              {fontSize}
            </span>
            <button
              onClick={() => setFontSize(s => Math.max(14, s - 2))}
              className={`p-1 ${isDark ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-200/70 text-stone-700'} rounded cursor-pointer`}
              title="הקטן גופן"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nikud Toggle (אל"ף מנוקדת) */}
          <button
            onClick={() => setShowNikud(!showNikud)}
            className={`px-2 py-1 rounded-lg border text-xs font-serif font-bold transition-colors cursor-pointer ${
              showNikud
                ? 'bg-amber-800 border-amber-800 text-white'
                : isDark
                ? 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-300'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
            }`}
            title={showNikud ? 'הסתר ניקוד וטעמים' : 'הצג ניקוד וטעמים'}
          >
            אָ
          </button>

          {/* Tzurat HaDaf Button */}
          <button
            onClick={() => {
              const activeLine = selectedLineIndex || startLineIndex || 1;
              const resolvedDaf = isShasBook ? resolveTalmudDafForLine(activeLine, toc, bookLines, allProcessedLines) : null;
              const dafNum = resolvedDaf?.dafNum || 2;
              const amud = resolvedDaf?.amud || 'a';

              if (onOpenTzuratHaDafTab) {
                onOpenTzuratHaDafTab(bookTitle, dafNum, amud);
              } else {
                if (resolvedDaf) {
                  setSelectedVerseInfo({ dafLabel: resolvedDaf.dafLabel });
                }
                setIsTzuratHaDafOpen(true);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              isDark
                ? 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-200'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-950'
            }`}
            title="פתח צורת הדף בלשונית נפרדת"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>צורת הדף</span>
          </button>

          {/* Commentary Split Toggle Button (כמו באוצרייה: פאנל קישורים ומפרשים) */}
          <button
            onClick={() => setShowCommentaryPanel(!showCommentaryPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              showCommentaryPanel
                ? 'bg-amber-800 border-amber-800 text-white shadow-xs'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
            }`}
            title="מפרשים וקישורים"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">מפרשים</span>
            {commentaries.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${showCommentaryPanel ? 'bg-amber-950 text-white' : 'bg-stone-200 text-stone-700'}`}>
                {commentaries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Floating In-Book Search Bar */}
      {showInBookSearchBox && (
        <div className="bg-amber-100/95 border-b border-amber-300 px-6 py-2.5 flex items-center justify-between gap-4 animate-fadeIn shadow-sm z-20">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <Search className="w-4 h-4 text-amber-900 shrink-0" />
            <input
              type="text"
              value={inBookSearch}
              onChange={e => setInBookSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNextSearchMatch();
                }
              }}
              placeholder="חפש מילה, פסוק או ביטוי בספר זה..."
              className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700 font-serif"
              autoFocus
            />
            {inBookSearch.trim() && (
              <span className="text-xs text-amber-900 font-sans font-medium shrink-0 px-1">
                {searchMatchIndices.length > 0
                  ? `${currentMatchPointer + 1} מתוך ${searchMatchIndices.length}`
                  : 'אין תוצאות'}
              </span>
            )}
            {searchMatchIndices.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handlePrevSearchMatch}
                  className="p-1 rounded bg-white hover:bg-amber-200 border border-amber-300 text-amber-950 transition-colors"
                  title="תוצאה קודמת"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextSearchMatch}
                  className="p-1 rounded bg-white hover:bg-amber-200 border border-amber-300 text-amber-950 transition-colors"
                  title="תוצאה הבאה"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
            {inBookSearch && (
              <button
                onClick={() => setInBookSearch('')}
                className="text-xs text-stone-500 hover:text-stone-800 shrink-0"
              >
                נקה
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setShowInBookSearchBox(false);
              setInBookSearch('');
            }}
            className="text-xs text-amber-900 font-semibold hover:underline"
          >
            סגור
          </button>
        </div>
      )}

      {/* Shared Deep Link Highlight Banner */}
      {highlightedPhrase && (
        <div className="bg-amber-100/95 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-800 px-6 py-2.5 flex items-center justify-between text-amber-950 dark:text-amber-200 text-xs font-serif shadow-xs animate-in fade-in duration-200 z-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold shrink-0">הגעת באמצעות קישור ישיר לקטע מודגש:</span>
            <span className="font-bold truncate max-w-md">"{highlightedPhrase}"</span>
          </div>
          <button
            onClick={() => setHighlightedPhrase(undefined)}
            className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-lg transition-colors cursor-pointer text-stone-600 dark:text-stone-300 flex items-center gap-1 text-[11px]"
            title="נקה הדגשה"
          >
            <span>נקה הדגשה</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Location Navigation Banner (from Daily Study or TOC Jump) */}
      {locationNavMessage && (
        <div className="bg-amber-100/90 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 px-6 py-2 flex items-center justify-between text-amber-950 dark:text-amber-200 text-xs font-serif shadow-xs animate-in fade-in duration-200 z-10">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <span className="font-bold">{locationNavMessage}</span>
          </div>
          <button
            onClick={() => setLocationNavMessage(null)}
            className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-lg transition-colors cursor-pointer text-stone-600 dark:text-stone-300"
            title="סגור"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Reading Canvas & Side Panels */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Table of Contents Drawer (TOC) */}
        {showTocPanel && (
          <aside className={`w-64 ${isDark ? 'bg-[#1C140F] border-stone-800 text-stone-200' : 'bg-white border-stone-200 text-stone-900'} border-l flex flex-col p-4 shrink-0 shadow-md z-20`}>
            <div className={`flex items-center justify-between pb-2 ${isDark ? 'border-stone-800' : 'border-stone-100'} mb-2 border-b`}>
              <h3 className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-900'} font-serif flex items-center gap-1.5`}>
                <List className="w-3.5 h-3.5 text-amber-500" />
                <span>תוכן עניינים</span>
              </h3>
              <button
                onClick={() => setShowTocPanel(false)}
                className="text-stone-400 hover:text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 text-xs font-serif pr-1">
              {toc.length === 0 ? (
                <div className="text-stone-500 text-center py-6">
                  לא קיים תוכן עניינים מפורט
                </div>
              ) : (
                toc.map((node, i) => {
                  const actualLine = resolveActualBookLine(node, toc, bookLines, totalBookLines);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        scrollToLine(actualLine);
                        setShowTocPanel(false);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                        selectedLineIndex === actualLine
                          ? isDark
                            ? 'bg-amber-900/80 text-amber-100 font-bold'
                            : 'bg-amber-100 text-amber-950 font-bold'
                          : isDark
                          ? 'hover:bg-stone-800 text-stone-300'
                          : 'hover:bg-stone-100 text-stone-700'
                      }`}
                    >
                      <span className="truncate">{node.title}</span>
                      <span className={`text-[10px] ${isDark ? 'text-stone-500' : 'text-stone-400'} font-sans mr-2 shrink-0`}>
                        {numberToHebrew(actualLine)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Center: Book Text Content Canvas */}
        <main
          ref={linesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 md:p-10 select-text"
          style={{
            fontFamily: settings.fontFamily || 'Frank Ruhl Hofshi',
            backgroundColor: isDark ? '#18110D' : isSepia ? '#FAF6EE' : '#FFFFFF',
            color: isDark ? '#F5F5F4' : '#1C1917'
          }}
        >
          <div
            className="mx-auto space-y-3"
            style={{
              maxWidth: settings.textMaxWidth === '100%' ? '100%' : (settings.textMaxWidth || '90%'),
              lineHeight: settings.lineHeight || 1.8
            }}
          >
            {/* Book Title Banner */}
            <div className={`text-center pb-6 border-b ${isDark ? 'border-stone-800' : 'border-stone-200/80'} mb-6`}>
              <h1 className={`text-2xl md:text-3xl font-black font-serif ${isDark ? 'text-amber-200' : 'text-stone-900'} tracking-wide`}>
                {bookTitle}
              </h1>
              <div className="w-16 h-0.5 bg-amber-800/40 mx-auto mt-3" />
            </div>

            {/* Top Previous Lines Loading Indicator */}
            {startLineIndex > 1 && (
              <div className={`text-center py-4 border-b ${isDark ? 'border-stone-800/60' : 'border-stone-200/60'} mb-4 flex flex-col items-center gap-2 select-none`}>
                <div className="flex items-center gap-2 text-stone-400 font-serif text-xs">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-800 border-t-transparent" />
                  <span>
                    ישנן עוד {startLineIndex - 1} שורות קודמות בספר (גלילה למעלה טוענת אוטומטית)
                  </span>
                </div>
                <button
                  onClick={loadPreviousLines}
                  className={`px-3 py-1.5 ${isDark ? 'bg-stone-800 hover:bg-stone-700 text-amber-300 border-stone-700' : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'} border rounded-lg text-xs font-serif font-bold transition-colors shadow-xs active:scale-95 cursor-pointer`}
                >
                  טען 150 שורות קודמות
                </button>
              </div>
            )}

            {/* Render Lines */}
            {processedLines.map(line => {
              const isSearchMatch = searchMatchIndices.includes(line.index);
              const isCurrentActiveMatch = searchMatchIndices.length > 0 && searchMatchIndices[currentMatchPointer] === line.index;

              if (line.isHeading) {
                return (
                  <div
                    key={line.index}
                    id={`reader-line-${line.index}`}
                    onClick={() => handleLineClick(line.index)}
                    className={`text-center my-6 py-2.5 px-4 border-y rounded-xl cursor-pointer transition-colors ${
                      line.isSelected
                        ? isDark
                          ? 'border-amber-500 bg-amber-950/80 shadow-xs'
                          : 'border-amber-700 bg-amber-200/80 shadow-xs'
                        : isDark
                        ? 'border-amber-900/40 bg-amber-950/30 hover:bg-amber-950/50'
                        : 'border-amber-800/20 bg-amber-50/60 hover:bg-amber-100/60'
                    }`}
                  >
                    <h2 className={`text-lg md:text-xl font-black font-serif ${isDark ? 'text-amber-200' : 'text-amber-950'} tracking-wide`}>
                      {line.headingText || line.text}
                    </h2>
                  </div>
                );
              }

              return (
                <React.Fragment key={line.index}>
                  <div
                    id={`reader-line-${line.index}`}
                    onClick={() => handleLineClick(line.index)}
                  className={`group relative p-3 rounded-xl transition-all cursor-pointer leading-relaxed ${
                    line.isSelected
                      ? isDark
                        ? 'bg-amber-950/90 text-amber-50 ring-2 ring-amber-500 shadow-sm'
                        : 'bg-amber-100/90 text-stone-950 ring-2 ring-amber-500/90 shadow-sm'
                      : isCurrentActiveMatch
                      ? 'bg-yellow-400 text-stone-950 ring-2 ring-yellow-500 shadow-sm font-bold'
                      : isSearchMatch
                      ? isDark
                        ? 'bg-yellow-950/80 text-amber-100'
                        : 'bg-yellow-100/90 text-stone-950'
                      : isDark
                      ? 'hover:bg-stone-800/60 text-stone-200'
                      : 'hover:bg-amber-50/50 text-stone-900'
                  }`}
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: settings.lineHeight || 1.8
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Verse/Line Number in Hebrew */}
                    <span
                      className={`text-xs font-serif font-bold pt-1 select-none shrink-0 ${
                        line.isSelected
                          ? isDark ? 'text-amber-300 font-black' : 'text-amber-900 font-black'
                          : isDark ? 'text-stone-500' : 'text-stone-400'
                      }`}
                      style={{ fontSize: `${Math.max(12, fontSize * 0.65)}px` }}
                    >
                      {line.verseDisplay}
                    </span>

                    {/* Main Line Text */}
                    <div className="flex-1 break-words font-serif">
                      {renderFormattedText(line.rawText)}
                    </div>
                  </div>

                  {/* Hover action menu for this line */}
                  <div className={`absolute left-2 top-2 ${
                    textSharePopover?.lineIndex === line.index
                      ? 'opacity-100 ring-2 ring-amber-400 dark:ring-amber-500 scale-105'
                      : 'opacity-0 group-hover:opacity-100'
                  } transition-all duration-150 flex items-center gap-1 ${
                    isDark ? 'bg-stone-800/95 border-stone-700' : 'bg-white/95 border-stone-200'
                  } border rounded-lg p-1 shadow-sm select-none z-10`}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const snippet = textSharePopover?.lineIndex === line.index ? textSharePopover.selectedText : line.rawText;
                        handleShareTextFragment(line.index, snippet);
                      }}
                      className={`p-1 flex items-center gap-1 ${
                        isDark ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-100 text-stone-600'
                      } rounded cursor-pointer transition-colors`}
                      title={textSharePopover?.lineIndex === line.index ? 'שתף קישור ישיר לקטע המודגש' : 'שתף קישור ישיר לשורה זו'}
                    >
                      {shareLinkCopiedLine === line.index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                      {textSharePopover?.lineIndex === line.index && (
                        <span className="text-[11px] font-sans font-bold text-amber-800 dark:text-amber-300 px-1">
                          {shareLinkCopiedLine === line.index ? 'הועתק!' : 'שתף קטע'}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleCopyLine(line.rawText, line.index);
                      }}
                      className={`p-1 ${isDark ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-100 text-stone-600'} rounded cursor-pointer`}
                      title="העתק שורה"
                    >
                      {copiedLine === line.index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleBookmarkCurrentLine(line.index, line.rawText);
                      }}
                      className={`p-1 ${isDark ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-100 text-stone-600'} rounded cursor-pointer`}
                      title="שמור בסימניות"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Commentary Block (under current line for mobile or when inline mode selected) */}
                {line.isSelected && isInlineCommentary && showCommentaryPanel && (
                  <div
                    id={`inline-commentary-${line.index}`}
                    className={`my-3 p-3.5 sm:p-4 rounded-xl border select-text shadow-sm ${
                      isDark
                        ? 'bg-[#1C140F] border-amber-900/60 text-stone-100'
                        : 'bg-amber-50/85 border-amber-200/90 text-stone-900'
                    }`}
                  >
                    {/* Inline Header */}
                    <div className={`flex items-center justify-between pb-2 mb-2.5 border-b ${
                      isDark ? 'border-amber-900/40' : 'border-amber-200/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        <span className={`text-xs font-bold font-serif ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
                          מפרשים וקישורים {selectedVerseInfo?.dafLabel ? `(${selectedVerseInfo.dafLabel})` : selectedVerseInfo?.verse ? `(פסוק ${numberToHebrew(selectedVerseInfo.verse)})` : `(שורה ${numberToHebrew(line.index)})`}
                        </span>
                        {commentaries.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isDark ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {commentaries.length} מפרשים
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCommentarySettings(!showCommentarySettings);
                          }}
                          className={`p-1 rounded-md border text-xs cursor-pointer ${
                            showCommentarySettings
                              ? 'bg-amber-800 text-white border-amber-800'
                              : isDark
                              ? 'bg-stone-800 border-stone-700 text-stone-300'
                              : 'bg-white border-stone-200 text-stone-700'
                          }`}
                          title="סינון מפרשים"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCommentaryPanel(false);
                          }}
                          className={`p-1 rounded-md cursor-pointer ${
                            isDark ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/60'
                          }`}
                          title="סגור מפרשים"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Filter Dialog if open */}
                    {showCommentarySettings && renderCommentarySettingsPopover()}

                    {/* In-commentary search bar if > 2 commentaries */}
                    {commentaries.length > 2 && (
                      <div className="relative mb-3">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-2 pointer-events-none" />
                        <input
                          type="text"
                          value={commentaryContentQuery}
                          onChange={e => setCommentaryContentQuery(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          placeholder="חיפוש מפרש או מילה בפירושים..."
                          className={`w-full text-xs pl-7 pr-8 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                            isDark
                              ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder-stone-500'
                              : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                          }`}
                        />
                        {commentaryContentQuery && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCommentaryContentQuery('');
                            }}
                            className="absolute left-2 top-1.5 text-stone-400 hover:text-stone-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Commentaries list */}
                    <div className="space-y-2.5">
                      {renderCommentariesList(true)}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}

            {/* Incremental Scroll Loading Indicator */}
            {endLineIndex < totalLinesCount && (
              <div className="text-center py-6 border-t border-stone-200/60 my-4 flex flex-col items-center gap-2 select-none">
                <div className="flex items-center gap-2 text-stone-500 font-serif text-xs">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-800 border-t-transparent" />
                  <span>
                    טוען שורות נוספות באופן אוטומטי בגלילה... (מוצגות שורות {startLineIndex}-{endLineIndex} מתוך {totalLinesCount})
                  </span>
                </div>
                <button
                  onClick={() => setEndLineIndex(prev => Math.min(totalLinesCount, prev + CHUNK_SIZE))}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-serif font-bold text-amber-900 transition-colors shadow-xs"
                >
                  טען 150 שורות נוספות בלחיצה
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Left Side: Commentary Split Panel (פאנל מפרשים וקישורים באוצרייה בדסקטופ) */}
        {showCommentaryPanel && !isInlineCommentary && (
          <aside className={`w-80 md:w-96 ${isDark ? 'bg-[#1C140F] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900'} border-r flex flex-col shrink-0 shadow-sm z-10`}>
            {/* Commentary Panel Header */}
            <div className="p-3 border-b border-stone-200 flex items-center justify-between bg-stone-50/90 gap-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-amber-800 shrink-0" />
                <h3 className="text-xs font-bold font-serif text-stone-900 truncate">
                  מפרשים וקישורים{' '}
                  {selectedVerseInfo?.dafLabel ? (
                    <span className="text-amber-800 font-black">
                      ({selectedVerseInfo.dafLabel})
                    </span>
                  ) : selectedVerseInfo?.verse ? (
                    <span className="text-amber-800">
                      ({selectedVerseInfo.chapter ? `פרק ${numberToHebrew(selectedVerseInfo.chapter)}, ` : ''}פסוק {numberToHebrew(selectedVerseInfo.verse)})
                    </span>
                  ) : selectedLineIndex ? (
                    <span className="text-amber-800">
                      (שורה {numberToHebrew(selectedLineIndex)})
                    </span>
                  ) : null}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Commentary Settings Button */}
                <button
                  onClick={() => setShowCommentarySettings(!showCommentarySettings)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    showCommentarySettings || enabledCommentaryCategories.length > 0
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                  title="הגדרות סינון מפרשים עבור ספר זה"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setShowCommentaryPanel(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
                  title="סגור פאנל מפרשים"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Commentary Search Bar: Search commentator name or text within commentary */}
            <div className="px-3 py-2 bg-stone-50 border-b border-stone-200">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={commentaryContentQuery}
                  onChange={e => setCommentaryContentQuery(e.target.value)}
                  placeholder="חיפוש מפרש או טקסט בתוך הפירושים..."
                  className="w-full pl-7 pr-8 py-1.5 text-xs bg-white border border-stone-300 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                {commentaryContentQuery && (
                  <button
                    onClick={() => setCommentaryContentQuery('')}
                    className="absolute left-2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    title="נקה חיפוש"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Commentary Sub-Toolbar (Collapse/Expand All + Exact Match Filter) */}
            {commentaries.length > 0 && (
              <div className="px-3 py-2 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between text-[11px] font-serif select-none">
                <div className="flex items-center gap-1.5">
                  {commentaryContentQuery.trim() ? (
                    <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg border border-stone-300">
                      <button
                        onClick={() => {
                          setSearchViewMode('partial');
                          setExpandedDuringSearch({});
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                          searchViewMode === 'partial'
                            ? 'bg-amber-600 text-white shadow-2xs font-bold'
                            : 'text-stone-700 hover:bg-stone-300/60'
                        }`}
                        title="הצג 5 מילים לפני ואחרי התוצאה"
                      >
                        תקציר חלקי
                      </button>
                      <button
                        onClick={() => {
                          setSearchViewMode('fully_expanded');
                          const allExp: Record<string, boolean> = {};
                          commentaries.forEach((_, i) => (allExp[`comm_${i}`] = true));
                          setExpandedDuringSearch(allExp);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                          searchViewMode === 'fully_expanded'
                            ? 'bg-amber-600 text-white shadow-2xs font-bold'
                            : 'text-stone-700 hover:bg-stone-300/60'
                        }`}
                        title="פתח את כל הפירושים במלואם"
                      >
                        פתח הכל
                      </button>
                      <button
                        onClick={() => {
                          setSearchViewMode('fully_collapsed');
                          setExpandedDuringSearch({});
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium transition-colors cursor-pointer ${
                          searchViewMode === 'fully_collapsed'
                            ? 'bg-amber-600 text-white shadow-2xs font-bold'
                            : 'text-stone-700 hover:bg-stone-300/60'
                        }`}
                        title="כווץ הכל לכותרות בלבד"
                      >
                        כווץ הכל
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const anyCollapsed = Object.values(collapsedItems).some(Boolean);
                        if (anyCollapsed) {
                          setCollapsedItems({});
                        } else {
                          const allCol: Record<string, boolean> = {};
                          commentaries.forEach((_, i) => (allCol[`comm_${i}`] = true));
                          setCollapsedItems(allCol);
                        }
                      }}
                      className="px-2 py-0.5 bg-white hover:bg-stone-50 border border-stone-200 rounded text-stone-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {Object.values(collapsedItems).some(Boolean) ? (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>פתח הכל</span>
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>כווץ הכל</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <span className="text-stone-400 text-[10px]">
                  {commentaries.filter(c => {
                    if (enabledCommentaryCategories.length > 0) {
                      if (enabledCommentaryCategories.includes('__NONE__')) return false;
                      const isCatEnabled =
                        enabledCommentaryCategories.includes(c.sourceBook) ||
                        enabledCommentaryCategories.includes(c.category) ||
                        enabledCommentaryCategories.some(
                          cat => c.sourceBook.includes(cat) || cat.includes(c.sourceBook) || cat.includes(c.category)
                        );
                      if (!isCatEnabled) return false;
                    }
                    if (commentaryContentQuery.trim()) {
                      const regex = buildHebrewSearchRegex(commentaryContentQuery);
                      if (!regex) return true;
                      const name = c.sourceBook || c.category || '';
                      const dh = c.dibburHamatchil || '';
                      const txt = c.text || '';
                      regex.lastIndex = 0;
                      if (regex.test(name)) return true;
                      regex.lastIndex = 0;
                      if (regex.test(dh)) return true;
                      regex.lastIndex = 0;
                      return regex.test(txt);
                    }
                    return true;
                  }).length} מפרשים
                </span>
              </div>
            )}

            {/* Commentary Settings Dialog Popover */}
            {showCommentarySettings && renderCommentarySettingsPopover()}

            {/* Commentary Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {renderCommentariesList(false)}
            </div>
          </aside>
        )}
      </div>

      {/* Tzurat HaDaf Dual-Mode Modal (Vilna Scan PDF & Interactive HTML) */}
      <TzuratHaDafModal
        isOpen={isTzuratHaDafOpen}
        onClose={() => setIsTzuratHaDafOpen(false)}
        bookTitle={bookTitle}
        initialDaf={
          selectedVerseInfo?.dafLabel ||
          (isShasBook
            ? resolveTalmudDafForLine(selectedLineIndex || startLineIndex || 1, toc, bookLines, allProcessedLines)?.dafLabel || 'דף ב ע״א'
            : undefined)
        }
        isDarkTheme={isDark}
      />

      {/* Floating Text Selection Share Button Popover */}
      {textSharePopover && (
        <div
          style={{
            position: 'fixed',
            left: `${textSharePopover.coords.x}px`,
            top: `${textSharePopover.coords.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999
          }}
          className="pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95 select-none"
        >
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleShareTextFragment(textSharePopover.lineIndex, textSharePopover.selectedText);
            }}
            onMouseDown={e => {
              // Prevent losing text selection on click
              e.preventDefault();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-2xl border cursor-pointer font-sans text-xs font-bold transition-all ${
              shareLinkCopiedLine === textSharePopover.lineIndex
                ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400'
                : isDark
                ? 'bg-stone-800 text-amber-200 border-amber-600/80 hover:bg-stone-700 shadow-black/60 ring-1 ring-amber-500/40'
                : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-50 shadow-stone-400/40 ring-1 ring-amber-400/40'
            }`}
            title="שתף קישור ישיר לקטע המסומן"
          >
            {shareLinkCopiedLine === textSharePopover.lineIndex ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>הקישור הועתק!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>שתף קישור לטקסט</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Floating Toast Notification on Copying Share Link */}
      {shareToastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 text-amber-100 border border-amber-500/60 px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{shareToastMessage}</span>
        </div>
      )}
    </div>
  );
};
