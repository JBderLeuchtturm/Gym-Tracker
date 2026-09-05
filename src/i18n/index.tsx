import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Mehrsprachigkeit ohne Schluesselwirrwarr.
 *
 * Der deutsche Text ist zugleich der Schluessel: `t('Sätze')` liefert auf
 * Englisch "Sets" und faellt sonst auf das Deutsche zurueck. Im Quelltext
 * steht damit lesbarer Text statt kryptischer Kuerzel, und eine fehlende
 * Uebersetzung fuehrt nie zu einer leeren Stelle.
 *
 * `t` ist bewusst eine gewoehnliche Funktion und kein Hook - sonst muesste
 * jede der rund vierzig Komponenten zusaetzlich verdrahtet werden. Damit ein
 * Sprachwechsel trotzdem ueberall ankommt, haengt die App an einem Schluessel,
 * der sie beim Wechsel neu aufbaut.
 */

export type Language = 'de' | 'en';

const STORAGE_KEY = 'gym-tracker:language';

/*
 * Deutsch braucht kein Woerterbuch - der Quelltext ist die deutsche Fassung.
 * Das englische wird erst geholt, wenn es gebraucht wird: rund vierzig
 * Kilobyte, die eine deutschsprachige Installation sonst bei jedem Start
 * mitschleppt, ohne sie je zu benutzen.
 */
const DICTIONARIES: Record<Language, Record<string, string>> = { de: {}, en: {} };

let dictionaryLoaded = false;

export async function loadDictionary(language: Language): Promise<void> {
  if (language !== 'en' || dictionaryLoaded) return;
  try {
    const module = await import('./en');
    DICTIONARIES.en = module.EN;
    dictionaryLoaded = true;
  } catch {
    // Ohne Woerterbuch bleibt es beim deutschen Text - unschoen, aber lesbar.
  }
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
};

/** Gespeicherte Wahl, sonst die Sprache des Geraets. */
export function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch { /* privater Modus */ }

  const preferred = typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
  return preferred.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let current: Language = 'de';

/**
 * Uebersetzt einen deutschen Text.
 * Platzhalter der Form {name} werden aus `values` ersetzt.
 */
export function t(text: string, values?: Record<string, string | number>): string {
  let result = DICTIONARIES[current][text] ?? text;
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      result = result.split(`{${key}}`).join(String(value));
    }
  }
  return result;
}

export const currentLanguage = (): Language => current;

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: (language: Language) => React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const detected = detectLanguage();
    current = detected;
    return detected;
  });

  const setLanguage = useCallback((next: Language) => {
    // Erst das Woerterbuch, dann umschalten - sonst steht die Oberflaeche
    // einen Wimpernschlag lang halb uebersetzt da.
    void loadDictionary(next).then(() => {
      current = next;
      document.documentElement.lang = next;
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* egal */ }
      setLanguageState(next);
    });
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children(language)}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n muss innerhalb von <I18nProvider> verwendet werden');
  return value;
}

/**
 * Der anzuzeigende Name einer Uebung.
 * Auf Englisch wird die englische Bezeichnung aus dem Katalog genommen,
 * sofern eine hinterlegt ist - sonst bleibt es beim deutschen Namen.
 */
export function exerciseName(exercise: { name: string; nameEn?: string } | undefined): string {
  if (!exercise) return t('Unbekannte Übung');
  if (current === 'en' && exercise.nameEn) return exercise.nameEn;
  return exercise.name;
}
