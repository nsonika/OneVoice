import express from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { requireAuth, signToken } from "./auth.js";
import { detectLanguage } from "./services/language.js";
import { normalizeHinglish } from "./services/hinglish.js";
import { translateText } from "./services/translator.js";
import { speechToText } from "./services/stt.js";
import { textToSpeechBase64 } from "./services/tts.js";

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/signup", async (req, res) => {
  const { name, email, password, preferredLanguage } = req.body;
  if (!name || !email || !password || !preferredLanguage) {
    return res.status(400).json({ error: "name, email, password, preferredLanguage are required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, preferredLanguage }
  });

  const token = signToken({ userId: user.id, email: user.email });
  return res.status(201).json({ token, user: toSafeUser(user) });
});

app.post("/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ userId: user.id, email: user.email });
  return res.json({ token, user: toSafeUser(user) });
});

app.get("/users/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(toSafeUser(user));
});

app.patch("/users/me", requireAuth, async (req, res) => {
  const { name, preferredLanguage } = req.body;
  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data: {
      ...(name ? { name } : {}),
      ...(preferredLanguage ? { preferredLanguage } : {})
    }
  });
  return res.json(toSafeUser(user));
});

app.get("/contacts", requireAuth, async (req, res) => {
  const contacts = await prisma.contact.findMany({
    where: { ownerId: req.auth.userId },
    include: {
      contactUser: {
        select: {
          id: true,
          name: true,
          email: true,
          preferredLanguage: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json(contacts);
});

app.post("/contacts", requireAuth, async (req, res) => {
  const { email, alias } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return res.status(404).json({ error: "Contact user not found" });
  if (target.id === req.auth.userId) return res.status(400).json({ error: "Cannot add yourself" });

  const contact = await prisma.contact.upsert({
    where: {
      ownerId_contactUserId: {
        ownerId: req.auth.userId,
        contactUserId: target.id
      }
    },
    create: {
      ownerId: req.auth.userId,
      contactUserId: target.id,
      alias: alias || null
    },
    update: {
      alias: alias || null
    },
    include: {
      contactUser: {
        select: {
          id: true,
          name: true,
          email: true,
          preferredLanguage: true
        }
      }
    }
  });

  return res.status(201).json(contact);
});

app.delete("/contacts/:contactId", requireAuth, async (req, res) => {
  const contact = await prisma.contact.findUnique({ where: { id: req.params.contactId } });
  if (!contact || contact.ownerId !== req.auth.userId) {
    return res.status(404).json({ error: "Contact not found" });
  }

  await prisma.contact.delete({ where: { id: contact.id } });
  return res.json({ ok: true });
});

app.post("/conversations/direct", requireAuth, async (req, res) => {
  const { contactUserId } = req.body;
  if (!contactUserId) return res.status(400).json({ error: "contactUserId is required" });
  if (contactUserId === req.auth.userId) return res.status(400).json({ error: "Invalid contactUserId" });

  const existing = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      members: {
        some: { userId: req.auth.userId }
      },
      AND: [
        { members: { some: { userId: contactUserId } } },
        { members: { every: { userId: { in: [req.auth.userId, contactUserId] } } } }
      ]
    },
    include: { members: { include: { user: true } } }
  });

  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      members: {
        create: [{ userId: req.auth.userId }, { userId: contactUserId }]
      }
    },
    include: { members: { include: { user: true } } }
  });

  return res.status(201).json(conversation);
});

app.get("/conversations", requireAuth, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId: req.auth.userId } }
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, preferredLanguage: true }
          }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { updatedAt: "desc" }
  });
  return res.json(conversations);
});

app.get("/conversations/:conversationId/messages", requireAuth, async (req, res) => {
  const { conversationId } = req.params;
  const isMember = await isConversationMember(conversationId, req.auth.userId);
  if (!isMember) return res.status(403).json({ error: "Not a member of this conversation" });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" }
  });
  return res.json(messages);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin }
});

io.on("connection", (socket) => {
  socket.on("joinConversation", async ({ conversationId, userId }, ack) => {
    try {
      const member = await isConversationMember(conversationId, userId);
      if (!member) throw new Error("User is not a member of this conversation");

      socket.join(conversationId);
      socket.data.userId = userId;
      socket.data.conversationId = conversationId;
      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message || "joinConversation failed" });
    }
  });

  socket.on("sendMessage", async (payload, ack) => {
    try {
      const { conversationId, senderId, text } = payload;
      if (!text?.trim()) throw new Error("text is required");
      await assertMember(conversationId, senderId);

      const members = await getConversationMembers(conversationId);
      const sender = members.find((m) => m.id === senderId);
      if (!sender) throw new Error("Sender not found");

      const sourceLanguage = detectLanguage(text, sender.preferredLanguage || "en");
      const normalized = await normalizeHinglish(text);

      for (const recipient of members) {
        const translatedText = await translateText(
          normalized,
          recipient.preferredLanguage,
          sourceLanguage
        );

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId,
            kind: "TEXT",
            originalText: text,
            translatedText,
            sourceLanguage,
            targetLanguage: recipient.preferredLanguage
          }
        });

        io.to(conversationId).emit("receiveMessage", {
          id: message.id,
          conversationId,
          senderId,
          original: text,
          translated: translatedText,
          sourceLanguage,
          targetLanguage: recipient.preferredLanguage,
          createdAt: message.createdAt,
          kind: "text"
        });
      }

      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message || "sendMessage failed" });
    }
  });

  socket.on("sendVoiceMessage", async (payload, ack) => {
    try {
      const { conversationId, senderId, audioBase64 } = payload;
      await assertMember(conversationId, senderId);

      const members = await getConversationMembers(conversationId);
      const sender = members.find((m) => m.id === senderId);
      if (!sender) throw new Error("Sender not found");

      const stt = await speechToText(audioBase64, sender.preferredLanguage || "auto");
      const sourceText = stt.text || "";
      const sourceLanguage = stt.language || detectLanguage(sourceText, sender.preferredLanguage);

      for (const recipient of members) {
        const translatedText = await translateText(
          sourceText,
          recipient.preferredLanguage,
          sourceLanguage
        );
        const ttsAudioBase64 = await textToSpeechBase64(translatedText, recipient.preferredLanguage);

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId,
            kind: "VOICE",
            originalText: sourceText,
            translatedText,
            sourceLanguage,
            targetLanguage: recipient.preferredLanguage
          }
        });

        io.to(conversationId).emit("receiveVoiceMessage", {
          id: message.id,
          conversationId,
          senderId,
          original: sourceText,
          translated: translatedText,
          sourceLanguage,
          targetLanguage: recipient.preferredLanguage,
          audioBase64: ttsAudioBase64,
          createdAt: message.createdAt,
          kind: "voice"
        });
      }

      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message || "sendVoiceMessage failed" });
    }
  });
});

async function isConversationMember(conversationId, userId) {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId }
    }
  });
  return Boolean(member);
}

async function assertMember(conversationId, userId) {
  const isMember = await isConversationMember(conversationId, userId);
  if (!isMember) throw new Error("User is not a member of this conversation");
}

async function getConversationMembers(conversationId) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: { user: true }
  });
  return members.map((m) => m.user);
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

server.listen(config.port, () => {
  console.log(`OneVoice server listening on port ${config.port}`);
});
