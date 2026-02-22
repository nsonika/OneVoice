import { translate as googleTranslate } from "@vitalets/google-translate-api";

export async function translateText(text, targetLanguage, sourceLanguage = "auto") {
  if (!text?.trim()) return "";
  if (sourceLanguage === targetLanguage) return text;

  const result = await googleTranslate(text, {
    from: sourceLanguage || "auto",
    to: targetLanguage
  });
  return result.text;
}
