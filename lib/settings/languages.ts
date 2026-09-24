export interface LanguageOption {
  code: string;
  label: string;
  region: string;
  popular?: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en-US", label: "English", region: "US", popular: true },
  { code: "ru", label: "Русский", region: "RU", popular: true },
  { code: "vi", label: "Tiếng Việt", region: "VN", popular: true },
  { code: "tr", label: "Türkçe", region: "TR", popular: true },
  { code: "es", label: "Español", region: "ES", popular: true },
  { code: "ar", label: "Arabic", region: "AR" },
  { code: "bg", label: "Bulgarian", region: "BG" },
  { code: "cs", label: "Czech", region: "CZ" },
  { code: "da", label: "Danish", region: "DK" },
  { code: "de", label: "German", region: "DE" },
  { code: "el", label: "Greek", region: "GR" },
  { code: "hi", label: "Hindi", region: "IN" },
  { code: "hu", label: "Hungarian", region: "HU" },
  { code: "id", label: "Bahasa Indonesia", region: "ID" },
  { code: "it", label: "Italian", region: "IT" },
  { code: "ja", label: "Japanese", region: "JP" },
  { code: "ko", label: "Korean", region: "KR" },
  { code: "fr", label: "French", region: "FR" },
  { code: "nl", label: "Dutch", region: "NL" },
  { code: "pl", label: "Polish", region: "PL" },
  { code: "pt", label: "Portuguese", region: "PT" },
  { code: "ro", label: "Romanian", region: "RO" },
  { code: "sv", label: "Swedish", region: "SE" },
  { code: "th", label: "Thai", region: "TH" },
  { code: "uk", label: "Ukrainian", region: "UA" },
  { code: "zh-CN", label: "Chinese Simplified", region: "CN" },
];

export function getLanguage(code: string): LanguageOption | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function popularLanguages(): LanguageOption[] {
  return LANGUAGES.filter((l) => l.popular);
}

export function allLanguagesSorted(): LanguageOption[] {
  return [...LANGUAGES].sort((a, b) => a.label.localeCompare(b.label));
}
