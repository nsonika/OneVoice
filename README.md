# OneVoice

OneVoice removes language barriers in real-time communication.

It is a multilingual chat and voice app where users type or speak in their own language and recipients see/hear content in their preferred language.

## Why OneVoice

People travel, work, and collaborate across languages. In real chats, users naturally switch to native language, slang, or Hinglish. OneVoice makes that conversation seamless.

## Core Features

## Core Features

- Real-time translation for both 1:1 and group chats  
- Group chat creation with multilingual participants  
- Voice messaging pipeline: record -> transcribe (STT) -> translate -> synthesize (TTS)  
- Automatic source-language detection (no manual language selection)  
- Hinglish-aware handling for mixed-language input  
- User preferred language captured at signup and editable in profile  
- Per-recipient delivery in each user’s target language  
- Localized app UI (English, Hindi, Tamil, Telugu)  
- Cloudinary-based storage for voice/audio assets

## Tech Stack

### Mobile (`mobile`)

- React Native + Expo + Expo Router
- Socket.IO client
- Axios
- `i18n-js` + `expo-localization`

### Backend (`server`)

- Node.js + Express
- Socket.IO
- Prisma ORM + PostgreSQL (Neon compatible)
- JWT auth

### AI/Language Layer

- **Lingo.dev Node.js SDK** for translation
- **Sarvam API** for STT (speech-to-text)
- **Sarvam API** for TTS (text-to-speech)
- Language detection service on backend

### Storage

- Cloudinary for audio assets

## Architecture

```text
Expo App
  -> REST + Socket.IO
Express Server
  -> Translation (Lingo.dev)
  -> STT/TTS (Sarvam)
  -> Audio Storage (Cloudinary)
  -> Prisma
PostgreSQL
```

## Message Flow

### Text

1. Sender sends text
2. Backend detects source language
3. Backend translates per recipient preferred language
4. Saves recipient-targeted message view
5. Emits over Socket.IO (`receiveMessage`)

### Voice

1. Sender records voice
2. Backend transcribes via Sarvam STT
3. Backend translates via Lingo.dev
4. Backend generates translated audio via Sarvam TTS
5. Original/translated audio stored in Cloudinary
6. Saves and emits over Socket.IO (`receiveVoiceMessage`)

## Monorepo Structure

```text
OneVoice/
  mobile/   # Expo app
  server/   # Express + Prisma + Socket.IO
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL database (local or Neon)
- Lingo.dev API key
- Sarvam API key
- Cloudinary credentials

## Environment Variables

### Server (`server/.env`)

Use `server/.env.example` as base.

Required values:

- `PORT`
- `CLIENT_ORIGIN`
- `DATABASE_URL`
- `JWT_SECRET`
- `LINGO_API_KEY`
- `SARVAM_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional:

- `SARVAM_STT_MODEL`
- `SARVAM_TTS_MODEL`
- `SARVAM_TTS_SPEAKER`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

### Mobile (`mobile/.env`)

Use `mobile/.env.example` as base.

- `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:4000`

## Local Development

### 1) Start backend

```bash
cd server
npm install
copy .env.example .env   # Windows
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

### 2) Start mobile app

```bash
cd mobile
npm install
copy .env.example .env   # Windows
npm run start
```

Then open with Expo (Android/iOS/web).

## API + Realtime Highlights

- `POST /auth/signup`
- `POST /auth/signin`
- `GET /conversations`
- `POST /conversations/direct`
- `POST /conversations/group`
- `POST /conversations/:conversationId/voice`
- `socket.emit('joinConversation', ...)`
- `socket.emit('sendMessage', ...)`
- `socket.on('receiveMessage', ...)`
- `socket.on('receiveVoiceMessage', ...)`

## Localization

- UI strings are maintained in `mobile/app/i18n/*.json`
- `mobile/i18n.json` config is set for Lingo.dev CLI workflow
- UI language follows logged-in user's `preferredLanguage`

## Current Status

Potential next steps:

- MessageTranslation table for scalable many-language group delivery
- Better offline/retry queues
- Push notifications
- Production-grade monitoring and rate limits

## Pitch Line

> OneVoice removes language barriers in real-time communication.
