import type { MessageKey } from "./es-419";
import { resolveLocale, translate } from "./translate";
import type { MessageParams } from "./translate";
import { LanguagePreference } from "@/types";

const I18N = $state({ locale: resolveLocale(LanguagePreference.Auto) });

export function setLanguage(preference: LanguagePreference | undefined) {
  I18N.locale = resolveLocale(preference);
}

export function getLocale() {
  return I18N.locale;
}

// Reads the locale, so a call inside a template or $derived updates when the language changes
export function t(key: MessageKey, params?: MessageParams) {
  return translate({
    locale: I18N.locale,
    key,
    params
  });
}

// For label tables whose text is data, not a call site; text without an entry shows as written
export function tText(text: string, params?: MessageParams) {
  return translate({
    locale: I18N.locale,
    key: text,
    params
  });
}
