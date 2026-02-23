import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/app/lib/api';
import { useSession } from '@/app/lib/session';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/app/lib/i18n';

type Contact = {
  id: string;
  userId: string;
  name: string;
  email: string;
  language: string;
};

export default function ContactsScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const list = useMemo(() => contacts, [contacts]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contacts');
      const mapped: Contact[] = data.map((item: any) => ({
        id: item.id,
        userId: item.contactUser.id,
        name: item.alias || item.contactUser.name,
        email: item.contactUser.email,
        language: item.contactUser.preferredLanguage,
      }));
      setContacts(mapped);
    } catch (e: any) {
      if (e?.response?.status === 401) signOut();
      setError(e?.response?.data?.error || i18n.t('contacts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function handleAddContact() {
    if (!email.trim()) {
      setError(i18n.t('contacts.enterEmail'));
      return;
    }
    try {
      setStatus(i18n.t('contacts.sendingRequest'));
      setError('');
      setLoading(true);
      await api.post('/contacts', { email: email.trim() });
      setEmail('');
      setStatus(i18n.t('contacts.contactAdded'));
      await loadContacts();
    } catch (e: any) {
      setStatus('');
      setError(e?.response?.data?.error || i18n.t('contacts.addContactFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenContact(contact: Contact) {
    try {
      const { data } = await api.post('/conversations/direct', { contactUserId: contact.userId });
      router.push({
        pathname: '/chat/[id]',
        params: { id: data.id, name: contact.name, language: contact.language, peerName: contact.name },
      });
    } catch (e: any) {
      setError(e?.response?.data?.error || i18n.t('contacts.openConversationFailed'));
    }
  }

  function toggleSelection(userId: string) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleContactPress(contact: Contact, e?: any) {
    const isCtrlSelect = Platform.OS === 'web' && (e?.nativeEvent?.ctrlKey || e?.nativeEvent?.metaKey);
    const inSelectionMode = selectedUserIds.length > 0;
    if (isCtrlSelect || inSelectionMode) {
      toggleSelection(contact.userId);
      return;
    }
    await handleOpenContact(contact);
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      setError(i18n.t('contacts.enterGroupName'));
      return;
    }
    if (selectedUserIds.length < 1) {
      setError(i18n.t('contacts.selectAtLeastOne'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatus(i18n.t('contacts.creatingGroup'));
      const { data } = await api.post('/conversations/group', {
        name: groupName.trim(),
        memberUserIds: selectedUserIds,
      });

      setSelectedUserIds([]);
      setGroupName('');
      setStatus(i18n.t('contacts.groupCreated'));

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: data.id,
          name: data.name || i18n.t('chats.group'),
          language: i18n.t('chats.group'),
          peerName: data.name || i18n.t('chats.group'),
        },
      });
    } catch (e: any) {
      setStatus('');
      setError(e?.response?.data?.error || i18n.t('contacts.createGroupFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{i18n.t('contacts.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadContacts} colors={[Colors.light.tint]} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('contacts.addNewFriend')}</Text>
          <View style={styles.card}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={i18n.t('contacts.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
            </View>
            <Pressable 
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled
              ]} 
              onPress={handleAddContact}
              disabled={loading}
            >
              <Text style={styles.addText}>{loading ? i18n.t('contacts.adding') : i18n.t('contacts.addContact')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('contacts.createGroup')}</Text>
          <View style={styles.card}>
            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder={i18n.t('contacts.groupNamePlaceholder')}
                style={styles.input}
                placeholderTextColor="#94a3b8"
              />
            </View>
            
            <View style={styles.selectionInfo}>
              <Text style={styles.selectedCount}>
                {selectedUserIds.length}{' '}
                {selectedUserIds.length === 1 ? i18n.t('contacts.memberSelected') : i18n.t('contacts.membersSelected')}
              </Text>
              {selectedUserIds.length > 0 && (
                <Pressable onPress={() => setSelectedUserIds([])}>
                  <Text style={styles.clearText}>{i18n.t('contacts.clearAll')}</Text>
                </Pressable>
              )}
            </View>

            <Pressable 
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.buttonPressed,
                (loading || selectedUserIds.length === 0) && styles.buttonDisabled
              ]} 
              onPress={handleCreateGroup}
              disabled={loading || selectedUserIds.length === 0}
            >
              <Text style={styles.addText}>{loading ? i18n.t('contacts.creatingGroup') : i18n.t('contacts.createGroupBtn')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.contactsHeader}>
            <Text style={styles.sectionTitle}>{i18n.t('contacts.yourContacts')}</Text>
            <Text style={styles.hint}>{i18n.t('contacts.multiSelectHint')}</Text>
          </View>

          {list.map((contact) => (
            <Pressable
              key={contact.id}
              style={({ pressed }) => [
                styles.contactCard,
                selectedUserIds.includes(contact.userId) && styles.contactCardSelected,
                pressed && styles.contactCardPressed
              ]}
              onPress={(e) => handleContactPress(contact, e)}
              onLongPress={() => toggleSelection(contact.userId)}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                {selectedUserIds.includes(contact.userId) && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              
              <View style={styles.contactInfo}>
                <View style={styles.contactRow}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <View style={styles.langPill}>
                    <Text style={styles.langText}>{contact.language.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.contactEmail}>{contact.email}</Text>
              </View>
              
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </Pressable>
          ))}

          {!loading && !list.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-add-outline" size={48} color="#e2e8f0" />
            <Text style={styles.emptyText}>{i18n.t('contacts.noContacts')}</Text>
            </View>
          ) : null}
        </View>

        {status || error ? (
          <View style={[
            styles.statusContainer,
            error ? styles.errorStatus : styles.successStatus
          ]}>
            <Ionicons 
              name={error ? "alert-circle" : "checkmark-circle"} 
              size={18} 
              color={error ? Colors.light.error : Colors.light.success} 
            />
            <Text style={[
              styles.statusText,
              { color: error ? Colors.light.error : Colors.light.success }
            ]}>
              {error || status}
            </Text>
          </View>
        ) : null}
        <View style={{ height: 40 }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
  addButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.error,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 11,
    color: Colors.light.muted,
    fontStyle: 'italic',
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contactCardSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: '#f0fdfa',
  },
  contactCardPressed: {
    backgroundColor: '#f8fafc',
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.light.tint,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  langPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.light.tint,
  },
  contactEmail: {
    fontSize: 13,
    color: Colors.light.muted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.muted,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  successStatus: {
    backgroundColor: '#ecfdf5',
  },
  errorStatus: {
    backgroundColor: '#fef2f2',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
