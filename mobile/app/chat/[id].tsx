import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/app/lib/api';
import { getSocket } from '@/app/lib/socket';
import { useSession } from '@/app/lib/session';

type ChatMessage = {
  id: string;
  fromMe: boolean;
  senderId: string;
  original: string;
  translated: string;
  kind: 'text' | 'voice';
  targetLanguage?: string;
  originalAudioUrl?: string | null;
  translatedAudioUrl?: string | null;
  audioBase64?: string | null;
};

export default function ChatRoomScreen() {
  const { user, signOut } = useSession();
  const socket = useMemo(() => getSocket(), []);
  const params = useLocalSearchParams<{ id: string; name?: string; language?: string }>();
  const conversationId = String(params.id || '');
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const roomName = useMemo(() => params.name || `Chat ${params.id}`, [params.id, params.name]);
  const peerLanguage = useMemo(() => params.language || 'Unknown', [params.language]);

  const loadMessages = useCallback(async () => {
    if (!user || !conversationId) return;
    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`);
      const mapped: ChatMessage[] = data
        .filter((m: any) => m.targetLanguage === user.preferredLanguage)
        .map((m: any) => ({
          id: m.id,
          fromMe: m.senderId === user.id,
          senderId: m.senderId,
          original: m.originalText,
          translated: m.translatedText,
          kind: m.kind === 'VOICE' ? 'voice' : 'text',
          targetLanguage: m.targetLanguage,
          originalAudioUrl: m.originalAudioUrl || null,
          translatedAudioUrl: m.translatedAudioUrl || m.audioUrl || null,
          audioBase64: null,
        }));
      console.log('[chat] loadMessages', {
        conversationId,
        total: data?.length || 0,
        visible: mapped.length,
        preferredLanguage: user.preferredLanguage,
      });
      setMessages(mapped);
    } catch (e: any) {
      if (e?.response?.status === 401) signOut();
      setError(e?.response?.data?.error || 'Failed to load messages');
    }
  }, [conversationId, signOut, user]);

  useEffect(() => {
    if (!user || !conversationId) return;

    loadMessages();
    const joinRoom = () => {
      socket.emit('joinConversation', { conversationId, userId: user.id }, (ack: any) => {
        console.log('[socket] joinConversation ack', { conversationId, userId: user.id, ack });
      });
    };
    joinRoom();

    const onReceiveText = (msg: any) => {
      if (msg.conversationId !== conversationId) return;
      if (msg.targetLanguage !== user.preferredLanguage) return;
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          fromMe: msg.senderId === user.id,
          senderId: msg.senderId,
          original: msg.original,
          translated: msg.translated,
          kind: 'text',
          targetLanguage: msg.targetLanguage,
        },
      ]);
    };

    const onReceiveVoice = (msg: any) => {
      if (msg.conversationId !== conversationId) return;
      if (msg.targetLanguage !== user.preferredLanguage) return;
      console.log('[socket] receiveVoiceMessage', {
        id: msg.id,
        conversationId: msg.conversationId,
        targetLanguage: msg.targetLanguage,
        hasTranslatedAudioUrl: Boolean(msg.translatedAudioUrl || msg.audioUrl),
        hasAudioBase64: Boolean(msg.audioBase64),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          fromMe: msg.senderId === user.id,
          senderId: msg.senderId,
          original: msg.original,
          translated: msg.translated,
          kind: 'voice',
          targetLanguage: msg.targetLanguage,
          originalAudioUrl: msg.originalAudioUrl || null,
          translatedAudioUrl: msg.translatedAudioUrl || msg.audioUrl || null,
          audioBase64: msg.audioBase64 || null,
        },
      ]);
    };

    socket.on('receiveMessage', onReceiveText);
    socket.on('receiveVoiceMessage', onReceiveVoice);
    socket.on('connect', () => {
      console.log('[socket] connected', { id: socket.id });
      // On reconnect, server-side room membership is lost; re-join conversation.
      joinRoom();
    });
    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', { reason });
    });

    return () => {
      socket.off('receiveMessage', onReceiveText);
      socket.off('receiveVoiceMessage', onReceiveVoice);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [conversationId, loadMessages, socket, user]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleSend() {
    if (!input.trim() || !user) return;

    socket.emit('sendMessage', {
      conversationId,
      senderId: user.id,
      text: input,
    });
    setInput('');
  }

  async function handlePlayVoice(msg: ChatMessage) {
    try {
      setError('');
      let source = msg.translatedAudioUrl || '';

      if (!source && msg.audioBase64) {
        source = msg.audioBase64.startsWith('data:')
          ? msg.audioBase64
          : `data:audio/wav;base64,${msg.audioBase64}`;
      }

      if (!source) {
        setError('No audio found for this message');
        return;
      }

      if (Platform.OS === 'web') {
        const audio = new Audio(source);
        await audio.play();
        return;
      }

      // Prefer in-app playback via expo-av when available.
      try {
        const av = await import('expo-av');
        const { sound } = await av.Audio.Sound.createAsync({ uri: source });
        await sound.playAsync();
        return;
      } catch {
        // fallback below
      }

      if (!msg.translatedAudioUrl) {
        setError('Install expo-av for in-app playback, or provide audioUrl for external playback.');
        return;
      }

      const canOpen = await Linking.canOpenURL(msg.translatedAudioUrl);
      if (!canOpen) {
        setError('Cannot open audio URL on this device');
        return;
      }
      await Linking.openURL(msg.translatedAudioUrl);
    } catch (e: any) {
      setError(e?.message || 'Failed to play audio');
    }
  }

  async function handleVoiceToggle() {
    if (!user) return;
    if (!isRecording) {
      if (Platform.OS !== 'web') {
        setError('Voice recording is currently implemented for web. Mobile capture can be added next.');
        return;
      }
      await startWebRecording();
      return;
    }

    try {
      await stopWebRecordingAndSend();
    } catch (e: any) {
      console.error('[voice] api_post_failed', {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
      });
      const traceId = e?.response?.data?.traceId;
      const base = e?.response?.data?.error || e?.message || 'Voice API failed';
      setError(traceId ? `${base} (trace: ${traceId})` : base);
    }
  }

  async function startWebRecording() {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const options = pickRecorderOptions();
      const recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        console.log('[voice] ondataavailable', {
          size: event?.data?.size || 0,
          type: event?.data?.type || null,
          chunks: chunksRef.current.length,
        });
      };

      recorder.start();
      console.log('[voice] recording_started', {
        conversationId,
        recorderMimeType: recorder.mimeType || null,
      });
      setIsRecording(true);
    } catch (e: any) {
      setError(e?.message || 'Microphone permission denied');
      setIsRecording(false);
    }
  }

  async function stopWebRecordingAndSend() {
    if (!mediaRecorderRef.current) {
      setIsRecording(false);
      return;
    }

    setSendingVoice(true);
    setError('');
    try {
      const recorder = mediaRecorderRef.current;
      const stoppedBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error('Recording failed'));
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log('[voice] recording_stopped', {
            mimeType,
            chunkCount: chunksRef.current.length,
            blobSize: blob.size,
          });
          resolve(blob);
        };
        recorder.stop();
      });

      if (stoppedBlob.size < 1024) {
        throw new Error('Recording too short. Hold mic a bit longer.');
      }

      const audioBase64 = await blobToDataUrl(stoppedBlob);
      console.log('[voice] api_post_start', {
        conversationId,
        audioBase64Length: audioBase64.length,
        blobSize: stoppedBlob.size,
      });
      const response = await api.post(
        `/conversations/${conversationId}/voice`,
        { audioBase64 },
        { timeout: 60000 }
      );
      console.log('[voice] api_post_done', {
        status: response.status,
        traceId: response?.data?.traceId || null,
      });
    } finally {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setSendingVoice(false);
    }
  }

  function pickRecorderOptions(): MediaRecorderOptions | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return { mimeType: 'audio/webm;codecs=opus' };
    }
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      return { mimeType: 'audio/webm' };
    }
    return undefined;
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to encode audio'));
      reader.readAsDataURL(blob);
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roomName}>{roomName}</Text>
        <Text style={styles.roomMeta}>Partner language: {peerLanguage}</Text>
      </View>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageBubble, msg.fromMe ? styles.fromMe : styles.fromOther]}>
            {msg.kind === 'voice' ? (
              <Pressable style={styles.playVoiceButton} onPress={() => handlePlayVoice(msg)}>
                <Text style={styles.playVoiceText}>Play voice</Text>
              </Pressable>
            ) : null}
            <Text style={styles.original}>{msg.original}</Text>
            <Text style={styles.translated}>{msg.translated}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor="#9ca3af"
        />
        <Pressable style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
        <Pressable
          style={[styles.micBtn, isRecording && styles.micBtnRecording]}
          onPress={handleVoiceToggle}>
          <Text style={styles.micText}>{sendingVoice ? '...' : isRecording ? 'Stop' : 'Mic'}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  roomName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  roomMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 14,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 14,
    padding: 10,
  },
  fromMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#ccfbf1',
  },
  fromOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  original: {
    color: '#6b7280',
    fontSize: 13,
  },
  translated: {
    marginTop: 5,
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  sendBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sendText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  micBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  micBtnRecording: {
    backgroundColor: '#b91c1c',
  },
  micText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  playVoiceButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  playVoiceText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: '#b91c1c',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },
});
