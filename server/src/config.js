import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  lingoApiKey: process.env.LINGO_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || ""
};
