import { config } from "../config.js";

function looksHinglish(text) {
  const lower = text.toLowerCase();
  const hints = ["mujhe", "chahiye", "nahi", "haan", "kya", "kaise", "tum"];
  return hints.some((h) => lower.includes(h));
}

export async function normalizeHinglish(text) {
  if (!text?.trim()) return text;
  if (!looksHinglish(text)) return text;
  if (!config.groqApiKey) return text;

  // Hook Groq normalization here. Demo fallback returns unchanged text.
  return text;
}
