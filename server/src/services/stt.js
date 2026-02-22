import { config } from "../config.js";

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";

export async function speechToText(audioBase64, hintLanguage = "auto") {
  if (!config.sarvamApiKey) {
    throw new Error("SARVAM_API_KEY is not configured");
  }
  if (!audioBase64?.trim()) {
    throw new Error("audioBase64 is required for STT");
  }

  const { mimeType, buffer, extension } = parseBase64Audio(audioBase64);
  const file = new Blob([buffer], { type: mimeType });

  const form = new FormData();
  form.append("file", file, `voice.${extension}`);
  form.append("model", config.sarvamSttModel);

  const hintCode = toBcp47Language(hintLanguage);
  if (hintCode) {
    form.append("language_code", hintCode);
  }

  const response = await fetch(SARVAM_STT_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": config.sarvamApiKey
    },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam STT failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return {
    text: data.transcript || "",
    language: fromBcp47Language(data.language_code) || (hintLanguage === "auto" ? "en" : hintLanguage)
  };
}

function parseBase64Audio(input) {
  const dataUriMatch = input.match(/^data:(.*?);base64,(.*)$/);
  const rawMimeType = dataUriMatch?.[1] || "audio/webm";
  const mimeType = normalizeMimeType(rawMimeType);
  const rawBase64 = dataUriMatch?.[2] || input;
  const buffer = Buffer.from(rawBase64, "base64");

  let extension = "webm";
  if (mimeType.includes("wav")) extension = "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
  if (mimeType.includes("ogg")) extension = "ogg";
  if (mimeType.includes("mp4")) extension = "mp4";

  return { mimeType, buffer, extension };
}

function normalizeMimeType(mimeType) {
  // Sarvam expects canonical mime types (e.g. "audio/webm"),
  // and rejects parameterized forms like "audio/webm;codecs=opus".
  return String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
}

function toBcp47Language(language) {
  if (!language || language === "auto") return null;

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

  const lower = language.toLowerCase();
  if (lower.includes("-")) return language;
  return map[lower] || null;
}

function fromBcp47Language(code) {
  if (!code) return null;
  return String(code).split("-")[0].toLowerCase();
}
