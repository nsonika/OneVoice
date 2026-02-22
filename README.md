# OneVoice

OneVoice is a real-time multilingual chat + voice translation app.

## Monorepo Structure

- `server` - Express + Socket.IO + Prisma + Postgres
- `mobile` - React Native (Expo) app

## MVP Demo Flow

1. User A joins room with `hi` preferred language.
2. User B joins room with `en` preferred language.
3. User A sends: `Mujhe coffee chahiye`.
4. User B receives translated text: `I want coffee`.
5. Optional voice: record -> STT -> translate -> TTS payload.

## Quick Start

### 1) Start server

```bash
cd server
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### 2) Start mobile app

```bash
cd mobile
npm install
npm run start
```

Then open Expo on Android/iOS and connect to the running server URL configured in `mobile/src/lib/socket.js`.

## Notes

- Translation provider defaults to Google endpoint via `@vitalets/google-translate-api`.
- Hinglish text can be normalized through LLM provider by setting `GROQ_API_KEY`.
- Voice STT/TTS are pluggable service stubs; wire Whisper/Sarvam/ElevenLabs keys in env and service files.
