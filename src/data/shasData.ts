// src/data/shasData.ts

export interface TractateInfo {
  name: string;
  slug: string;
  seder: 'זרעים' | 'מועד' | 'נשים' | 'נזיקין' | 'קדשים' | 'טהרות';
  startDaf: number;
  totalDappim: number;
  bookId?: number;
  req: number;
  masechetIdPortal: number;
  pageOffset?: number;
}

export const SHAS_SEDARIM: Array<{
  name: 'זרעים' | 'מועד' | 'נשים' | 'נזיקין' | 'קדשים' | 'טהרות';
  tractates: string[];
}> = [
  {
    name: 'זרעים',
    tractates: ['ברכות']
  },
  {
    name: 'מועד',
    tractates: [
      'שבת',
      'עירובין',
      'פסחים',
      'שקלים',
      'יומא',
      'סוכה',
      'ביצה',
      'ראש השנה',
      'תענית',
      'מגילה',
      'מועד קטן',
      'חגיגה'
    ]
  },
  {
    name: 'נשים',
    tractates: [
      'יבמות',
      'כתובות',
      'נדרים',
      'נזיר',
      'סוטה',
      'גיטין',
      'קידושין'
    ]
  },
  {
    name: 'נזיקין',
    tractates: [
      'בבא קמא',
      'בבא מציעא',
      'בבא בתרא',
      'סנהדרין',
      'מכות',
      'שבועות',
      'עבודה זרה',
      'הוריות'
    ]
  },
  {
    name: 'קדשים',
    tractates: [
      'זבחים',
      'מנחות',
      'חולין',
      'בכורות',
      'ערכין',
      'תמורה',
      'כריתות',
      'מעילה',
      'קנים',
      'תמיד',
      'מידות'
    ]
  },
  {
    name: 'טהרות',
    tractates: ['נידה']
  }
];

export const ALL_TRACTATES: Record<string, TractateInfo> = {
  'ברכות': { name: 'ברכות', slug: 'berachos', seder: 'זרעים', startDaf: 2, totalDappim: 64, req: 21111, masechetIdPortal: 1, bookId: 101 },
  'שבת': { name: 'שבת', slug: 'shabbos', seder: 'מועד', startDaf: 2, totalDappim: 157, req: 21112, masechetIdPortal: 2, bookId: 102 },
  'עירובין': { name: 'עירובין', slug: 'eruvin', seder: 'מועד', startDaf: 2, totalDappim: 105, req: 21113, masechetIdPortal: 3, bookId: 103 },
  'פסחים': { name: 'פסחים', slug: 'pesachim', seder: 'מועד', startDaf: 2, totalDappim: 121, req: 21114, masechetIdPortal: 4, bookId: 104 },
  'שקלים': { name: 'שקלים', slug: 'shekalim', seder: 'מועד', startDaf: 2, totalDappim: 22, req: 21115, masechetIdPortal: 5, bookId: 105 },
  'יומא': { name: 'יומא', slug: 'yoma', seder: 'מועד', startDaf: 2, totalDappim: 88, req: 21116, masechetIdPortal: 6, bookId: 106 },
  'סוכה': { name: 'סוכה', slug: 'sukkah', seder: 'מועד', startDaf: 2, totalDappim: 56, req: 21117, masechetIdPortal: 7, bookId: 107 },
  'ביצה': { name: 'ביצה', slug: 'beitzah', seder: 'מועד', startDaf: 2, totalDappim: 40, req: 21118, masechetIdPortal: 8, bookId: 108 },
  'ראש השנה': { name: 'ראש השנה', slug: 'rosh-hashanah', seder: 'מועד', startDaf: 2, totalDappim: 35, req: 21119, masechetIdPortal: 9, bookId: 109 },
  'תענית': { name: 'תענית', slug: 'taanis', seder: 'מועד', startDaf: 2, totalDappim: 31, req: 21120, masechetIdPortal: 10, bookId: 110 },
  'מגילה': { name: 'מגילה', slug: 'megillah', seder: 'מועד', startDaf: 2, totalDappim: 32, req: 21121, masechetIdPortal: 11, bookId: 111 },
  'מועד קטן': { name: 'מועד קטן', slug: 'moed-katan', seder: 'מועד', startDaf: 2, totalDappim: 29, req: 21122, masechetIdPortal: 12, bookId: 112 },
  'חגיגה': { name: 'חגיגה', slug: 'chagigah', seder: 'מועד', startDaf: 2, totalDappim: 27, req: 21123, masechetIdPortal: 13, bookId: 113 },
  'יבמות': { name: 'יבמות', slug: 'yevamos', seder: 'נשים', startDaf: 2, totalDappim: 122, req: 21124, masechetIdPortal: 14, bookId: 114 },
  'כתובות': { name: 'כתובות', slug: 'kesubos', seder: 'נשים', startDaf: 2, totalDappim: 112, req: 21125, masechetIdPortal: 15, bookId: 115 },
  'נדרים': { name: 'נדרים', slug: 'nedarim', seder: 'נשים', startDaf: 2, totalDappim: 91, req: 21126, masechetIdPortal: 16, bookId: 116 },
  'נזיר': { name: 'נזיר', slug: 'nazir', seder: 'נשים', startDaf: 2, totalDappim: 66, req: 21127, masechetIdPortal: 17, bookId: 117 },
  'סוטה': { name: 'סוטה', slug: 'sotah', seder: 'נשים', startDaf: 2, totalDappim: 49, req: 21128, masechetIdPortal: 18, bookId: 118 },
  'גיטין': { name: 'גיטין', slug: 'gittin', seder: 'נשים', startDaf: 2, totalDappim: 90, req: 21129, masechetIdPortal: 19, bookId: 119 },
  'קידושין': { name: 'קידושין', slug: 'kiddushin', seder: 'נשים', startDaf: 2, totalDappim: 82, req: 21130, masechetIdPortal: 20, bookId: 120 },
  'בבא קמא': { name: 'בבא קמא', slug: 'bava-kamma', seder: 'נזיקין', startDaf: 2, totalDappim: 119, req: 21131, masechetIdPortal: 21, bookId: 121 },
  'בבא מציעא': { name: 'בבא מציעא', slug: 'bava-metzia', seder: 'נזיקין', startDaf: 2, totalDappim: 119, req: 21132, masechetIdPortal: 22, bookId: 122 },
  'בבא בתרא': { name: 'בבא בתרא', slug: 'bava-basra', seder: 'נזיקין', startDaf: 2, totalDappim: 176, req: 21133, masechetIdPortal: 23, bookId: 123 },
  'סנהדרין': { name: 'סנהדרין', slug: 'sanhedrin', seder: 'נזיקין', startDaf: 2, totalDappim: 113, req: 21134, masechetIdPortal: 24, bookId: 124 },
  'מכות': { name: 'מכות', slug: 'makkos', seder: 'נזיקין', startDaf: 2, totalDappim: 24, req: 21135, masechetIdPortal: 25, bookId: 125 },
  'שבועות': { name: 'שבועות', slug: 'shevuot', seder: 'נזיקין', startDaf: 2, totalDappim: 49, req: 21136, masechetIdPortal: 26, bookId: 126 },
  'עבודה זרה': { name: 'עבודה זרה', slug: 'avodah-zarah', seder: 'נזיקין', startDaf: 2, totalDappim: 76, req: 21137, masechetIdPortal: 27, bookId: 127 },
  'הוריות': { name: 'הוריות', slug: 'horayot', seder: 'נזיקין', startDaf: 2, totalDappim: 14, req: 21138, masechetIdPortal: 28, bookId: 128 },
  'זבחים': { name: 'זבחים', slug: 'zevachim', seder: 'קדשים', startDaf: 2, totalDappim: 120, req: 21139, masechetIdPortal: 29, bookId: 129 },
  'מנחות': { name: 'מנחות', slug: 'menachot', seder: 'קדשים', startDaf: 2, totalDappim: 110, req: 21140, masechetIdPortal: 30, bookId: 130 },
  'חולין': { name: 'חולין', slug: 'chullin', seder: 'קדשים', startDaf: 2, totalDappim: 142, req: 21141, masechetIdPortal: 31, bookId: 131 },
  'בכורות': { name: 'בכורות', slug: 'bechoros', seder: 'קדשים', startDaf: 2, totalDappim: 61, req: 21142, masechetIdPortal: 32, bookId: 133 },
  'ערכין': { name: 'ערכין', slug: 'arakhin', seder: 'קדשים', startDaf: 2, totalDappim: 34, req: 21143, masechetIdPortal: 33, bookId: 134 },
  'תמורה': { name: 'תמורה', slug: 'temurah', seder: 'קדשים', startDaf: 2, totalDappim: 34, req: 21144, masechetIdPortal: 34, bookId: 135 },
  'כריתות': { name: 'כריתות', slug: 'keritot', seder: 'קדשים', startDaf: 2, totalDappim: 28, req: 21145, masechetIdPortal: 35, bookId: 136 },
  'מעילה': { name: 'מעילה', slug: 'meilah', seder: 'קדשים', startDaf: 2, totalDappim: 22, req: 21146, masechetIdPortal: 36, bookId: 137 },
  'קנים': { name: 'קנים', slug: 'kinnim', seder: 'קדשים', startDaf: 22, totalDappim: 25, req: 21146, masechetIdPortal: 36, pageOffset: -40, bookId: 138 },
  'תמיד': { name: 'תמיד', slug: 'tamid', seder: 'קדשים', startDaf: 26, totalDappim: 33, req: 21147, masechetIdPortal: 37, bookId: 139 },
  'מידות': { name: 'מידות', slug: 'middot', seder: 'קדשים', startDaf: 34, totalDappim: 37, req: 21148, masechetIdPortal: 38, bookId: 140 },
  'נידה': { name: 'נידה', slug: 'niddah', seder: 'טהרות', startDaf: 2, totalDappim: 73, req: 21149, masechetIdPortal: 39, bookId: 141 }
};

export function getTractate(name: string): TractateInfo | null {
  if (!name) return null;
  const clean = name
    .replace(/[־–—\-_,.:;()\[\]{}'\"״׳]/g, ' ')
    .replace(/\b(תלמוד|בבלי|שס|ש"ס|ש״ס|מסכת|משנה|פירוש|רש"י|תוספות|על|סדר|נשים|נזיקין|מועד|קדשים|טהרות|זרעים)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ALL_TRACTATES[clean]) return ALL_TRACTATES[clean];
  if (ALL_TRACTATES[name.trim()]) return ALL_TRACTATES[name.trim()];

  for (const [key, val] of Object.entries(ALL_TRACTATES)) {
    if (clean.includes(key) || name.includes(key)) {
      return val;
    }
  }

  return null;
}
