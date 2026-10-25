import { ES_419 } from "./es-419";
import { LanguagePreference } from "@/types";
import type { Prettify } from "@/types";

export type Locale = Exclude<LanguagePreference, typeof LanguagePreference.Auto>;
export type MessageParams = Record<string, string | number>;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const SPANISH_LANGUAGE_PREFIX = "es";
const MESSAGES_BY_LOCALE: Record<Locale, Record<string, string | undefined>> = {
  [LanguagePreference.English]: {},
  [LanguagePreference.SpanishLatinAmerica]: ES_419
};

// "auto" follows the browser's language; navigator works in every context, including the page world
export function resolveLocale(preference: LanguagePreference | undefined): Locale {
  const isExplicit = preference === LanguagePreference.English || preference === LanguagePreference.SpanishLatinAmerica;
  if (isExplicit) {
    return preference;
  }

  const isSpanish = navigator.language.toLowerCase().startsWith(SPANISH_LANGUAGE_PREFIX);
  return isSpanish ? LanguagePreference.SpanishLatinAmerica : LanguagePreference.English;
}

type TranslateParams = Prettify<{
  locale: Locale;
  key: string;
  params?: MessageParams;
}>;
export function translate({ locale, key, params }: TranslateParams) {
  const template = MESSAGES_BY_LOCALE[locale][key] ?? key;
  if (!params) {
    return template;
  }

  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) => String(params[name] ?? placeholder));
}
