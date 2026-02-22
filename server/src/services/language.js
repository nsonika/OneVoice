import { franc } from "franc";

const FRANC_TO_ISO639_1 = {
  eng: "en",
  hin: "hi",
  tam: "ta",
  tel: "te",
  ben: "bn",
  mar: "mr",
  guj: "gu",
  pan: "pa",
  urd: "ur",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt"
};

export function detectLanguage(text, fallback = "en") {
  if (!text || text.trim().length < 3) return fallback;
  const detected = franc(text);
  if (detected === "und") return fallback;
  return FRANC_TO_ISO639_1[detected] || fallback;
}
