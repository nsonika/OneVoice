import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/app/lib/api';
import { getSocket } from '@/app/lib/socket';
import { useSession } from '@/app/lib/session';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

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
  createdAt: string;
  duration?: number | null;
};

export default function ChatRoomScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const socket = useMemo(() => getSocket(), []);
  const params = useLocalSearchParams<{ id: string; name?: string; language?: string }>();
  const conversationId = String(params.id || '');
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const soundRef = useRef<any>(null);
  const loadingDurationIdsRef = useRef<Set<string>>(new Set());
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
          createdAt: m.createdAt,
          duration: typeof m.duration === 'number' ? m.duration : null,
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
          createdAt: msg.createdAt || new Date().toISOString(),
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
          createdAt: msg.createdAt || new Date().toISOString(),
          duration: typeof msg.duration === 'number' ? msg.duration : null,
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
    const pending = messages.filter(
      (msg) =>
        msg.kind === 'voice' &&
        (!msg.duration || msg.duration <= 0) &&
        !loadingDurationIdsRef.current.has(msg.id) &&
        Boolean(resolveAudioSource(msg))
    );

    pending.forEach((msg) => {
      loadingDurationIdsRef.current.add(msg.id);
      const source = resolveAudioSource(msg);
      if (!source) {
        loadingDurationIdsRef.current.delete(msg.id);
        return;
      }
      getAudioDurationSeconds(source)
        .then((seconds) => {
          setMessages((prev) =>
            prev.map((item) => (item.id === msg.id ? { ...item, duration: seconds } : item))
          );
        })
        .catch(() => {
          // Keep duration unknown; UI will show fallback.
        })
        .finally(() => {
          loadingDurationIdsRef.current.delete(msg.id);
        });
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync?.();
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
    const msgId = String(msg.id);
    const isCurrentlyPlaying = playingMessageId === msgId;
    console.log('[audio] handlePlayVoice', { msgId, isCurrentlyPlaying, playingMessageId });

    try {
      setError('');
      
      // 1. Stop any existing playback
      if (soundRef.current) {
        console.log('[audio] stopping previous sound');
        try {
          if (Platform.OS === 'web' && typeof soundRef.current.pause === 'function') {
            soundRef.current.pause();
          } else if (typeof soundRef.current.stopAsync === 'function') {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          }
        } catch (e) {
          console.warn('[audio] error stopping previous', e);
        }
        soundRef.current = null;
      }

      // 2. If we just wanted to stop the current one, we are done
      if (isCurrentlyPlaying) {
        setPlayingMessageId(null);
        return;
      }

      // 3. Prepare source
      let source = resolveAudioSource(msg) || '';

      if (!source) {
        setError('No audio found for this message');
        setPlayingMessageId(null);
        return;
      }

      // 4. Start new playback
      setPlayingMessageId(msgId);

      // Prefer expo-av
      try {
        const { Audio: ExpoAudio } = await import('expo-av');
        
        await ExpoAudio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound } = await ExpoAudio.Sound.createAsync(
          { uri: source },
          { shouldPlay: true }
        );
        
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            console.log('[audio] finished mobile', msgId);
            setPlayingMessageId((current) => {
              if (current === msgId) return null;
              return current;
            });
            sound.unloadAsync();
            if (soundRef.current === sound) soundRef.current = null;
          }
          if (status.error) {
            console.error('[audio] status error', status.error);
            setPlayingMessageId((current) => (current === msgId ? null : current));
            setError('Playback error');
          }
        });
        
        await sound.playAsync();
        return;
      } catch (e) {
        console.error('[audio] expo-av failed, trying HTML5 Audio', e);
        
        if (Platform.OS === 'web') {
          const audio = new Audio(source);
          soundRef.current = audio;
          audio.onended = () => {
            console.log('[audio] finished web', msgId);
            setPlayingMessageId((current) => (current === msgId ? null : current));
            if (soundRef.current === audio) soundRef.current = null;
          };
          audio.onerror = (err) => {
            console.error('[audio] HTML5 Audio error', err);
            setPlayingMessageId((current) => (current === msgId ? null : current));
            setError('Failed to play audio');
          };
          await audio.play();
        } else {
          setPlayingMessageId(null);
          throw e;
        }
      }
    } catch (e: any) {
      console.error('[audio] handlePlayVoice fatal error', e);
      setPlayingMessageId(null);
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

  function formatTime(isoString: string) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  }

  function formatDuration(seconds: number | null | undefined) {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function resolveAudioSource(msg: ChatMessage) {
    let source = msg.fromMe ? msg.originalAudioUrl || '' : msg.translatedAudioUrl || '';
    if (!source && msg.audioBase64) {
      source = msg.audioBase64.startsWith('data:')
        ? msg.audioBase64
        : `data:audio/wav;base64,${msg.audioBase64}`;
    }
    return source || '';
  }

  async function getAudioDurationSeconds(source: string): Promise<number> {
    if (Platform.OS === 'web') {
      const seconds = await new Promise<number>((resolve, reject) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          const duration = Number(audio.duration);
          resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
        };
        audio.onerror = () => reject(new Error('Failed to load audio metadata'));
        audio.src = source;
      });
      return seconds;
    }

    try {
      const av = await import('expo-av');
      const { sound, status } = await av.Audio.Sound.createAsync(
        { uri: source },
        { shouldPlay: false }
      );
      const millis = status && 'durationMillis' in status ? (status.durationMillis as number | undefined) : 0;
      await sound.unloadAsync();
      return millis && millis > 0 ? millis / 1000 : 0;
    } catch {
      return 0;
    }
  }

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.roomName}>{roomName}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.roomMeta}>{peerLanguage}</Text>
          </View>
        </View>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="call-outline" size={20} color={Colors.light.tint} />
        </Pressable>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="videocam-outline" size={22} color={Colors.light.tint} />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messageList} 
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.messageContainer, 
                msg.fromMe ? styles.containerMe : styles.containerOther
              ]}
            >
              {!msg.fromMe && (
                <View style={styles.messageAvatar}>
                  <Text style={styles.avatarText}>{roomName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={[styles.messageBubble, msg.fromMe ? styles.fromMe : styles.fromOther]}>
                {msg.kind === 'voice' ? (
                  <Pressable style={styles.audioPlayer} onPress={() => handlePlayVoice(msg)}>
                    <View style={styles.audioControls}>
                      <View style={[styles.playButton, !msg.fromMe && styles.fromOtherPlayButton]}>
                        <Ionicons 
                          name={playingMessageId && String(playingMessageId) === String(msg.id) ? "pause" : "play"} 
                          size={18} 
                          color={msg.fromMe ? Colors.light.tint : Colors.light.text} 
                        />
                      </View>
                      <View style={styles.waveformContainer}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                          <View 
                            key={i} 
                            style={[
                              styles.waveBar, 
                              { height: 5 + (i * 2) % 15 },
                              { backgroundColor: msg.fromMe ? 'rgba(255, 255, 255, 0.3)' : 'rgba(13, 148, 136, 0.2)' }
                            ]} 
                          />
                        ))}
                      </View>
                      <Text style={[styles.audioDuration, { color: msg.fromMe ? 'rgba(255,255,255,0.7)' : Colors.light.muted }]}>
                        {formatDuration(msg.duration)}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                
                {msg.fromMe ? (
                  <Text style={styles.translatedMe}>{msg.original}</Text>
                ) : (
                  <>
                    <Text style={styles.originalOther}>{msg.original}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.translatedOther}>{msg.translated}</Text>
                  </>
                )}
                <Text style={[styles.messageTime, { color: msg.fromMe ? 'rgba(255,255,255,0.5)' : Colors.light.muted }]}>
                  {formatTime(msg.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <Pressable style={styles.attachBtn}>
            <Ionicons name="add" size={24} color={Colors.light.muted} />
          </Pressable>
          <View style={styles.inputWrapper}>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#94a3b8"
              multiline
            />
            {!input.trim() && (
              <Pressable style={styles.inputActionBtn}>
                <Ionicons name="happy-outline" size={22} color={Colors.light.muted} />
              </Pressable>
            )}
          </View>
          
          {input.trim() ? (
            <Pressable style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={20} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.micBtn, isRecording && styles.micBtnRecording]}
              onPress={handleVoiceToggle}
            >
              {sendingVoice ? (
                <Text style={{ color: '#fff', fontSize: 10 }}>...</Text>
              ) : (
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={22} 
                  color="#fff" 
                />
              )}
            </Pressable>
          )}
        </View>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  roomName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  roomMeta: {
    fontSize: 12,
    color: Colors.light.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerBtn: {
    padding: 8,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  containerMe: {
    alignSelf: 'flex-end',
  },
  containerOther: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  messageBubble: {
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  fromMe: {
    backgroundColor: Colors.light.tint,
    borderBottomRightRadius: 4,
  },
  fromOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  translatedMe: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 20,
  },
  originalOther: {
    fontSize: 13,
    color: Colors.light.muted,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 6,
  },
  translatedOther: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  audioPlayer: {
    minWidth: 180,
    paddingVertical: 4,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fromOtherPlayButton: {
    backgroundColor: '#e2e8f0',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  attachBtn: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 8,
    maxHeight: 100,
  },
  inputActionBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnRecording: {
    backgroundColor: Colors.light.error,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 8,
  },
  error: {
    color: Colors.light.error,
    fontSize: 12,
    textAlign: 'center',
  },
});
