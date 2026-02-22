import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

type ChatMessage = {
  id: string;
  fromMe: boolean;
  original: string;
  translated: string;
  kind: 'text' | 'voice';
};

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    fromMe: false,
    original: 'Mujhe coffee chahiye',
    translated: 'I want coffee',
    kind: 'text',
  },
  {
    id: 'm2',
    fromMe: true,
    original: 'Sure, I can get one.',
    translated: 'Haan, main le aata hoon.',
    kind: 'text',
  },
];

export default function ChatRoomScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; language?: string }>();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);

  const roomName = useMemo(() => params.name || `Room ${params.id}`, [params.id, params.name]);
  const peerLanguage = useMemo(() => params.language || 'Unknown', [params.language]);

  function handleSend() {
    if (!input.trim()) return;

    const next: ChatMessage = {
      id: String(Date.now()),
      fromMe: true,
      original: input,
      translated: `[Translated preview] ${input}`,
      kind: 'text',
    };
    setMessages((prev) => [...prev, next]);
    setInput('');
  }

  function handleVoiceToggle() {
    if (!isRecording) {
      setIsRecording(true);
      return;
    }

    const voiceMessage: ChatMessage = {
      id: String(Date.now()),
      fromMe: true,
      original: '[Voice] Mujhe coffee chahiye',
      translated: '[Voice] I want coffee',
      kind: 'voice',
    };
    setMessages((prev) => [...prev, voiceMessage]);
    setIsRecording(false);
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
              <Pressable style={styles.playVoiceButton}>
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
          <Text style={styles.micText}>{isRecording ? 'Stop' : 'Mic'}</Text>
        </Pressable>
      </View>
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
});
