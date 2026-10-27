import { numberToHebrew } from './gematria';
import { CustomDailyStudy, BookItem } from '../types/otzaria';

export interface DailyStudyItem {
  id: string;
  type: string;
  title: string;
  bookTitle: string;
  bookId?: string | number;
  portion: string;
  chapterIndex?: number;
  lineIndex?: number;
  description: string;
  badge?: string;
  isCustom?: boolean;
}

// Full Daf Yomi Masechtot Table with exact start and end daf per masechta (2711 total dafim)
const DAF_YOMI_MASECHTOT: Array<{ name: string; startDaf: number; endDaf: number }> = [
  { name: 'ברכות', startDaf: 2, endDaf: 64 },
  { name: 'שבת', startDaf: 2, endDaf: 157 },
  { name: 'עירובין', startDaf: 2, endDaf: 105 },
  { name: 'פסחים', startDaf: 2, endDaf: 121 },
  { name: 'שקלים', startDaf: 2, endDaf: 22 },
  { name: 'יומא', startDaf: 2, endDaf: 88 },
  { name: 'סוכה', startDaf: 2, endDaf: 56 },
  { name: 'ביצה', startDaf: 2, endDaf: 40 },
  { name: 'ראש השנה', startDaf: 2, endDaf: 35 },
  { name: 'תענית', startDaf: 2, endDaf: 31 },
  { name: 'מגילה', startDaf: 2, endDaf: 32 },
  { name: 'מועד קטן', startDaf: 2, endDaf: 29 },
  { name: 'חגיגה', startDaf: 2, endDaf: 27 },
  { name: 'יבמות', startDaf: 2, endDaf: 122 },
  { name: 'כתובות', startDaf: 2, endDaf: 112 },
  { name: 'נדרים', startDaf: 2, endDaf: 91 },
  { name: 'נזיר', startDaf: 2, endDaf: 66 },
  { name: 'סוטה', startDaf: 2, endDaf: 49 },
  { name: 'גיטין', startDaf: 2, endDaf: 90 },
  { name: 'קידושין', startDaf: 2, endDaf: 82 },
  { name: 'בבא קמא', startDaf: 2, endDaf: 119 },
  { name: 'בבא מציעא', startDaf: 2, endDaf: 119 },
  { name: 'בבא בתרא', startDaf: 2, endDaf: 176 },
  { name: 'סנהדרין', startDaf: 2, endDaf: 113 },
  { name: 'מכות', startDaf: 2, endDaf: 24 },
  { name: 'שבועות', startDaf: 2, endDaf: 49 },
  { name: 'עבודה זרה', startDaf: 2, endDaf: 76 },
  { name: 'הוריות', startDaf: 2, endDaf: 14 },
  { name: 'זבחים', startDaf: 2, endDaf: 120 },
  { name: 'מנחות', startDaf: 2, endDaf: 110 },
  { name: 'חולין', startDaf: 2, endDaf: 142 },
  { name: 'בכורות', startDaf: 2, endDaf: 61 },
  { name: 'ערכין', startDaf: 2, endDaf: 34 },
  { name: 'תמורה', startDaf: 2, endDaf: 34 },
  { name: 'כריתות', startDaf: 2, endDaf: 28 },
  { name: 'מעילה', startDaf: 2, endDaf: 22 },
  { name: 'קנים', startDaf: 23, endDaf: 25 },
  { name: 'תמיד', startDaf: 26, endDaf: 33 },
  { name: 'מידות', startDaf: 34, endDaf: 37 },
  { name: 'נידה', startDaf: 2, endDaf: 73 }
];

const TOTAL_DAF_CYCLE = 2711;
// Cycle 14 started on January 5, 2020 (UTC) with Berachot 2
const DAF_CYCLE_14_START = new Date(Date.UTC(2020, 0, 5));

/**
 * Calculates accurate Daf Yomi for any given date
 */
export function calculateDafYomi(targetDate: Date = new Date()): { masechet: string; dafNumber: number; dafHebrew: string; bookTitle: string } {
  const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.floor((utcTarget - DAF_CYCLE_14_START.getTime()) / (1000 * 60 * 60 * 24));
  let dayInCycle = ((diffDays % TOTAL_DAF_CYCLE) + TOTAL_DAF_CYCLE) % TOTAL_DAF_CYCLE;

  for (const m of DAF_YOMI_MASECHTOT) {
    const pagesInMasechet = m.endDaf - m.startDaf + 1;
    if (dayInCycle < pagesInMasechet) {
      const dafNum = m.startDaf + dayInCycle;
      return {
        masechet: m.name,
        dafNumber: dafNum,
        dafHebrew: `דף ${numberToHebrew(dafNum)}`,
        bookTitle: `תלמוד בבלי - מסכת ${m.name}`
      };
    }
    dayInCycle -= pagesInMasechet;
  }

  return {
    masechet: 'ברכות',
    dafNumber: 2,
    dafHebrew: 'דף ב׳',
    bookTitle: 'תלמוד בבלי - מסכת ברכות'
  };
}

/**
 * Official Chofetz Chaim 3-times-a-year cycle (Rabbi Yehuda Zev Segal zt"l)
 * 120-day cycle completing the entire Sefer Chofetz Chaim & Sefer Shmirat HaLashon 3 times a year
 * Cycles begin on: 1 Tishrei, 1 Shevat, 1 Sivan
 */
export const CHOFETZ_CHAIM_120_DAYS: Array<{ title: string; portion: string; desc: string; book: string }> = [
  // פתיחה ולאווין
  { title: 'הקדמה ופתיחה', portion: 'הקדמת המחבר ופתיחה', desc: 'הקדמת רבנו החפץ חיים זצוק"ל וגודל חובת שמירת הדיבור', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין א׳-ב׳', desc: 'לא תלך רכיל בעמך, לא תשא שמע שוא', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין ג׳-ד׳', desc: 'השמר בנגע הצרעת, לפני עור לא תתן מכשול', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין ה׳-ז׳', desc: 'השמר לך פן תשכח, לא תשא עליו חטא, לא תשנא את אחיך בלבבך', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין ח׳-י׳', desc: 'לא תקום, לא תטור, ולא יהיה כקרח וכעדתו', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין י״א-י״ב', desc: 'לא תונו איש את עמיתו (אונאת דברים), ולא תחללו את שם קדשי', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין י״ג-י״ד', desc: 'לא תהיה אחרי רבים לרעות, לא תטה משפט', book: 'חפץ חיים' },
  { title: 'פתיחה - לאווין', portion: 'לאווין ט״ו-י״ז', desc: 'מדבר שקר תרחק, לא תחנם, לא ימצא בך קוסם קסמים', book: 'חפץ חיים' },
  // עשין וארורין
  { title: 'פתיחה - עשין', portion: 'עשין א׳-ג׳', desc: 'זכור את אשר עשה ה׳ אלקיך למרים, ואהבת לרעך כמוך', book: 'חפץ חיים' },
  { title: 'פתיחה - עשין', portion: 'עשין ד׳-ז׳', desc: 'בצדק תשפוט עמיתך, הוכח תוכיח את עמיתך, ובו תדבק', book: 'חפץ חיים' },
  { title: 'פתיחה - עשין', portion: 'עשין ח׳-י׳', desc: 'מצות קימה והידור לתלמיד חכם, ואהבתם את הגר', book: 'חפץ חיים' },
  { title: 'פתיחה - עשין וארורין', portion: 'עשין י״א-י״ד וארורין', desc: 'צדק צדק תרדוף, ארור מכה רעהו בסתר וכללות הארורין', book: 'חפץ חיים' },
  // הלכות איסורי לשון הרע - כלל א'
  { title: 'הלכות לשון הרע', portion: 'כלל א׳, סעיפים א׳-ב׳', desc: 'איסור סיפור לשון הרע ואפילו על אמת גמורה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל א׳, סעיפים ג׳-ד׳', desc: 'איסור לשון הרע בין בפניו ובין שלא בפניו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל א׳, סעיפים ה׳-ו׳', desc: 'איסור סיפור אפילו שאינו מתכוון לבזות', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל א׳, סעיפים ז׳-ח׳', desc: 'איסור השפלת חברו ברמז, בכתב או דרך שחוק', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל א׳, סעיף ט׳', desc: 'איסור לגנות את עצמו כדי להשפיל את חברו', book: 'חפץ חיים' },
  // כלל ב'
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים א׳-ב׳', desc: 'איסור קבלת לשון הרע והאמנה בלב', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים ג׳-ד׳', desc: 'חיוב להוכיח את המספר ואיסור להסכים עמו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים ה׳-ו׳', desc: 'מקרים שמותר לחוש בלבד כדי לשמור על עצמו אך לא להאמין', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים ז׳-ח׳', desc: 'שמירה שלא לנקוט שום פעולת נזק על פי שמועה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים ט׳-י׳', desc: 'איסור שמיעה אם יש באפשרותו להשמיט עצמו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיף י״א', desc: 'דין מי שכבר שמע וקיבל בטעות', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ב׳, סעיפים י״ב-י״ג', desc: 'סדרי התשובה והתיקון למי שקיבל לשון הרע', book: 'חפץ חיים' },
  // כלל ג'
  { title: 'הלכות לשון הרע', portion: 'כלל ג׳, סעיפים א׳-ב׳', desc: 'דין לשון הרע באפי תלתא (בפני שלושה אנשים)', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ג׳, סעיפים ג׳-ד׳', desc: 'התנאים ההכרחיים באפי תלתא שלא תהיה כוונת פרסום', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ג׳, סעיפים ה׳-ו׳', desc: 'איסור לספר אם ניכר שהשומע ייקח הדבר כאמת מוחלטת', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ג׳, סעיפים ז׳-ח׳', desc: 'דבר העשוי להתגלות ואימתי נחשב כמפורסם', book: 'חפץ חיים' },
  // כלל ד'
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיפים א׳-ב׳', desc: 'איסור סיפור על כל אדם מישראל אפילו פשוט', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיפים ג׳-ד׳', desc: 'איסור סיפור על קטן, עני או בעל תשובה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיפים ה׳-ו׳', desc: 'חומרת איסור סיפור על תלמיד חכם וירא שמים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיפים ז׳-ח׳', desc: 'איסור סיפור על עיר שלמה, קהילה או ציבור', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיפים ט׳-י׳', desc: 'דין אדם המוחזק ברשע ופורק עול מצוות', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ד׳, סעיף י״א', desc: 'התנאים המדויקים להגדרת אדם שיצא מכלל עמיתך', book: 'חפץ חיים' },
  // כלל ה'
  { title: 'הלכות לשון הרע', portion: 'כלל ה׳, סעיפים א׳-ב׳', desc: 'איסור גרימת רעה, בושת או הפסד לחברו בדיבור', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ה׳, סעיפים ג׳-ד׳', desc: 'אפילו אם חברו לא נתבזה בעיני השומעים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ה׳, סעיפים ה׳-ו׳', desc: 'גרימת צער בגוף, בממון או במעמדו של חברו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ה׳, סעיפים ז׳-ח׳', desc: 'איסור מניעת טובה ופרנסה מחברו בדיבור', book: 'חפץ חיים' },
  // כלל ו' (לתועלת)
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים א׳-ב׳', desc: 'דיני סיפור לתועלת והצלת אחרים מנזק', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים ג׳-ד׳', desc: 'תנאי א׳ וב׳ לתועלת: ראייה בעצמו ובירור האמת עד תום', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים ה׳-ו׳', desc: 'תנאי ג׳ וד׳: להוכיחו תחילה בלשון רכה ואי-הגזמה בפרטים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים ז׳-ח׳', desc: 'תנאי ה׳: כוונה לשם שמים ולתועלת בלבד ולא משנאה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים ט׳-י׳', desc: 'תנאי ו׳: אם אפשר להשיג התועלת בדרך אחרת אסור לספר', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ו׳, סעיפים י״א-י״ב', desc: 'תנאי ז׳: שלא יסובב על ידו נזק גדול יותר מן הדין', book: 'חפץ חיים' },
  // כלל ז'
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים א׳-ב׳', desc: 'איסור שמיעת לשון הרע וקבלתה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים ג׳-ד׳', desc: 'כיצד ינהג השומע בעת מעשה: להשתיק או להגן על הנידון', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים ה׳-ו׳', desc: 'לימוד זכות על חברו בפני המספר', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים ז׳-ח׳', desc: 'התרחקות מחבורות ומקומות שיש בהם שיחת מרעים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים ט׳-י׳', desc: 'איסור ישיבה בחבורת בעלי לשון הרע בקביעות', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים י״א-י״ב', desc: 'שמיעה לצורך בירור ותועלת ללא קביעת עמדה בלב', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ז׳, סעיפים י״ג-י״ד', desc: 'הנהגות זהירות בשמיעת שמועות על בעלי תפקידים', book: 'חפץ חיים' },
  // כלל ח' (אבק לשון הרע)
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים א׳-ב׳', desc: 'איסור אבק לשון הרע ומהותו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים ג׳-ד׳', desc: 'איסור שבח חברו בפני שונאיו המביא לגנותו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים ה׳-ו׳', desc: 'שבח מופלג הגורם קנאה או הערות גנאי', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים ז׳-ח׳', desc: 'דיבור הנשמע לשתי פנים ומשתמע לגנאי', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים ט׳-י׳', desc: 'שתיקה המסמלת הסכמה לדברי גנאי', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים י״א-י״ב', desc: 'הזכרת מעשי אבותיו הראשונים או מעשיו שבעבר', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ח׳, סעיפים י״ג-י״ד', desc: 'אבק לשון הרע בכתב, ברמז ובתנועות גוף', book: 'חפץ חיים' },
  // כלל ט'
  { title: 'הלכות לשון הרע', portion: 'כלל ט׳, סעיפים א׳-ב׳', desc: 'איסור סיפור על קרובים, שותפים ומחותנים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ט׳, סעיפים ג׳-ד׳', desc: 'זהירות מלשון הרע בין איש לאשתו ובמשפחה', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל ט׳, סעיפים ה׳-ו׳', desc: 'סיפור על מלמדים, פועלים ומשרתים', book: 'חפץ חיים' },
  // כלל י' (שידוכים ועסקים)
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים א׳-ב׳', desc: 'דיני תועלת בשידוכים ובמשא ומתן', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים ג׳-ד׳', desc: 'חובת השבת תשובה ביושר ובדיוק לשואל על שידוך', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים ה׳-ו׳', desc: 'ההבדל בין מום גדול ומשמעותי למום קל וטבעי', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים ז׳-ח׳', desc: 'שבעת התנאים ההכרחיים בבירורי שידוכים ועסקים', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים ט׳-י׳', desc: 'איסור עדות שקר, הגזמה או נקמנות במסחר', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים י״א-י״ב', desc: 'הצלת עשוק מיד עושקו והצלת ממון חברו', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים י״ג-י״ד', desc: 'הצלת הרבים ממכשול רוחני או גשמי', book: 'חפץ חיים' },
  { title: 'הלכות לשון הרע', portion: 'כלל י׳, סעיפים ט״ו-י״ז', desc: 'סיום הלכות לשון הרע וציורים מעשיים', book: 'חפץ חיים' },
  // הלכות איסורי רכילות
  { title: 'הלכות רכילות', portion: 'כלל א׳, סעיפים א׳-ג׳', desc: 'איסור לא תלך רכיל בעמך ומהות עוון רכילות', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל א׳, סעיפים ד׳-ו׳', desc: 'הגדרת רכילות: פלוני אמר עליך או רוצה להזיק לך', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ב׳, סעיפים א׳-ב׳', desc: 'איסור קבלת רכילות והאמנה לדברי הולך רכיל', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ב׳, סעיפים ג׳-ד׳', desc: 'חובת תוכחה למספר רכילות והשקטת הרוחות', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ג׳, סעיפים א׳-ב׳', desc: 'דין רכילות באפי תלתא והתנאים בה', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ג׳, סעיפים ג׳-ד׳', desc: 'איסור גילוי סוד אפילו בפני רבים', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ד׳, סעיפים א׳-ב׳', desc: 'איסור רכילות על כל אדם מישראל', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ה׳, סעיפים א׳-ב׳', desc: 'איסור גרימת שנאה ומריבות בין אנשים', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ו׳, סעיפים א׳-ב׳', desc: 'רכילות על דיבורים ומחשבות', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ז׳, סעיפים א׳-ב׳', desc: 'שמיעת רכילות ודיני זהירות בה', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ח׳, סעיפים א׳-ב׳', desc: 'אבק רכילות ורמזים המעוררים חשד ומריבה', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ט׳, סעיפים א׳-ב׳', desc: 'רכילות לתועלת להצלת הנרדף ממזיק', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ט׳, סעיפים ג׳-ה׳', desc: 'שבעת התנאים ברכילות לתועלת', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ט׳, סעיפים ו׳-ח׳', desc: 'הצלת שותף או חבר מהפסד מובהק', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ט׳, סעיפים ט׳-י״א', desc: 'מניעת מחלוקת והבאת שלום בין אדם לחברו', book: 'חפץ חיים' },
  { title: 'הלכות רכילות', portion: 'כלל ט׳, סעיפים י״ב-י״ד', desc: 'סיום הלכות רכילות וציורים מעשיים', book: 'חפץ חיים' },
  // ספר שמירת הלשון - שער הזכירה
  { title: 'שמירת הלשון', portion: 'שער הזכירה, הקדמה ופרק א׳', desc: 'מעלת הזהירות בדיבור וחשיבות שמירת הלשון', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ב׳', desc: 'גודל עונש המספר לשון הרע בעולם הזה ובעולם הבא', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ג׳', desc: 'הפסד הזכויות והמצוות של בעל לשון הרע', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ד׳', desc: 'הצטרפות עבירות הלשון למספר עצום של עבירות', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ה׳', desc: 'שקילות עוון לשון הרע כנגד עבודה זרה, גילוי עריות ושפיכות דמים', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ו׳', desc: 'סגולת החיים והאריכות למי שנוצר לשונו מרע', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ז׳', desc: 'חומרת השמיעה והקבלה והשפעתן על הנפש', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ח׳', desc: 'השפעת הדיבור על העולמות העליונים ופתיחת קטרוגים', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק ט׳', desc: 'טיהור הנפש ועוררות מידת הרחמים על ישראל', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק י׳', desc: 'הזהירות מכת חנפים וכת ליצנים', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק י״א', desc: 'מדת השקר ואונאת דברים וחומרתן', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק י״ב', desc: 'הלבנת פנים וגסות הרוח כמקור לחטאי הלשון', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק י״ג', desc: 'הכעס והקפדה המביאים ללשון הרע והדרך להינצל מהם', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער הזכירה, פרק י״ד', desc: 'דרכי התשובה והתיקון השלם על חטאי הלשון', book: 'שמירת הלשון' },
  // שער התבונה
  { title: 'שמירת הלשון', portion: 'שער התבונה, הקדמה ופרק א׳', desc: 'תחבולות היצר הרע בדיבור וכיצד להתגבר עליהן', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ב׳', desc: 'עצות מעשיות יומיומיות להינצל ממלכודות הלשון', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ג׳', desc: 'התרחקות מחברת אנשים המדברים סרה', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ד׳', desc: 'שתיקה כסייג לחכמה ודרכי שמירתה בשעת מבחן', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ה׳', desc: 'לימוד הלכות שמירת הלשון כערובה היחידה לקיומן', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ו׳', desc: 'התבוננות בשכר הנצחי על כל רגע של בלימת פיו', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ז׳', desc: 'הנהגות יום-יומיות לזהירות מעשית בשעת כעס וויכוח', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התבונה, פרק ח׳', desc: 'קביעות לימוד הלכות לשון הרע בכל יום וסגולתו', book: 'שמירת הלשון' },
  // שער התורה
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק א׳', desc: 'מעלת עסק התורה וגודל קדושת הדיבור בתורה', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ב׳', desc: 'הבל פיהם של תינוקות של בית רבן וטהרת הדיבור', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ג׳', desc: 'כח התורה לכפר על כל החטאים ולהגן מן היצר', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ד׳', desc: 'זריזות וקביעות עתים לתורה בכל מצב', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ה׳', desc: 'שמירת הזמן משיחה בטלה לעמל התורה הקדושה', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ו׳', desc: 'שמירת העיניים והמחשבה כסיוע ישיר לקדושת הדיבור', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'שער התורה, פרק ז׳', desc: 'זכות הרבים ותמיכה בלומדי תורה כסגולה לשמירת הלשון', book: 'שמירת הלשון' },
  // חלק שני וחתימת הספר
  { title: 'שמירת הלשון', portion: 'חלק שני, פרק א׳', desc: 'התחזקות בשמירת המצוות והדיבור בדורות האחרונים', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'חלק שני, פרק ב׳', desc: 'התעוררות לתשובה, תיקון המידות וציפייה לישועה', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'חלק שני, פרק ג׳', desc: 'גודל מעלת אהבת ישראל ועין טובה על כל אדם', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'חלק שני, פרק ד׳', desc: 'לימוד זכות על כל יהודי וסגולתו לפתיחת שערי שמים', book: 'שמירת הלשון' },
  { title: 'שמירת הלשון', portion: 'חלק שני, פרקים ה׳-ז׳', desc: 'ציפייה לישועה, החזקת התורה והשראת השכינה', book: 'שמירת הלשון' },
  { title: 'חתימת הספר', portion: 'חתימת ספר שמירת הלשון', desc: 'תפילה מעומק הלב על שמירת הלשון וסיום מחזור הלימוד', book: 'שמירת הלשון' }
];

/**
 * Calculates the day in the 3-times-a-year cycle (Rabbi Yehuda Zev Segal zt"l)
 * 120 days cycle starting on:
 * - Round 1: 1 Tishrei
 * - Round 2: 1 Shevat
 * - Round 3: 1 Sivan
 */
export function getHebrewDayInThreeTimesCycle(date: Date = new Date()): { dayInCycle: number; roundNumber: number; roundName: string } {
  try {
    const partsEn = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long' }).formatToParts(date);
    const day = parseInt(partsEn.find(p => p.type === 'day')?.value || '1', 10);
    const month = (partsEn.find(p => p.type === 'month')?.value || '').toLowerCase().trim();

    // Round 1: Tishrei (30), Cheshvan (29/30), Kislev (29/30), Tevet (29) -> 120 days
    if (month.includes('tishr')) return { dayInCycle: Math.min(120, Math.max(1, day)), roundNumber: 1, roundName: 'מחזור א׳ (תשרי-טבת)' };
    if (month.includes('chesh') || month.includes('hesh') || month.includes('marche')) return { dayInCycle: Math.min(120, 30 + day), roundNumber: 1, roundName: 'מחזור א׳ (תשרי-טבת)' };
    if (month.includes('kisl')) return { dayInCycle: Math.min(120, 59 + day), roundNumber: 1, roundName: 'מחזור א׳ (תשרי-טבת)' };
    if (month.includes('teve')) return { dayInCycle: Math.min(120, 89 + day), roundNumber: 1, roundName: 'מחזור א׳ (תשרי-טבת)' };

    // Round 2: Shevat (30), Adar/Adar I/II (29/30), Nisan (30), Iyar (29) -> 120 days
    if (month.includes('shev')) return { dayInCycle: Math.min(120, Math.max(1, day)), roundNumber: 2, roundName: 'מחזור ב׳ (שבט-אייר)' };
    if (month.includes('adar')) {
      if (month.includes('ii') || month.includes('2')) {
        return { dayInCycle: Math.min(120, 30 + Math.floor(day / 2) + 15), roundNumber: 2, roundName: 'מחזור ב׳ (שבט-אייר)' };
      }
      return { dayInCycle: Math.min(120, 30 + day), roundNumber: 2, roundName: 'מחזור ב׳ (שבט-אייר)' };
    }
    if (month.includes('nisa')) return { dayInCycle: Math.min(120, 60 + day), roundNumber: 2, roundName: 'מחזור ב׳ (שבט-אייר)' };
    if (month.includes('iyar') || month.includes('iyyar')) return { dayInCycle: Math.min(120, 90 + day), roundNumber: 2, roundName: 'מחזור ב׳ (שבט-אייר)' };

    // Round 3: Sivan (30), Tamuz (29), Av (30), Elul (29) -> 120 days
    if (month.includes('siva')) return { dayInCycle: Math.min(120, Math.max(1, day)), roundNumber: 3, roundName: 'מחזור ג׳ (סיוון-אלול)' };
    if (month.includes('tamu')) return { dayInCycle: Math.min(120, 30 + day), roundNumber: 3, roundName: 'מחזור ג׳ (סיוון-אלול)' };
    if (month.includes('av')) return { dayInCycle: Math.min(120, 59 + day), roundNumber: 3, roundName: 'מחזור ג׳ (סיוון-אלול)' };
    if (month.includes('elul')) return { dayInCycle: Math.min(120, 89 + day), roundNumber: 3, roundName: 'מחזור ג׳ (סיוון-אלול)' };

    return { dayInCycle: Math.min(120, Math.max(1, day)), roundNumber: 1, roundName: 'מחזור א׳ (תשרי-טבת)' };
  } catch {
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
    return { dayInCycle: (dayOfYear % 120) + 1, roundNumber: Math.floor((dayOfYear % 360) / 120) + 1, roundName: 'מחזור 3 פעמים בשנה' };
  }
}

/**
 * Approximate Hebrew Date calculation
 */
export function getHebrewDateString(date: Date = new Date()): string {
  try {
    const formatted = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
    return formatted;
  } catch {
    return 'י״ח תשרי תשפ״ו';
  }
}

/**
 * Parashat Hashavua estimation based on date
 */
export const PARASHIOT_LIST = [
  'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ', 'ויגש', 'ויחי',
  'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה', 'כי תשא', 'ויקהל', 'פקודי',
  'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקתי',
  'במדבר', 'נשא', 'בהעלותך', 'שלח לך', 'קרח', 'חקת', 'בלק', 'פינחס', 'מטות', 'מסעי',
  'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא', 'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
];

export function getWeeklyParasha(date: Date = new Date()): string {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const weekIndex = Math.floor(dayOfYear / 7) % PARASHIOT_LIST.length;
  return PARASHIOT_LIST[weekIndex] || 'בראשית';
}

/**
 * Calculate World Halacha Yomi (Daf HaYomi BaHalacha - Mishna Berura / Shulchan Aruch)
 */
export function calculateHalachaYomit(
  targetDate: Date = new Date(),
  method: 'dirshu_mishna_berura' | 'shulchan_aruch' | 'kitzur_shulchan_aruch' | 'rambam_halacha' = 'dirshu_mishna_berura'
): { bookTitle: string; portion: string; description: string; siman?: number } {
  const dayOfYear = Math.floor((targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));

  if (method === 'dirshu_mishna_berura') {
    // Dirshu Daf Yomi BaHalacha: cycles through Mishna Berura 6 volumes
    const chelek = ((Math.floor(dayOfYear / 60)) % 6) + 1;
    const simanNum = (dayOfYear % 120) + 1;
    return {
      bookTitle: `משנה ברורה - חלק ${numberToHebrew(chelek)}`,
      portion: `חלק ${numberToHebrew(chelek)}: סימן ${numberToHebrew(simanNum)}`,
      description: `הדף היומי בהלכה (דרשו) - משנה ברורה, ביאור הלכה ושער הציון`,
      siman: simanNum
    };
  }

  if (method === 'kitzur_shulchan_aruch') {
    const simanNum = (dayOfYear % 221) + 1;
    return {
      bookTitle: 'קיצור שולחן ערוך',
      portion: `סימן ${numberToHebrew(simanNum)} - סעיפים א׳-ה׳`,
      description: `לימוד הלכה יומית בקיצור שולחן ערוך לגנצפריד`,
      siman: simanNum
    };
  }

  if (method === 'rambam_halacha') {
    const perekNum = (dayOfYear % 14) + 1;
    return {
      bookTitle: 'משנה תורה לרמב"ם',
      portion: `ספר המדע - הלכות דעות פרק ${numberToHebrew(perekNum)}`,
      description: `לימוד הלכות היד החזקה לרמב"ם`
    };
  }

  // Default: Shulchan Aruch Orach Chaim
  const simanNum = (dayOfYear % 697) + 1;
  return {
    bookTitle: 'שולחן ערוך אורח חיים',
    portion: `סימן ${numberToHebrew(simanNum)}`,
    description: `הלכה יומית מתוך שולחן ערוך המחבר והרמ"א`,
    siman: simanNum
  };
}

/**
 * Calculate Chofetz Chaim daily schedule
 * Default: 'world_three_times' (Rabbi Yehuda Zev Segal zt"l - 3 times a year / 4 months cycle)
 */
export function calculateChofetzChaim(
  targetDate: Date = new Date(),
  scheduleType: 'world_three_times' | 'world_annual' | 'world_biannual' | 'daily_order' = 'world_three_times'
): { bookTitle: string; portion: string; description: string; dayIndex: number } {
  // 1. Default and most widely practiced worldwide schedule: 3 times a year (4 months per cycle)
  if (scheduleType === 'world_three_times' || !scheduleType) {
    const { dayInCycle, roundName } = getHebrewDayInThreeTimesCycle(targetDate);
    const itemIndex = Math.min(CHOFETZ_CHAIM_120_DAYS.length - 1, Math.max(0, dayInCycle - 1));
    const item = CHOFETZ_CHAIM_120_DAYS[itemIndex];
    return {
      bookTitle: item.book === 'חפץ חיים' ? 'ספר חפץ חיים' : 'ספר שמירת הלשון',
      portion: `${item.title}: ${item.portion}`,
      description: `${item.desc} (מסלול 3 פעמים בשנה - ${roundName}, יום ${numberToHebrew(dayInCycle)})`,
      dayIndex: dayInCycle
    };
  }

  // 2. Annual or Biannual schedule
  const dayOfYear = Math.floor((targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const idx = scheduleType === 'world_biannual'
    ? (dayOfYear * 2) % CHOFETZ_CHAIM_120_DAYS.length
    : dayOfYear % CHOFETZ_CHAIM_120_DAYS.length;

  const item = CHOFETZ_CHAIM_120_DAYS[idx];
  return {
    bookTitle: item.book === 'חפץ חיים' ? 'ספר חפץ חיים' : 'ספר שמירת הלשון',
    portion: `${item.title}: ${item.portion}`,
    description: `${item.desc} (לימוד חפץ חיים יומי)`,
    dayIndex: idx + 1
  };
}

/**
 * Build Full Daily Study List based on user selection tracks and custom tracks
 */
export function getDailyStudySchedule(
  tracks: {
    dafYomi?: boolean;
    parasha?: boolean;
    chofetzChaim?: boolean;
    mishnahYomi?: boolean;
    rambam?: boolean;
    halachaYomit?: boolean;
    tanakhYomi?: boolean;
  } = { dafYomi: true, parasha: true, chofetzChaim: true, mishnahYomi: true, halachaYomit: true, rambam: true, tanakhYomi: true },
  options?: {
    halachaYomitScheduleType?: 'dirshu_mishna_berura' | 'shulchan_aruch' | 'kitzur_shulchan_aruch' | 'rambam_halacha';
    chofetzChaimScheduleType?: 'world_three_times' | 'world_annual' | 'world_biannual' | 'daily_order';
    customDailyStudies?: CustomDailyStudy[];
  }
): DailyStudyItem[] {
  const items: DailyStudyItem[] = [];
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));

  // 1. דף יומי בבלי
  if (tracks.dafYomi !== false) {
    const daf = calculateDafYomi(today);
    items.push({
      id: 'daf_yomi',
      type: 'daf_yomi',
      title: 'דף יומי בבלי',
      bookTitle: daf.bookTitle,
      portion: `${daf.masechet} ${daf.dafHebrew}`,
      description: `מחזור י״ד העולמי: מסכת ${daf.masechet} ${daf.dafHebrew}`,
      badge: 'ש״ס בבלי'
    });
  }

  // 2. חפץ חיים ושמירת הלשון (ברירת מחדל: מסלול 3 פעמים בשנה)
  if (tracks.chofetzChaim !== false) {
    const chofetz = calculateChofetzChaim(today, options?.chofetzChaimScheduleType || 'world_three_times');
    items.push({
      id: 'chofetz_chaim',
      type: 'chofetz_chaim',
      title: 'חפץ חיים יומי',
      bookTitle: chofetz.bookTitle,
      portion: chofetz.portion,
      description: chofetz.description,
      badge: '3 פעמים בשנה'
    });
  }

  // 3. הלכה יומית (הדף היומי בהלכה / שו"ע / משנה ברורה)
  if (tracks.halachaYomit !== false) {
    const halacha = calculateHalachaYomit(today, options?.halachaYomitScheduleType);
    items.push({
      id: 'halacha_yomit',
      type: 'halacha_yomit',
      title: 'הלכה יומית',
      bookTitle: halacha.bookTitle,
      portion: halacha.portion,
      description: halacha.description,
      badge: 'הלכה'
    });
  }

  // 4. פרשת השבוע
  if (tracks.parasha !== false) {
    const parasha = getWeeklyParasha(today);
    items.push({
      id: 'parasha',
      type: 'parasha',
      title: 'פרשת השבוע',
      bookTitle: `חומש - פרשת ${parasha}`,
      portion: `פרשת ${parasha}`,
      description: `קריאת פרשת השבוע, שניים מקרא ואחד תרגום ומפרשי רש״י`,
      badge: 'תורה'
    });
  }

  // 5. משנה יומית
  if (tracks.mishnahYomi !== false) {
    const mishnaMasechtot = ['ברכות', 'פאה', 'דמאי', 'כלאים', 'שביעית', 'תרומות', 'מעשרות', 'שבת', 'עירובין', 'פסחים', 'אבות', 'סנהדרין', 'בבא קמא', 'בבא מציעא', 'בבא בתרא'];
    const mas = mishnaMasechtot[dayOfYear % mishnaMasechtot.length];
    const perekNum = (dayOfYear % 10) + 1;
    items.push({
      id: 'mishnah_yomi',
      type: 'mishnah_yomi',
      title: 'משנה יומית',
      bookTitle: `משנה - ${mas}`,
      portion: `${mas} פרק ${numberToHebrew(perekNum)} משניות א׳-ב׳`,
      description: `סדר המשנה היומית: 2 משניות ליום במסכת ${mas}`,
      badge: 'משנה'
    });
  }

  // 6. רמב"ם יומי
  if (tracks.rambam) {
    const rambamPerek = (dayOfYear % 14) + 1;
    items.push({
      id: 'rambam',
      type: 'rambam',
      title: 'רמב"ם יומי',
      bookTitle: 'משנה תורה לרמב"ם',
      portion: `ספר המדע - הלכות תשובה פרק ${numberToHebrew(rambamPerek)}`,
      description: `לימוד רמב"ם יומי מתוך היד החזקה`,
      badge: 'רמב״ם'
    });
  }

  // 7. תנ"ך יומי (929)
  if (tracks.tanakhYomi) {
    const tanakhPerek = (dayOfYear % 929) + 1;
    items.push({
      id: 'tanakh_yomi',
      type: 'tanakh_yomi',
      title: 'תנ"ך יומי (929)',
      bookTitle: 'תנ"ך',
      portion: `פרק ${numberToHebrew(tanakhPerek)}`,
      description: `פרק יומי בקריאת התנ"ך`,
      badge: 'תנ״ך'
    });
  }

  // 8. לימודים מותאמים אישית (Custom Study Tracks)
  if (options?.customDailyStudies && options.customDailyStudies.length > 0) {
    for (const custom of options.customDailyStudies) {
      if (!custom.active) continue;

      let currentUnitNum = custom.currentUnit || 1;
      if (custom.startDate) {
        const start = new Date(custom.startDate);
        const diffDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const rate = custom.unitsPerDay || 1;
        currentUnitNum = (custom.currentUnit || 1) + diffDays * rate;
      }

      let portionText = `יחידה ${numberToHebrew(currentUnitNum)}`;
      if (custom.paceType === 'daf') portionText = `דף ${numberToHebrew(currentUnitNum)}`;
      else if (custom.paceType === 'page') portionText = `עמוד ${currentUnitNum}`;
      else if (custom.paceType === 'chapter') portionText = `פרק ${numberToHebrew(currentUnitNum)}`;
      else if (custom.paceType === 'siman') portionText = `סימן ${numberToHebrew(currentUnitNum)}`;

      items.push({
        id: custom.id,
        type: 'custom',
        title: custom.title,
        bookTitle: custom.bookTitle,
        bookId: custom.bookId,
        portion: portionText,
        description: custom.description || `לימוד יומי אישי בקצב ${portionText}`,
        badge: 'מותאם אישית',
        isCustom: true
      });
    }
  }

  return items;
}

/**
 * Intelligent Matcher to find the best book in Otzaria Catalog for a daily study item
 */
export function findMatchingBookForDailyStudy(
  item: DailyStudyItem,
  books: BookItem[]
): BookItem | undefined {
  if (!books || books.length === 0) return undefined;

  // 1. If explicit bookId exists (e.g. from Custom Study Track or exact catalog reference)
  if (item.bookId) {
    const exactById = books.find(b => String(b.id) === String(item.bookId));
    if (exactById) return exactById;
  }

  const normQuery = (str: string) =>
    str.replace(/[-"'\״\׳]/g, '').toLowerCase().trim();

  const itemTitleClean = normQuery(item.title || '');
  const bookTitleClean = normQuery(item.bookTitle || '');
  const portionClean = normQuery(item.portion || '');

  // 2. Specific Heuristics based on Study Track Type
  if (item.type === 'daf_yomi') {
    // Extract masechet name (e.g., "ברכות", "שבת", "בבא מציעא"...)
    for (const m of DAF_YOMI_MASECHTOT) {
      if (
        item.portion.includes(m.name) ||
        item.bookTitle.includes(m.name) ||
        item.description.includes(m.name)
      ) {
        const mClean = normQuery(m.name);
        // Priority 1: Exact masechet title or Talmud Bavli masechet title
        const mExact = books.find(b => {
          const bClean = normQuery(b.title);
          return (
            bClean === mClean ||
            bClean === `תלמוד בבלי ${mClean}` ||
            bClean === `מסכת ${mClean}` ||
            bClean === `תלמוד בבלי מסכת ${mClean}`
          );
        });
        if (mExact) return mExact;

        // Priority 2: Contains masechet name & in Talmud Bavli category
        const mBavli = books.find(b => {
          const bClean = normQuery(b.title);
          const catClean = normQuery(b.categoryPath || '');
          return (
            (bClean.includes(mClean) || mClean.includes(bClean)) &&
            (catClean.includes('בבלי') || catClean.includes('תלמוד') || bClean.includes('בבלי')) &&
            !bClean.includes('ירושלמי') &&
            !bClean.includes('חידושי') &&
            !bClean.includes('פירוש') &&
            !bClean.includes('שיעור')
          );
        });
        if (mBavli) return mBavli;

        // Priority 3: Primary masechet book title without commentary words
        const mCleanCandidate = books.find(b => {
          const bClean = normQuery(b.title);
          return (
            bClean.includes(mClean) &&
            !bClean.includes('ירושלמי') &&
            !bClean.includes('חידושי') &&
            !bClean.includes('פירוש') &&
            !bClean.includes('עיונים')
          );
        });
        if (mCleanCandidate) return mCleanCandidate;

        // Priority 4: Any book containing the masechet name in title
        const mAny = books.find(b => normQuery(b.title).includes(mClean));
        if (mAny) return mAny;
      }
    }
  }

  if (item.type === 'parasha') {
    // Determine which Chumash / Book of Torah
    const parashaToChumashMap: Record<string, string> = {
      'בראשית': 'בראשית', 'נח': 'בראשית', 'לך לך': 'בראשית', 'וירא': 'בראשית', 'חיי שרה': 'בראשית', 'תולדות': 'בראשית', 'ויצא': 'בראשית', 'וישלח': 'בראשית', 'וישב': 'בראשית', 'מקץ': 'בראשית', 'ויגש': 'בראשית', 'ויחי': 'בראשית',
      'שמות': 'שמות', 'וארא': 'שמות', 'בא': 'שמות', 'בשלח': 'שמות', 'יתרו': 'שמות', 'משפטים': 'שמות', 'תרומה': 'שמות', 'תצווה': 'שמות', 'כי תשא': 'שמות', 'ויקהל': 'שמות', 'פקודי': 'שמות',
      'ויקרא': 'ויקרא', 'צו': 'ויקרא', 'שמיני': 'ויקרא', 'מצורע': 'ויקרא', 'אחרי מות': 'ויקרא', 'קדושים': 'ויקרא', 'אמור': 'ויקרא', 'בהר': 'ויקרא', 'בחוקותי': 'ויקרא',
      'במדבר': 'במדבר', 'נשוא': 'במדבר', 'בהעלותך': 'במדבר', 'שלח': 'במדבר', 'קרח': 'במדבר', 'חקת': 'במדבר', 'בלק': 'במדבר', 'פינחס': 'במדבר', 'מטות': 'במדבר', 'מסעות': 'במדבר',
      'דברים': 'דברים', 'ואתחנן': 'דברים', 'עקב': 'דברים', 'ראה': 'דברים', 'שופטים': 'דברים', 'כי תצא': 'דברים', 'כי תבוא': 'דברים', 'נצבים': 'דברים', 'וילך': 'דברים', 'האזינו': 'דברים', 'וזאת הברכה': 'דברים'
    };

    let chumashName = 'בראשית';
    for (const [pName, cName] of Object.entries(parashaToChumashMap)) {
      if (item.portion.includes(pName) || item.bookTitle.includes(pName)) {
        chumashName = cName;
        break;
      }
    }

    const cClean = normQuery(chumashName);
    // Find matching chumash book (e.g. "בראשית", "מקראות גדולות בראשית", "חומש בראשית")
    const matchChumash = books.find(b => {
      const bClean = normQuery(b.title);
      const catClean = normQuery(b.categoryPath || '');
      return (
        bClean === cClean ||
        bClean === `חומש ${cClean}` ||
        bClean === `ספר ${cClean}` ||
        ((catClean.includes('תורה') || catClean.includes('מקרא') || catClean.includes('חומש')) && bClean.includes(cClean))
      );
    });
    if (matchChumash) return matchChumash;
  }

  if (item.type === 'chofetz_chaim') {
    const isShmiratHalashon = item.bookTitle.includes('שמירת הלשון');
    const targetNames = isShmiratHalashon
      ? ['ספר שמירת הלשון', 'שמירת הלשון']
      : ['ספר חפץ חיים', 'חפץ חיים'];

    // Priority 1: Exact Title Match
    let matchCC = books.find(b => {
      const bClean = normQuery(b.title);
      return targetNames.some(t => bClean === normQuery(t));
    });
    if (matchCC) return matchCC;

    // Priority 2: Title contains main name, but excluding commentary/secondary books ("על", "ספרא", "התורה", "פירוש")
    matchCC = books.find(b => {
      const bClean = normQuery(b.title);
      const targetClean = isShmiratHalashon ? 'שמירת הלשון' : 'חפץ חיים';
      return (
        bClean.includes(targetClean) &&
        !bClean.includes('על') &&
        !bClean.includes('ספרא') &&
        !bClean.includes('תורה') &&
        !bClean.includes('פירוש') &&
        !bClean.includes('חידושי')
      );
    });
    if (matchCC) return matchCC;

    // Priority 3: Any book with target name
    matchCC = books.find(b => normQuery(b.title).includes(normQuery(isShmiratHalashon ? 'שמירת הלשון' : 'חפץ חיים')));
    if (matchCC) return matchCC;
  }

  if (item.type === 'halacha_yomit') {
    const matchHalacha = books.find(b => {
      const bClean = normQuery(b.title);
      return (
        bClean === 'משנה ברורה' ||
        bClean === 'שולחן ערוך' ||
        bClean === 'ספר משנה ברורה' ||
        bClean === 'ספר שולחן ערוך' ||
        bClean.includes('ילקוט יוסף')
      );
    }) || books.find(b => {
      const bClean = normQuery(b.title);
      return (
        (bClean.includes('משנה ברורה') || bClean.includes('שולחן ערוך')) &&
        !bClean.includes('על') && !bClean.includes('חידושי') && !bClean.includes('מפרש')
      );
    });
    if (matchHalacha) return matchHalacha;
  }

  if (item.type === 'mishnah_yomi') {
    // Try matching exact Mishnayot main book
    const matchMishnah = books.find(b => {
      const bClean = normQuery(b.title);
      return bClean === 'משניות' || bClean === 'ספר משניות' || bClean.startsWith('משנה ');
    }) || books.find(b => {
      const bClean = normQuery(b.title);
      const catClean = normQuery(b.categoryPath || '');
      return (catClean.includes('משנה') || bClean.includes('משנה')) && !bClean.includes('פירוש') && !bClean.includes('על');
    });
    if (matchMishnah) return matchMishnah;
  }

  if (item.type === 'rambam') {
    const matchRambam = books.find(b => {
      const bClean = normQuery(b.title);
      return (
        bClean === 'משנה תורה' ||
        bClean === 'רמבם' ||
        bClean === 'משנה תורה לרמבם' ||
        bClean === 'ספר משנה תורה' ||
        bClean === 'היד החזקה'
      );
    }) || books.find(b => {
      const bClean = normQuery(b.title);
      return (bClean.includes('משנה תורה') || bClean.includes('רמבם')) && !bClean.includes('על') && !bClean.includes('מפרש');
    });
    if (matchRambam) return matchRambam;
  }

  if (item.type === 'tanakh_yomi') {
    const matchTanakh = books.find(b => {
      const bClean = normQuery(b.title);
      return bClean === 'תנך' || bClean === 'מקרא' || bClean === 'תורה' || bClean === 'ספר תנך';
    }) || books.find(b => {
      const bClean = normQuery(b.title);
      return (bClean.includes('תנך') || bClean.includes('מקרא')) && !bClean.includes('על') && !bClean.includes('פירוש');
    });
    if (matchTanakh) return matchTanakh;
  }

  // 3. Exact or Substring title match on bookTitle
  const exactByTitle = books.find(b => {
    const bClean = normQuery(b.title);
    return bClean === bookTitleClean || bookTitleClean.includes(bClean) || bClean.includes(bookTitleClean);
  });
  if (exactByTitle) return exactByTitle;

  // 4. Substring match on portion
  if (portionClean.length > 2) {
    const portionWords = portionClean.split(/\s+/).filter(w => w.length >= 3);
    for (const word of portionWords) {
      if (word === 'פרשת' || word === 'מסכת' || word === 'ספר' || word === 'הלכות') continue;
      const wordMatch = books.find(b => normQuery(b.title).includes(word));
      if (wordMatch) return wordMatch;
    }
  }

  // Fallback first book
  return books[0];
}
