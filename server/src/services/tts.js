import { config } from "../config.js";

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

export async function textToSpeechBase64(text, language = "en") {
  if (!config.sarvamApiKey) {
    throw new Error("SARVAM_API_KEY is not configured");
  }
  if (!text?.trim()) {
    return null;
  }

  const targetLanguageCode = toBcp47Language(language);
  if (!targetLanguageCode) {
    throw new Error(`Unsupported TTS language: ${language}`);
  }

  const response = await fetch(SARVAM_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": config.sarvamApiKey
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: targetLanguageCode,
      speaker: config.sarvamTtsSpeaker,
      model: config.sarvamTtsModel,
      enable_preprocessing: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam TTS failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const audioBase64 = data?.audios?.[0] || data?.audio || null;
  return audioBase64;
}

function toBcp47Language(language) {
  const map = {
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    te: "te-IN",
    ml: "ml-IN",
    kn: "kn-IN",
    bn: "bn-IN",
    gu: "gu-IN",
    mr: "mr-IN"
  };

  const lower = String(language || "").toLowerCase();
  if (lower.includes("-")) return language;
  return map[lower] || null;
}
