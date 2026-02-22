import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

type ChatItem = {
  id: string;
  name: string;
  language: string;
  lastOriginal: string;
  lastTranslated: string;
  unread: number;
};

const INITIAL_CHATS: ChatItem[] = [
  {
    id: '1',
    name: 'Arjun',
    language: 'Hindi',
    lastOriginal: 'Mujhe coffee chahiye',
    lastTranslated: 'I want coffee',
    unread: 2,
  },
  {
    id: '2',
    name: 'Keerthi',
    language: 'Tamil',
    lastOriginal: 'Meeting 5 minute late',
    lastTranslated: 'Meeting 5 nimidam late',
    unread: 0,
  },
];

export default function ChatsScreen() {
  const router = useRouter();
  const [language] = useState('English');
  const chats = useMemo(() => INITIAL_CHATS, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>OneVoice</Text>
        <Text style={styles.subtitle}>Speak any language, be understood instantly</Text>
        <View style={styles.languagePill}>
          <Text style={styles.languageLabel}>Your language: {language}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent chats</Text>
      </View>

      {chats.map((chat) => (
        <Pressable
          key={chat.id}
          style={styles.chatCard}
          onPress={() =>
            router.push({
              pathname: '/chat/[id]',
              params: { id: chat.id, name: chat.name, language: chat.language },
            })
          }>
          <View style={styles.chatRow}>
            <Text style={styles.chatName}>{chat.name}</Text>
            <Text style={styles.chatLanguage}>{chat.language}</Text>
          </View>
          <Text style={styles.original}>{chat.lastOriginal}</Text>
          <Text style={styles.translated}>{chat.lastTranslated}</Text>
          {chat.unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unread}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
    paddingHorizontal: 16,
  },
  hero: {
    marginTop: 12,
    marginBottom: 18,
    backgroundColor: '#0f766e',
    borderRadius: 18,
    padding: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#ccfbf1',
    marginTop: 6,
    fontSize: 13,
  },
  languagePill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#134e4a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  languageLabel: {
    color: '#99f6e4',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  chatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  chatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  chatLanguage: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
  },
  original: {
    color: '#6b7280',
    fontSize: 13,
  },
  translated: {
    marginTop: 4,
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  unreadBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
