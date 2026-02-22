import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  lingoApiKey: process.env.LINGO_API_KEY || "",
  sarvamApiKey: process.env.SARVAM_API_KEY || "",
  sarvamSttModel: process.env.SARVAM_STT_MODEL || "saarika:v2.5",
  sarvamTtsModel: process.env.SARVAM_TTS_MODEL || "bulbul:v2",
  sarvamTtsSpeaker: process.env.SARVAM_TTS_SPEAKER || "anushka",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || ""
};
