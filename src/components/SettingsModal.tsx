import React, { useEffect, useState, useRef } from 'react';
import { ReaderSettings, DEFAULT_READER_SETTINGS, BookItem } from '../types/otzaria';
import { CustomStudyModal } from './CustomStudyModal';
import {
  Settings,
  Type,
  Eye,
  X,
  AlignJustify,
  Copy,
  LayoutGrid,
  Calendar,
  Keyboard,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  BookOpen,
  Plus
} from 'lucide-react';
import { downloadBackupJson, restoreBackupFromJson, resetUserSettingsOnCloud } from '../services/userService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onResetSettings: () => void;
  catalogBooks?: BookItem[];
}

type SettingsTab =
  | 'reading'
  | 'text_policy'
  | 'copy'
  | 'library'
  | 'tools'
  | 'shortcuts'
  | 'system';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  catalogBooks = []
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('reading');
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [isCustomStudyModalOpen, setIsCustomStudyModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isDark = settings.theme === 'dark';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, mode: 'merge' | 'replace') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const backupData = JSON.parse(text);
        const res = await restoreBackupFromJson(backupData, mode);
        if (res.settings) {
          onUpdateSettings(res.settings);
        }
        setRestoreMessage('הנתונים שוחזרו בהצלחה מהקובץ!');
        setTimeout(() => setRestoreMessage(null), 4000);
      } catch (err: any) {
        alert('שגיאה בקריאת קובץ הגיבוי: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'reading', label: 'מבנה וקריאה', icon: <AlignJustify className="w-4 h-4" /> },
    { id: 'text_policy', label: 'ניקוד ושמות', icon: <Eye className="w-4 h-4" /> },
    { id: 'copy', label: 'העתקה', icon: <Copy className="w-4 h-4" /> },
    { id: 'library', label: 'ספרייה', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'tools', label: 'זמנים ולימוד', icon: <Calendar className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'קיצורי מקשים', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'system', label: 'מערכת וגיבוי', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className={`w-full max-w-3xl rounded-3xl border shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden ${
        isDark ? 'bg-[#211711] border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'bg-[#1C140F] border-stone-800' : 'bg-stone-50/80 border-stone-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-800 text-amber-100 rounded-2xl shadow-xs">
              <Settings className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className={`text-lg font-bold font-serif ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                הגדרות אוצריא
              </h3>
              <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                התאמת תצוגה, קריאה, ניקוד, סדרי לימוד וגיבוי אישי מלא
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'text-stone-400 hover:text-stone-200 hover:bg-stone-800' : 'text-stone-400 hover:text-stone-800 hover:bg-stone-200/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className={`flex items-center gap-1 px-4 py-2 border-b overflow-x-auto text-xs font-sans select-none scrollbar-none ${
          isDark ? 'bg-[#18110D] border-stone-800' : 'bg-stone-100/70 border-stone-200'
        }`}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-amber-800 text-white font-bold shadow-xs'
                  : isDark
                  ? 'text-stone-400 hover:bg-stone-800 hover:text-stone-200 font-medium'
                  : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 font-medium'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm font-sans">
          {/* TAB 1: READING & LAYOUT */}
          {activeTab === 'reading' && (
            <div className="space-y-5">
              {/* Font Family */}
              <div className="flex flex-col gap-2">
                <label className={`font-semibold flex items-center gap-2 ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                  <Type className="w-4 h-4 text-amber-600" />
                  <span>גופן הטקסט הראשי:</span>
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={e => onUpdateSettings({ fontFamily: e.target.value as any })}
                  className={`w-full rounded-xl p-3 font-serif text-base focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                    isDark
                      ? 'bg-stone-900 border border-stone-700 text-stone-100'
                      : 'bg-stone-50 border border-stone-300 text-stone-900'
                  }`}
                >
                  <option value="Frank Ruhl Hofshi">פרנק רוהל חפשי (קלאסי)</option>
                  <option value="David Libre">דוד ליברה</option>
                  <option value="Heebo">היבו (מודרני וקריא)</option>
                  <option value="Taamey Frank CLM">טעמי פרנק (מתאים לטעמים)</option>
                  <option value="Keter YG">כתר ארם צובא (כתר YG)</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="flex flex-col gap-2">
                <div className={`flex justify-between font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                  <span>גודל הגופן:</span>
                  <span className="text-amber-500 font-bold">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={38}
                  step={1}
                  value={settings.fontSize}
                  onChange={e => onUpdateSettings({ fontSize: parseInt(e.target.value) })}
                  className="w-full accent-amber-800 cursor-pointer"
                />
              </div>

              {/* Line Height */}
              <div className="flex flex-col gap-2">
                <div className={`flex justify-between font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                  <span className="flex items-center gap-2">
                    <AlignJustify className="w-4 h-4 text-amber-600" />
                    <span>מרווח בין שורות (Line Height):</span>
                  </span>
                  <span className="text-amber-500 font-bold">{settings.lineHeight}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1.0, 1.2, 1.5, 1.8, 2.0].map(val => (
                    <button
                      key={val}
                      onClick={() => onUpdateSettings({ lineHeight: val })}
                      className={`py-2 text-xs rounded-xl border font-mono transition-colors cursor-pointer ${
                        settings.lineHeight === val
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {val.toFixed(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Max Width */}
              <div className="flex flex-col gap-2">
                <div className={`flex justify-between font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                  <span>רוחב מקסימלי של הטקסט (מניעת שורות ארוכות):</span>
                  <span className="text-amber-500 font-bold">{settings.textMaxWidth || '90%'}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['70%', '80%', '90%', '100%'].map(w => (
                    <button
                      key={w}
                      onClick={() => onUpdateSettings({ textMaxWidth: w as any })}
                      className={`py-2 text-xs rounded-xl border font-medium transition-colors cursor-pointer ${
                        (settings.textMaxWidth || '90%') === w
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Continuous Reading Mode */}
              <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div className="flex flex-col">
                  <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                    מצב קריאה רציפה בתנ"ך ובתלמוד
                  </span>
                  <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    הצגת פסוקים וקטעים ברצף ללא חלוקת שורה קשיחה
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.continuousReadingMode)}
                  onChange={e => onUpdateSettings({ continuousReadingMode: e.target.checked })}
                  className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                />
              </div>
            </div>
          )}

          {/* TAB 2: TEXT POLICY */}
          {activeTab === 'text_policy' && (
            <div className="space-y-5">
              {/* Nikud Policy */}
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>מדיניות ניקוד:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'ניקוד מלא בכל הספרים' },
                    { id: 'tanakh_only', label: 'ניקוד בתנ"ך בלבד' },
                    { id: 'none', label: 'הסרת ניקוד גורפת' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ nikudPolicy: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                        (settings.nikudPolicy || 'all') === opt.id
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Holy Name Replacement */}
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>החלפת שמות קדושים (שם הוי"ה):</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "ה'", label: "ה׳ (ברירת מחדל)" },
                    { id: "יי", label: "יי" },
                    { id: "ד'", label: "ד׳" },
                    { id: "יהוה", label: "יהוה (ללא שינוי)" }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ holyNameReplacement: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-serif font-bold transition-colors cursor-pointer ${
                        (settings.holyNameReplacement || "ה'") === opt.id
                          ? 'bg-amber-800 text-white border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teamim & Punctuation Toggles */}
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                  isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
                }`}>
                  <div className="flex flex-col">
                    <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>טעמי המקרא</span>
                    <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>הצגת טעמי המקרא בפסוקי תנ"ך</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showTeamim !== false}
                    onChange={e => onUpdateSettings({ showTeamim: e.target.checked })}
                    className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                  />
                </div>

                <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                  isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
                }`}>
                  <div className="flex flex-col">
                    <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>סימני פיסוק</span>
                    <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>הצגת סימני פיסוק מודרניים</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showPunctuation !== false}
                    onChange={e => onUpdateSettings({ showPunctuation: e.target.checked })}
                    className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                  />
                </div>

                {/* Commentary Display View Mode */}
                <div className="flex flex-col gap-2 pt-2">
                  <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                    אופן תצוגת מפרשים וקישורים:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'auto', label: 'אוטומטי (מובייל: מתחת לשורה, מחשב: פאנל צד)' },
                      { id: 'side_panel', label: 'פאנל צדדי (ברירת מחדל במחשב)' },
                      { id: 'inline', label: 'משולב מתחת לשורה (מומלץ למובייל)' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => onUpdateSettings({ commentaryViewMode: opt.id as any })}
                        className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                          (settings.commentaryViewMode || 'auto') === opt.id
                            ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                            : isDark
                            ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                            : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COPY SETTINGS */}
          {activeTab === 'copy' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>צירוף כותרת ומקור בהעתקת טקסט:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'always', label: 'תמיד (הוסף מקור)' },
                    { id: 'never', label: 'אף פעם (טקסט בלבד)' },
                    { id: 'ask', label: 'שאל בכל העתקה' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ copyIncludeHeader: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                        (settings.copyIncludeHeader || 'always') === opt.id
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>פורמט הכותרת בהעתקה:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'title_and_ref', label: 'שם הספר וסעיף/פסוק' },
                    { id: 'title_only', label: 'שם הספר בלבד' },
                    { id: 'full_path', label: 'נתיב מלא (ספרייה > מדור)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ copyHeaderFormat: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                        (settings.copyHeaderFormat || 'title_and_ref') === opt.id
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>אופן תצוגת רשימת הספרים:</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'grid', label: 'כרטיסים (Grid)' },
                    { id: 'list', label: 'רשימה מסודרת (List)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ libraryViewMode: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                        (settings.libraryViewMode || 'grid') === opt.id
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div className="flex flex-col">
                  <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>פאנל תצוגה מקדימה לספר</span>
                  <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    הצגת פרטי ספר מהירים לפני פתיחה מלאה
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showBookPreview !== false}
                  onChange={e => onUpdateSettings({ showBookPreview: e.target.checked })}
                  className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                />
              </div>
            </div>
          )}

          {/* TAB 5: ZMANIM & DAILY STUDY */}
          {activeTab === 'tools' && (
            <div className="space-y-5">
              {/* Location */}
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>מיקום לחישוב זמני היום:</label>
                <select
                  value={settings.calendarLocation || 'ירושלים'}
                  onChange={e => onUpdateSettings({ calendarLocation: e.target.value })}
                  className={`w-full rounded-xl p-3 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                    isDark
                      ? 'bg-stone-900 border border-stone-700 text-stone-100'
                      : 'bg-stone-50 border border-stone-300 text-stone-900'
                  }`}
                >
                  <option value="ירושלים">ירושלים</option>
                  <option value="בני ברק">בני ברק / גוש דן</option>
                  <option value="צפת">צפת והגליל</option>
                  <option value="חיפה">חיפה והקריות</option>
                  <option value="באר שבע">באר שבע והדרום</option>
                  <option value="ניו יורק">ניו יורק (New York)</option>
                  <option value="לונדון">לונדון (London)</option>
                </select>
              </div>

              {/* Zmanim calculation method */}
              <div className="flex flex-col gap-2">
                <label className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>מנהגי זמנים ושיטות חישוב:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'gra', label: 'שיטת הגר"א (זריחה עד שקיעה)' },
                    { id: 'mga', label: 'שיטת מגן אברהם (עלות עד צאת)' },
                    { id: 'baal_hatanya', label: 'בעל התניא' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdateSettings({ zmanimMethod: opt.id as any })}
                      className={`p-3 text-xs rounded-xl border text-center font-medium transition-colors cursor-pointer ${
                        (settings.zmanimMethod || 'gra') === opt.id
                          ? 'bg-amber-800 text-white font-bold border-amber-800 shadow-xs'
                          : isDark
                          ? 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-300 text-stone-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Study Schedule */}
              <div className={`p-4 rounded-2xl border space-y-4 ${
                isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>הצגת באנר לימוד יומי בספרייה</span>
                    <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                      הצגת באנר קיצורי דרך לכל הלימודים היומיים בראש מסך הספרייה
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.showDailyStudy)}
                    onChange={e => onUpdateSettings({ showDailyStudy: e.target.checked })}
                    className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                  />
                </div>

                {/* Calculation Track Methods */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>
                      לוח הלכה יומית:
                    </label>
                    <select
                      value={settings.halachaYomitScheduleType || 'dirshu_mishna_berura'}
                      onChange={e => onUpdateSettings({ halachaYomitScheduleType: e.target.value as any })}
                      className={`w-full rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                        isDark ? 'bg-stone-950 border border-stone-700 text-stone-100' : 'bg-white border border-stone-300 text-stone-900'
                      }`}
                    >
                      <option value="dirshu_mishna_berura">הדף היומי בהלכה (דרשו - משנה ברורה)</option>
                      <option value="shulchan_aruch">שולחן ערוך אורח חיים (סעיף/סימן ליום)</option>
                      <option value="kitzur_shulchan_aruch">קיצור שולחן ערוך (גנצפריד)</option>
                      <option value="rambam_halacha">משנה תורה לרמב"ם (ספר המדע / הלכות)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={`text-xs font-semibold ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>
                      לוח חפץ חיים ושמירת הלשון:
                    </label>
                    <select
                      value={settings.chofetzChaimScheduleType || 'world_three_times'}
                      onChange={e => onUpdateSettings({ chofetzChaimScheduleType: e.target.value as any })}
                      className={`w-full rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                        isDark ? 'bg-stone-950 border border-stone-700 text-stone-100' : 'bg-white border border-stone-300 text-stone-900'
                      }`}
                    >
                      <option value="world_three_times">לוח הגרז״ו סגל - 3 פעמים בשנה (מחזור 4 חודשים - ברירת מחדל)</option>
                      <option value="world_annual">לוח החפץ חיים - סבב שנתי (מתשרי עד אלול)</option>
                      <option value="world_biannual">לוח החפץ חיים - סבב חצי-שנתי</option>
                      <option value="daily_order">סדר רציף שער אחר שער</option>
                    </select>
                  </div>
                </div>

                {/* Custom Study Manage Button */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-stone-950/60 border-stone-800' : 'bg-white border-stone-200'
                }`}>
                  <div>
                    <span className="font-semibold text-xs block">לימודים יומיים מותאמים אישית</span>
                    <span className="text-[11px] text-stone-400">
                      {settings.customDailyStudies && settings.customDailyStudies.length > 0
                        ? `מוגדרים ${settings.customDailyStudies.length} לימודים מותאמים אישית`
                        : 'הוסף ספרים וקצבי לימוד עצמאיים'}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCustomStudyModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-800/20 hover:bg-amber-800 hover:text-white text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>נהל לימודים אישיים</span>
                  </button>
                </div>

                <div className={`pt-3 border-t space-y-2.5 ${isDark ? 'border-stone-800' : 'border-stone-200/80'}`}>
                  <span className={`text-xs font-bold block ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>
                    מסלולי לימוד יומיים פעילים:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'dafYomi', label: 'דף יומי בבלי (מחושב לפי מחזור הש"ס)' },
                      { key: 'chofetzChaim', label: 'ספר חפץ חיים ושמירת הלשון' },
                      { key: 'parasha', label: 'פרשת השבוע ושניים מקרא' },
                      { key: 'mishnahYomi', label: 'משנה יומית (2 משניות ליום)' },
                      { key: 'halachaYomit', label: 'הלכה יומית (לפי לוח הנבחר)' },
                      { key: 'rambam', label: 'רמב"ם יומי (משנה תורה)' },
                      { key: 'tanakhYomi', label: 'תנ"ך יומי (פרק ליום / 929)' }
                    ].map(track => {
                      const tracks = settings.dailyStudyTracks || {
                        dafYomi: true,
                        parasha: true,
                        chofetzChaim: true,
                        mishnahYomi: true,
                        halachaYomit: true,
                        rambam: true,
                        tanakhYomi: true
                      };
                      const isChecked = (tracks as any)[track.key] !== false;
                      return (
                        <label
                          key={track.key}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
                            isChecked
                              ? isDark
                                ? 'bg-amber-950/60 border-amber-800 text-amber-200 font-medium'
                                : 'bg-amber-50/80 border-amber-300 text-amber-950 font-medium'
                              : isDark
                              ? 'bg-stone-900 border-stone-800 text-stone-400'
                              : 'bg-white border-stone-200 text-stone-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e =>
                              onUpdateSettings({
                                dailyStudyTracks: {
                                  ...tracks,
                                  [track.key]: e.target.checked
                                }
                              })
                            }
                            className="accent-amber-800 rounded"
                          />
                          <span>{track.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                התאמה אישית של קיצורי המקלדת לניווט מהיר וללא שימוש בעכבר:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'nextPage', label: 'דף / עמוד הבא בספר', defaultKey: 'PageDown' },
                  { key: 'prevPage', label: 'דף / עמוד הקודם בספר', defaultKey: 'PageUp' },
                  { key: 'nextChapter', label: 'פרק / סימן הבא', defaultKey: 'Alt+ArrowDown' },
                  { key: 'prevChapter', label: 'פרק / סימן הקודם', defaultKey: 'Alt+ArrowUp' },
                  { key: 'searchBook', label: 'חיפוש בתוך הספר', defaultKey: 'Ctrl+F' },
                  { key: 'searchGlobal', label: 'חיפוש כללי במאגר', defaultKey: 'Ctrl+Shift+F' },
                  { key: 'toggleCommentary', label: 'פתיחה/סגירת פאנל מפרשים', defaultKey: 'Ctrl+M' },
                  { key: 'toggleToc', label: 'פתיחה/סגירת תוכן עניינים', defaultKey: 'Ctrl+T' },
                  { key: 'increaseFont', label: 'הגדלת גופן', defaultKey: 'Ctrl+=' },
                  { key: 'decreaseFont', label: 'הקטנת גופן', defaultKey: 'Ctrl+-' }
                ].map(item => {
                  const currentKey = (settings.shortcuts as any)?.[item.key] || item.defaultKey;
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <span className={`text-xs font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>{item.label}</span>
                      <input
                        type="text"
                        value={currentKey}
                        onChange={e =>
                          onUpdateSettings({
                            shortcuts: {
                              ...settings.shortcuts,
                              [item.key]: e.target.value
                            }
                          })
                        }
                        className={`w-28 text-center text-xs font-mono py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-600 ${
                          isDark ? 'bg-stone-950 border-stone-700 text-amber-400' : 'bg-white border-stone-300 text-amber-900 font-bold'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: SYSTEM & BACKUP */}
          {activeTab === 'system' && (
            <div className="space-y-5">
              {/* Per-book settings */}
              <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div className="flex flex-col">
                  <span className={`font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>הגדרות פר-ספר (Per-Book)</span>
                  <span className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    זכור גודל גופן, מיקום ומפרשים שנבחרו עבור כל ספר בנפרד
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.perBookSettingsEnabled !== false}
                  onChange={e => onUpdateSettings({ perBookSettingsEnabled: e.target.checked })}
                  className="w-5 h-5 accent-amber-800 cursor-pointer rounded"
                />
              </div>

              {/* Backup & Restore */}
              <div className={`p-5 rounded-2xl border space-y-4 ${
                isDark ? 'bg-stone-900/60 border-stone-800' : 'bg-stone-50 border-stone-200'
              }`}>
                <div className="flex flex-col gap-1">
                  <h4 className={`font-bold font-serif ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                    גיבוי ושחזור נתונים (Backup & Restore)
                  </h4>
                  <p className={`text-xs ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    קובץ גיבוי זה מכיל את כל הסימניות, היסטוריית הקריאה וההגדרות האישיות שלך.
                  </p>
                  <p className="text-[11px] text-amber-600 font-medium">
                    * שים לב: קובץ הגיבוי מיועד לגרסת ה-Web ולא בהכרח יתאים ישירות לתוכנת השולחן עבודה.
                  </p>
                </div>

                {restoreMessage && (
                  <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs rounded-xl font-bold">
                    {restoreMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => downloadBackupJson()}
                    className="p-3 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ייצוא גיבוי לקובץ JSON</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
                        : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-800'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>ייבוא ושחזור מגיבוי</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={e => handleFileUpload(e, 'replace')}
                />
              </div>

              {/* Reset to defaults */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-red-950/30 border-red-900/60' : 'bg-red-50/60 border-red-200'
              }`}>
                <div>
                  <h4 className={`font-semibold text-xs ${isDark ? 'text-red-300' : 'text-stone-800'}`}>איפוס כל ההגדרות</h4>
                  <p className={`text-[11px] ${isDark ? 'text-red-400' : 'text-stone-500'}`}>מחזיר את כל הגדרות הקריאה והמראה לברירות המחדל</p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('האם אתה בטוח שברצונך לאפס את כל ההגדרות לברירות המחדל?')) {
                      await resetUserSettingsOnCloud();
                      onResetSettings();
                    }
                  }}
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>איפוס הגדרות</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Study Modal */}
      <CustomStudyModal
        isOpen={isCustomStudyModalOpen}
        onClose={() => setIsCustomStudyModalOpen(false)}
        settings={settings}
        catalogBooks={catalogBooks}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
