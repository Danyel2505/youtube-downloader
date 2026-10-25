import { getLocale } from "@/lib/i18n/i18n.svelte.ts";
import { LanguagePreference } from "@/types";

export const LANGUAGES: [string, string][] = [
  ["Arabic", "ar"],
  ["Bengali", "bn"],
  ["Chinese (Simplified)", "zh-Hans"],
  ["Chinese (Traditional)", "zh-Hant"],
  ["Czech", "cs"],
  ["Danish", "da"],
  ["Dutch", "nl"],
  ["English", "en"],
  ["Finnish", "fi"],
  ["French", "fr"],
  ["German", "de"],
  ["Greek", "el"],
  ["Hebrew", "iw"],
  ["Hindi", "hi"],
  ["Hungarian", "hu"],
  ["Indonesian", "id"],
  ["Italian", "it"],
  ["Japanese", "ja"],
  ["Korean", "ko"],
  ["Malay", "ms"],
  ["Norwegian", "no"],
  ["Persian", "fa"],
  ["Polish", "pl"],
  ["Portuguese (Brazil)", "pt-BR"],
  ["Portuguese (Portugal)", "pt-PT"],
  ["Romanian", "ro"],
  ["Russian", "ru"],
  ["Spanish", "es"],
  ["Spanish (Latin America)", "es-419"],
  ["Swedish", "sv"],
  ["Thai", "th"],
  ["Turkish", "tr"],
  ["Ukrainian", "uk"],
  ["Urdu", "ur"],
  ["Vietnamese", "vi"]
];

// English keeps the names above; Spanish asks the browser, falling back to the English name
export function getLanguageName({ name, code }: {
  name: string;
  code: string;
}) {
  if (getLocale() === LanguagePreference.English) {
    return name;
  }

  try {
    const spanishName = new Intl.DisplayNames(getLocale(), {
      type: "language",
      languageDisplay: "standard"
    }).of(code);
    return spanishName ? spanishName.charAt(0).toUpperCase() + spanishName.slice(1) : name;
  } catch {
    return name;
  }
}
