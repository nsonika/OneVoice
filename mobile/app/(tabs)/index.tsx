import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/app/lib/api';
import { useSession } from '@/app/lib/session';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type ChatItem = {
  id: string;
  name: string;
  language: string;
  lastOriginal: string;
  lastTranslated: string;
  unread: number;
  type: 'DIRECT' | 'GROUP';
};

export default function ChatsScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/conversations');
      const mapped: ChatItem[] = data.map((conv: any) => {
        const peer = conv.members?.map((m: any) => m.user).find((u: any) => u.id !== user.id);
        const last = conv.messages?.[0];
        const isGroup = conv.type === 'GROUP';
        const groupMemberCount = (conv.members || []).length;
        return {
          id: conv.id,
          name: isGroup ? conv.name || `Group (${groupMemberCount})` : peer?.name || 'Unknown',
          language: isGroup ? `group · ${groupMemberCount}` : peer?.preferredLanguage || '-',
          lastOriginal: last?.originalText || 'No messages yet',
          lastTranslated: last?.translatedText || 'Start chatting',
          unread: 0,
          type: isGroup ? 'GROUP' : 'DIRECT',
        };
      });
      setChats(mapped);
    } catch (e: any) {
      if (e?.response?.status === 401) signOut();
    } finally {
      setLoading(false);
    }
  }, [signOut, user]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hello,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
        </View>
        <Pressable style={styles.profileBtn} onPress={() => router.push('/(tabs)/profile')}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadChats} colors={[Colors.light.tint]} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.title}>OneVoice</Text>
            <Text style={styles.subtitle}>Speak any language, be understood instantly</Text>
            <View style={styles.languagePill}>
              <Ionicons name="language" size={14} color={Colors.light.background} />
              <Text style={styles.languageLabel}>{user?.preferredLanguage || 'en'}</Text>
            </View>
          </View>
          <View style={styles.heroIconContainer}>
            <Ionicons name="chatbubbles" size={60} color="rgba(255,255,255,0.2)" />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Chats</Text>
          {chats.length > 0 && (
            <Pressable onPress={() => router.push('/explore')}>
              <Text style={styles.viewAllText}>New Chat</Text>
            </Pressable>
          )}
        </View>

        {chats.map((chat) => (
          <Pressable
            key={chat.id}
            style={({ pressed }) => [
              styles.chatCard,
              pressed && styles.chatCardPressed
            ]}
            onPress={() =>
              router.push({
                pathname: '/chat/[id]',
                params: { id: chat.id, name: chat.name, language: chat.language, peerName: chat.name },
              })
            }>
            <View style={styles.chatIconContainer}>
              <View style={[styles.chatAvatar, { backgroundColor: chat.type === 'GROUP' ? '#0d9488' : '#6366f1' }]}>
                <Ionicons 
                  name={chat.type === 'GROUP' ? 'people' : 'person'} 
                  size={20} 
                  color="#fff" 
                />
              </View>
            </View>
            <View style={styles.chatInfo}>
              <View style={styles.chatRow}>
                <Text style={styles.chatName} numberOfLines={1}>{chat.name}</Text>
                <Text style={styles.chatTime}>Just now</Text>
              </View>
              <View style={styles.messageRow}>
                <View style={styles.messageContainer}>
                  <Text style={styles.original} numberOfLines={1}>{chat.lastOriginal}</Text>
                  <Text style={styles.translated} numberOfLines={1}>{chat.lastTranslated}</Text>
                </View>
                {chat.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{chat.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
        
        {!chats.length && !loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Pressable style={styles.startChatBtn} onPress={() => router.push('/explore')}>
              <Text style={styles.startChatText}>Start a conversation</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ height: 20 }} />
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  welcomeText: {
    fontSize: 14,
    color: Colors.light.muted,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  hero: {
    marginTop: 10,
    marginBottom: 25,
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  heroContent: {
    flex: 1,
    zIndex: 1,
  },
  heroIconContainer: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    opacity: 0.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '80%',
  },
  languagePill: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageLabel: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  chatCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  chatCardPressed: {
    backgroundColor: '#f1f5f9',
    transform: [{ scale: 0.98 }],
  },
  chatIconContainer: {
    marginRight: 12,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
  },
  chatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.light.muted,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  messageContainer: {
    flex: 1,
    marginRight: 8,
  },
  original: {
    color: Colors.light.muted,
    fontSize: 13,
  },
  translated: {
    marginTop: 2,
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: Colors.light.tint,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.muted,
    textAlign: 'center',
  },
  startChatBtn: {
    marginTop: 20,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  startChatText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
