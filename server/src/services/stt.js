export async function speechToText(_audioBase64, hintLanguage = "auto") {
  // Replace with Whisper/Sarvam integration.
  return {
    text: "Mujhe coffee chahiye",
    language: hintLanguage === "auto" ? "hi" : hintLanguage
  };
}
