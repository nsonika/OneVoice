import { LingoDotDevEngine } from "lingo.dev/sdk";
import { config } from "../config.js";

const lingoEngine = config.lingoApiKey
  ? new LingoDotDevEngine({
      apiKey: config.lingoApiKey
    })
  : null;

export async function translateText(text, targetLanguage, sourceLanguage = "auto") {
  if (!text?.trim()) return "";
  if (sourceLanguage === targetLanguage) return text;
  if (!lingoEngine) {
    throw new Error("LINGO_API_KEY is not configured");
  }

  return lingoEngine.localizeText(text, {
    sourceLocale: sourceLanguage === "auto" ? null : sourceLanguage,
    targetLocale: targetLanguage
  });
}
