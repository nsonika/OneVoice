import express from "express";
import http from "http";
import cors from "cors";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { requireAuth, signToken } from "./auth.js";
import { detectLanguage } from "./services/language.js";
import { translateText } from "./services/translator.js";
import { speechToText } from "./services/stt.js";
import { textToSpeechBase64 } from "./services/tts.js";
import { uploadAudioBase64 } from "./services/storage.js";

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
        create: [{ userId: req.auth.userId, role: "MEMBER" }, { userId: contactUserId, role: "MEMBER" }]
      }
    },
    include: { members: { include: { user: true } } }
  });

  return res.status(201).json(conversation);
});

app.post("/conversations/group", requireAuth, async (req, res) => {
  const { name, memberUserIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (!Array.isArray(memberUserIds)) {
    return res.status(400).json({ error: "memberUserIds must be an array" });
  }

  const uniqueMemberIds = [...new Set(memberUserIds.filter(Boolean))].filter(
    (id) => id !== req.auth.userId
  );
  if (uniqueMemberIds.length < 1) {
    return res.status(400).json({ error: "At least 1 other member is required" });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true }
  });
  if (users.length !== uniqueMemberIds.length) {
    return res.status(400).json({ error: "Some memberUserIds are invalid" });
  }

  const conversation = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: name.trim(),
      createdBy: req.auth.userId,
      members: {
        create: [
          { userId: req.auth.userId, role: "ADMIN" },
          ...uniqueMemberIds.map((userId) => ({ userId, role: "MEMBER" }))
        ]
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, preferredLanguage: true }
          }
        }
      }
    }
  });

  return res.status(201).json(conversation);
});

app.patch("/conversations/:conversationId/group", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name, groupAvatarUrl } = req.body;

    const isMember = await isConversationMember(conversationId, req.auth.userId);
    if (!isMember) return res.status(403).json({ error: "Not a member of this conversation" });

    const isAdmin = await isGroupAdmin(conversationId, req.auth.userId);
    if (!isAdmin) return res.status(403).json({ error: "Admin permission required" });

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(typeof name === "string" ? { name: name.trim() || null } : {}),
        ...(typeof groupAvatarUrl === "string" ? { groupAvatarUrl: groupAvatarUrl.trim() || null } : {})
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, preferredLanguage: true }
            }
          }
        }
      }
    });

    return res.json(conversation);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to update group" });
  }
});

app.get("/conversations/:conversationId/members", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const isMember = await isConversationMember(conversationId, req.auth.userId);
    if (!isMember) return res.status(403).json({ error: "Not a member of this conversation" });

    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, preferredLanguage: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    return res.json(members);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to list members" });
  }
});

app.post("/conversations/:conversationId/members", requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const isMember = await isConversationMember(conversationId, req.auth.userId);
    if (!isMember) return res.status(403).json({ error: "Not a member of this conversation" });

    const isAdmin = await isGroupAdmin(conversationId, req.auth.userId);
    if (!isAdmin) return res.status(403).json({ error: "Admin permission required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const member = await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId, userId }
      },
      create: {
        conversationId,
        userId,
        role: "MEMBER"
      },
      update: {}
    });

    return res.status(201).json(member);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to add member" });
  }
});

app.delete("/conversations/:conversationId/members/:userId", requireAuth, async (req, res) => {
  try {
    const { conversationId, userId } = req.params;
    const isMember = await isConversationMember(conversationId, req.auth.userId);
    if (!isMember) return res.status(403).json({ error: "Not a member of this conversation" });

    const isAdmin = await isGroupAdmin(conversationId, req.auth.userId);
    if (!isAdmin) return res.status(403).json({ error: "Admin permission required" });

    const targetMember = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
    if (!targetMember) return res.status(404).json({ error: "Member not found" });

    if (targetMember.role === "ADMIN") {
      const adminCount = await prisma.conversationMember.count({
        where: { conversationId, role: "ADMIN" }
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot remove last admin" });
      }
    }

    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId } }
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to remove member" });
  }
});

app.get("/conversations", requireAuth, async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { preferredLanguage: true }
  });
  const preferredLanguage = me?.preferredLanguage || "en";

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
        where: { targetLanguage: preferredLanguage },
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

app.post("/conversations/:conversationId/voice", requireAuth, async (req, res) => {
  const traceId = makeTraceId();
  try {
    const { conversationId } = req.params;
    const { audioBase64 } = req.body;
    logVoice(traceId, "http_incoming", {
      conversationId,
      userId: req.auth?.userId,
      hasAudio: Boolean(audioBase64),
      audioLength: audioBase64?.length || 0
    });
    if (!audioBase64?.trim()) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    await assertMember(conversationId, req.auth.userId);
    await processAndEmitVoiceMessage(conversationId, req.auth.userId, audioBase64, { traceId, source: "http" });
    return res.status(201).json({ ok: true, traceId });
  } catch (error) {
    console.error("[voice-route] failed", {
      traceId,
      conversationId: req.params.conversationId,
      userId: req.auth?.userId,
      message: error?.message,
      stack: error?.stack
    });
    return res.status(400).json({ error: error.message || "Voice processing failed", traceId });
  }
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
      console.log("[socket] joinConversation ok", {
        socketId: socket.id,
        conversationId,
        userId
      });
      ack?.({ ok: true });
    } catch (error) {
      console.error("[socket] joinConversation failed", {
        socketId: socket.id,
        conversationId,
        userId,
        message: error?.message
      });
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

      for (const recipient of members) {
        const translatedText = await translateText(
          text,
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
    const traceId = makeTraceId();
    try {
      const { conversationId, senderId, audioBase64 } = payload;
      logVoice(traceId, "socket_incoming", {
        conversationId,
        senderId,
        hasAudio: Boolean(audioBase64),
        audioLength: audioBase64?.length || 0
      });
      await assertMember(conversationId, senderId);
      await processAndEmitVoiceMessage(conversationId, senderId, audioBase64, { traceId, source: "socket" });
      ack?.({ ok: true, traceId });
    } catch (error) {
      console.error("[voice-socket] failed", {
        traceId,
        conversationId: payload?.conversationId,
        senderId: payload?.senderId,
        message: error?.message,
        stack: error?.stack
      });
      ack?.({ ok: false, error: error.message || "sendVoiceMessage failed", traceId });
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

async function isGroupAdmin(conversationId, userId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true }
  });
  if (!conversation || conversation.type !== "GROUP") return false;

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { role: true }
  });
  return member?.role === "ADMIN";
}

async function getConversationMembers(conversationId) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: { user: true }
  });
  return members.map((m) => m.user);
}

async function processAndEmitVoiceMessage(conversationId, senderId, audioBase64, meta = {}) {
  const traceId = meta.traceId || makeTraceId();
  const members = await getConversationMembers(conversationId);
  logVoice(traceId, "members_loaded", {
    source: meta.source || "unknown",
    conversationId,
    senderId,
    memberCount: members.length
  });

  const sender = members.find((m) => m.id === senderId);
  if (!sender) throw new Error("Sender not found");

  let originalAudioUrl = null;
  try {
    logVoice(traceId, "cloudinary_original_start", {});
    originalAudioUrl = await uploadAudioBase64(audioBase64, `original_${conversationId}`);
    logVoice(traceId, "cloudinary_original_done", {
      hasOriginalAudioUrl: Boolean(originalAudioUrl)
    });
  } catch (error) {
    throw new Error(`cloudinary-original: ${error.message}`);
  }

  let stt;
  try {
    logVoice(traceId, "stt_start", { languageHint: sender.preferredLanguage || "auto" });
    stt = await speechToText(audioBase64, sender.preferredLanguage || "auto");
    logVoice(traceId, "stt_done", {
      transcriptLength: stt?.text?.length || 0,
      language: stt?.language || null
    });
  } catch (error) {
    throw new Error(`sarvam-stt: ${error.message}`);
  }
  const sourceText = stt.text || "";
  const sourceLanguage = stt.language || detectLanguage(sourceText, sender.preferredLanguage);
  logVoice(traceId, "source_ready", {
    sourceLanguage,
    sourceTextLength: sourceText.length
  });

  for (const recipient of members) {
    let translatedText;
    try {
      logVoice(traceId, "translate_start", {
        recipientId: recipient.id,
        targetLanguage: recipient.preferredLanguage
      });
      translatedText = await translateText(
        sourceText,
        recipient.preferredLanguage,
        sourceLanguage
      );
      logVoice(traceId, "translate_done", {
        recipientId: recipient.id,
        translatedLength: translatedText?.length || 0
      });
    } catch (error) {
      throw new Error(`lingo-translate: ${error.message}`);
    }

    let ttsAudioBase64;
    try {
      logVoice(traceId, "tts_start", {
        recipientId: recipient.id,
        targetLanguage: recipient.preferredLanguage
      });
      ttsAudioBase64 = await textToSpeechBase64(translatedText, recipient.preferredLanguage);
      logVoice(traceId, "tts_done", {
        recipientId: recipient.id,
        hasTtsAudio: Boolean(ttsAudioBase64),
        ttsAudioLength: ttsAudioBase64?.length || 0
      });
    } catch (error) {
      throw new Error(`sarvam-tts: ${error.message}`);
    }

    let translatedAudioUrl = null;
    try {
      logVoice(traceId, "cloudinary_translated_start", { recipientId: recipient.id });
      translatedAudioUrl = await uploadAudioBase64(
        ttsAudioBase64,
        `translated_${conversationId}_${recipient.id}`
      );
      logVoice(traceId, "cloudinary_translated_done", {
        recipientId: recipient.id,
        hasTranslatedAudioUrl: Boolean(translatedAudioUrl)
      });
    } catch (error) {
      throw new Error(`cloudinary-translated: ${error.message}`);
    }

    let message;
    try {
      message = await prisma.message.create({
        data: {
          conversationId,
          senderId,
          kind: "VOICE",
          originalText: sourceText,
          translatedText,
          sourceLanguage,
          targetLanguage: recipient.preferredLanguage,
          originalAudioUrl,
          translatedAudioUrl
        }
      });
      logVoice(traceId, "db_save_done", {
        recipientId: recipient.id,
        messageId: message.id
      });
    } catch (error) {
      throw new Error(`db-save: ${error.message}`);
    }

    logVoice(traceId, "socket_emit_voice", {
      recipientId: recipient.id,
      conversationId,
      messageId: message.id
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
      translatedAudioUrl,
      originalAudioUrl,
      createdAt: message.createdAt,
      kind: "voice"
    });
  }
}

function makeTraceId() {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function logVoice(traceId, stage, payload = {}) {
  console.log(`[voice][${traceId}] ${stage}`, payload);
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
