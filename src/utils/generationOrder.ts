/**
 * Commentary Era hierarchy matching Otzaria canonical architecture:
 * 0: תורה שבכתב (תנ"ך, תרגומים)
 * 1: חז"ל (משנה, תוספתא, גמרא, מדרשי הלכה ואגדה)
 * 2: ראשונים (רש"י, תוספות, רמב"ם, רמב"ן, רא"ש, רי"ף, רשב"א, ריטב"א, ר"ן, מאירי, ברטנורא ועוד)
 * 3: אחרונים (מהרש"א, מהרש"ל, פני יהושע, צל"ח, שו"ע, מגן אברהם, ט"ז, ש"ך, גר"א, פני משה, קרבן העדה, חתם סופר, משנה ברורה ועוד)
 * 4: מחברי זמננו (שטיינזלץ, רשימות שיעורים, דעת מקרא, הרב קוק, אגרות משה ועוד)
 * 5: שאר מפרשים
 */
export enum CommentaryEra {
  torahShebichtav = 0,
  chazal = 1,
  rishonim = 2,
  acharonim = 3,
  modern = 4,
  other = 5
}

export const ERA_HEBREW_NAMES: Record<CommentaryEra, string> = {
  [CommentaryEra.torahShebichtav]: 'תורה שבכתב',
  [CommentaryEra.chazal]: 'חז"ל',
  [CommentaryEra.rishonim]: 'ראשונים',
  [CommentaryEra.acharonim]: 'אחרונים',
  [CommentaryEra.modern]: 'מחברי זמננו',
  [CommentaryEra.other]: 'שאר מפרשים'
};

// Canonical priority within Rishonim and Acharonim (lower number = earlier / higher precedence)
// Guarantees: רש"י -> תוספות -> רא"ש -> רי"ף -> שאר ראשונים
// Canonical priority within Rishonim and Acharonim (lower number = earlier / higher precedence)
// Guarantees: רש"י -> תוספות -> רא"ש -> רי"ף -> רמב"ן -> שאר ראשונים
export const CANONICAL_COMMENTATOR_PRIORITY: Record<string, number> = {
  // תרגומים
  'תרגום אונקלוס': 1,
  'אונקלוס': 2,
  'תרגום יונתן': 3,
  'תרגום ירושלמי': 4,
  // ראשונים
  'רש"י': 10,
  'רשב"ם': 11,
  'תוספות': 12,
  'תוספות ישנים': 13,
  'תוספות הרא"ש': 14,
  'פסקי תוספות': 15,
  'רא"ש': 16,
  'הרא"ש': 16,
  'פירוש הרא"ש': 16,
  'רבינו חננאל': 17,
  'ר"ח': 17,
  'רי"ף': 18,
  'רמב"ם': 19,
  'רמב"ן': 20,
  'חידושי רמב"ן': 20,
  'חידושי הרמב"ן': 20,
  'פירוש רמב"ן': 20,
  'פירוש הרמב"ן': 20,
  'אבן עזרא': 21,
  'רד"ק': 22,
  'ספורנו': 23,
  'חזקוני': 24,
  'רלב"ג': 25,
  'רשב"א': 26,
  'חידושי הרשב"א': 26,
  'חידושי רשב"א': 26,
  'ריטב"א': 27,
  'חידושי הריטב"א': 27,
  'חידושי ריטב"א': 27,
  'ר"ן': 28,
  'חידושי הר"ן': 28,
  'חידושי ר"ן': 28,
  'שיטה מקובצת': 29,
  'מאירי': 30,
  'בית הבחירה למאירי': 30,
  'בית הבחירה': 30,
  'ברטנורא': 31,
  'רבי עובדיה מברטנורא': 31,
  'מגיד משנה': 32,
  'הגהות מיימוניות': 33,
  // אחרונים - שו"ע / ירושלמי / בבלי / תנ"ך
  'בית יוסף': 40,
  'ב"ח': 41,
  'טורי זהב (ט"ז)': 42,
  'ט"ז': 42,
  'שפתי כהן (ש"ך)': 43,
  'ש"ך': 43,
  'מגן אברהם': 44,
  'סמ"ע': 45,
  'באר היטב': 46,
  'כסף משנה': 47,
  'לחם משנה': 48,
  'רדב"ז': 49,
  'פני משה': 50,
  'קרבן העדה': 51,
  'מראה הפנים': 52,
  'שיירי קרבן': 53,
  'מהרש"א': 54,
  'חידושי הלכות מהרש"א': 54,
  'חידושי הלכות': 54,
  'חידושי אגדות מהרש"א': 55,
  'חידושי אגדות': 55,
  'מהרש"ל': 56,
  'מהר"ם': 57,
  'מהר"ם שיף': 58,
  'פני יהושע': 59,
  'צל"ח': 60,
  'גבורת ארי': 61,
  'בעל הטורים': 62,
  'כלי יקר': 63,
  'אור החיים': 64,
  'שפתי חכמים': 65,
  'אלשיך': 66,
  'תוספות יו"ט': 67,
  'תוספות יום טוב': 67,
  'תפארת ישראל': 68,
  'הגר"א': 70,
  'ביאור הגר"א': 70,
  'באור הגר"א': 70,
  'הגהות הגר"א': 70,
  'הגהות הב"ח': 71,
  'הגהות יעב"ץ': 72,
  'מסורת הש"ס': 73,
  'עין משפט נר מצוה': 74,
  'עין משפט': 74,
  'תורה אור': 75,
  'ערוך השולחן': 76,
  'קצות החושן': 77,
  'נתיבות המשפט': 78,
  'פתחי תשובה': 79,
  'פרי מגדים': 80,
  'ערוך לנר': 81,
  'מרומי שדה': 82,
  'מלבי"ם': 83,
  'מצודות': 84,
  'מצודת דוד': 85,
  'מצודת ציון': 86,
  'רש"ש': 87,
  'משנה ברורה': 88,
  'ביאור הלכה': 89,
  'שער הציון': 90,
  'כף החיים': 91,
  'בן יהוידע': 92,
  'מי השילוח': 93,
  'עיון יעקב': 94,
  'גליון הש"ס': 95,
  'חכמת שלמה': 96,
  // מחברי זמננו
  'שטיינזלץ': 120,
  'ביאור שטיינזלץ': 120,
  'רשימות שיעורים': 121,
  'דעת מקרא': 122
};

export function normalizeCommentatorName(name: string): string {
  return name
    .trim()
    .replace(/^פירוש\s+/, '')
    .replace(/^ספר\s+/, '')
    .replace(/^חידושי\s+/, '')
    .replace(/["'״׳]/g, '');
}

export function getCommentatorEra(commentatorName: string): CommentaryEra {
  const clean = normalizeCommentatorName(commentatorName);

  // 1. תורה שבכתב / תרגומים
  if (
    clean.includes('תרגום') ||
    clean.includes('אונקלוס') ||
    clean.includes('יונתן בן עוזיאל')
  ) {
    return CommentaryEra.torahShebichtav;
  }

  // 2. ראשונים (רש"י, תוספות, רמב"ם, רמב"ן, רא"ש, רי"ף, מאירי וכו')
  if (
    clean.includes('רשי') ||
    clean.includes('רשבם') ||
    clean.includes('תוספות') ||
    clean.includes('רמבם') ||
    clean.includes('רמבן') ||
    clean.includes('אבן עזרא') ||
    clean.includes('ראש') ||
    clean.includes('ריף') ||
    clean.includes('רן') ||
    clean.includes('רשבא') ||
    clean.includes('ריטבא') ||
    clean.includes('רדק') ||
    clean.includes('רלבג') ||
    clean.includes('ספורנו') ||
    clean.includes('חזקוני') ||
    clean.includes('מאירי') ||
    clean.includes('חננאל') ||
    clean.includes('שיטה מקובצת') ||
    clean.includes('ברטנורא') ||
    clean.includes('מגיד משנה') ||
    clean.includes('הגהות מיימוניות') ||
    clean.includes('רוקח') ||
    clean.includes('יראים') ||
    clean.includes('סמג') ||
    clean.includes('סמק') ||
    clean.includes('ריד') ||
    clean.includes('תוספות ריד') ||
    clean.includes('רידבש') ||
    clean.includes('המאור') ||
    clean.includes('מלחמת השם') ||
    clean.includes('רבינו גרשום')
  ) {
    return CommentaryEra.rishonim;
  }

  // 4. מחברי זמננו
  if (
    clean.includes('שטיינזלץ') ||
    clean.includes('רשימות שיעורים') ||
    clean.includes('דעת מקרא') ||
    clean.includes('קוק') ||
    clean.includes('פיינשטיין') ||
    clean.includes('אגרות משה') ||
    clean.includes('אברהם כהן') ||
    clean.includes('ילקוט יוסף') ||
    clean.includes('הרצוג') ||
    clean.includes('עובדיה יוסף')
  ) {
    return CommentaryEra.modern;
  }

  // 3. אחרונים (מהרש"א, גבורת ארי, פני יהושע, שו"ע, משנה ברורה וכו')
  if (
    clean.includes('מהרשא') ||
    clean.includes('מהרשל') ||
    clean.includes('מהרם') ||
    clean.includes('פני יהושע') ||
    clean.includes('צלח') ||
    clean.includes('גבורת ארי') ||
    clean.includes('פני משה') ||
    clean.includes('קרבן העדה') ||
    clean.includes('מראה הפנים') ||
    clean.includes('שיירי קרבן') ||
    clean.includes('גרא') ||
    clean.includes('בח') ||
    clean.includes('טז') ||
    clean.includes('שך') ||
    clean.includes('מגן אברהם') ||
    clean.includes('סמע') ||
    clean.includes('באר היטב') ||
    clean.includes('כסף משנה') ||
    clean.includes('לחם משנה') ||
    clean.includes('רדבז') ||
    clean.includes('תוספות יום טוב') ||
    clean.includes('תוספות יוט') ||
    clean.includes('תפארת ישראל') ||
    clean.includes('משנה ברורה') ||
    clean.includes('ביאור הלכה') ||
    clean.includes('שער הציון') ||
    clean.includes('קצות החושן') ||
    clean.includes('נתיבות המשפט') ||
    clean.includes('ערוך השולחן') ||
    clean.includes('כף החיים') ||
    clean.includes('פתחי תשובה') ||
    clean.includes('פרי מגדים') ||
    clean.includes('חתם סופר') ||
    clean.includes('נודע ביהודה') ||
    clean.includes('מלבים') ||
    clean.includes('מצודת') ||
    clean.includes('מצודות') ||
    clean.includes('אור החיים') ||
    clean.includes('כלי יקר') ||
    clean.includes('בעל הטורים') ||
    clean.includes('שפתי חכמים') ||
    clean.includes('אלשיך') ||
    clean.includes('בן יהוידע') ||
    clean.includes('מי השילוח') ||
    clean.includes('מי השלוח') ||
    clean.includes('עיון יעקב') ||
    clean.includes('ערוך לנר') ||
    clean.includes('מסורת השס') ||
    clean.includes('עין משפט') ||
    clean.includes('תורה אור') ||
    clean.includes('ספר ניר') ||
    clean.includes('נועם ירושלמי') ||
    clean.includes('מהרם פולדא') ||
    clean.includes('רידבז') ||
    clean.includes('תולדות יצחק') ||
    clean.includes('שדה יהושע') ||
    clean.includes('רשש') ||
    clean.includes('יעבץ') ||
    clean.includes('עקיבא איגר') ||
    clean.includes('גליון השס') ||
    clean.includes('חכמת שלמה') ||
    clean.includes('פתח עינים') ||
    clean.includes('מראית העין')
  ) {
    return CommentaryEra.acharonim;
  }

  return CommentaryEra.other;
}

export function extractCommentatorName(title: string): string {
  if (!title) return '';
  let clean = title.replace(/\s+על\s+.+$/i, '').trim();
  clean = clean.replace(/^(חידושי\s+ה?|פירוש\s+ה?|ביאור\s+ה?|הגהות\s+ה?|ספר\s+|קונטרס\s+)/i, '').trim();
  return clean || title;
}

export function getCommentatorPriority(name: string): number {
  if (CANONICAL_COMMENTATOR_PRIORITY[name] !== undefined) {
    return CANONICAL_COMMENTATOR_PRIORITY[name];
  }

  const clean = normalizeCommentatorName(name);
  const baseName = normalizeCommentatorName(extractCommentatorName(name));

  // 1. Direct match on normalized name or base name
  for (const [key, prio] of Object.entries(CANONICAL_COMMENTATOR_PRIORITY)) {
    const cleanKey = normalizeCommentatorName(key);
    if (cleanKey === clean || cleanKey === baseName) {
      return prio;
    }
  }

  // 2. StartsWith or includes match for prominent commentators (Rashi, Tosafot, Ramban, Rashba, etc.)
  if (baseName.includes('רשי') || clean.includes('רשי על')) return 10;
  if (baseName.includes('רשבם')) return 11;
  if (baseName.includes('תוספות ישנים')) return 13;
  if (baseName.includes('תוספות הראש')) return 14;
  if (baseName.includes('תוספות') || clean.includes('תוספות על')) return 12;
  if (baseName.includes('הראש') || baseName.includes('פירוש הראש') || baseName === 'ראש') return 16;
  if (baseName.includes('רבינו חננאל') || baseName.includes('רח')) return 17;
  if (baseName.includes('ריף')) return 18;
  if (baseName.includes('רמבם')) return 19;
  if (baseName.includes('רמבן')) return 20;
  if (baseName.includes('אבן עזרא')) return 21;
  if (baseName.includes('רדק')) return 22;
  if (baseName.includes('ספורנו')) return 23;
  if (baseName.includes('רשבא')) return 26;
  if (baseName.includes('ריטבא')) return 27;
  if (baseName.includes('רן')) return 28;
  if (baseName.includes('שיטה מקובצת')) return 29;
  if (baseName.includes('מאירי')) return 30;
  if (baseName.includes('ברטנורא')) return 31;

  if (baseName.includes('מהרשא')) return 54;
  if (baseName.includes('מהרשל')) return 56;
  if (baseName.includes('פני יהושע')) return 59;
  if (baseName.includes('צלח')) return 60;
  if (baseName.includes('גבורת ארי')) return 61;
  if (baseName.includes('גרא')) return 70;
  if (baseName.includes('משנה ברורה')) return 88;

  return 999;
}

/**
 * Sorts commentary results or commentator titles according to the Otzaria generation and canonical authority hierarchy:
 * 1. Era: תורה שבכתב -> חז"ל -> ראשונים -> אחרונים -> מחברי זמננו -> שאר מפרשים
 * 2. Canonical priority within era (e.g., רש"י -> תוספות -> רא"ש -> רמב"ן -> שאר ראשונים -> אחרונים)
 * 3. Commentary title / category (alphabetical)
 */
export function sortCommentariesByGeneration<T extends { category?: string; sourceBook?: string } | string>(
  commentaries: T[]
): T[] {
  return [...commentaries].sort((a, b) => {
    const rawA = typeof a === 'string' ? a : (a.sourceBook || a.category || '');
    const rawB = typeof b === 'string' ? b : (b.sourceBook || b.category || '');

    const baseA = extractCommentatorName(rawA);
    const baseB = extractCommentatorName(rawB);

    const eraA = getCommentatorEra(baseA || rawA);
    const eraB = getCommentatorEra(baseB || rawB);

    if (eraA !== eraB) {
      return eraA - eraB;
    }

    const prioA = getCommentatorPriority(rawA);
    const prioB = getCommentatorPriority(rawB);

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    return rawA.localeCompare(rawB, 'he');
  });
}
