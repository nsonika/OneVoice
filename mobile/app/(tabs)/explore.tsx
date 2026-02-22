import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/app/lib/api';
import { useSession } from '@/app/lib/session';

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
      setError(e?.response?.data?.error || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function handleAddContact() {
    if (!email.trim()) {
      setError('Enter an email first');
      return;
    }
    try {
      setStatus('Sending request...');
      setError('');
      setLoading(true);
      await api.post('/contacts', { email: email.trim() });
      setEmail('');
      setStatus('Contact added');
      await loadContacts();
    } catch (e: any) {
      setStatus('');
      setError(e?.response?.data?.error || 'Failed to add contact');
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
      setError(e?.response?.data?.error || 'Failed to open conversation');
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
      setError('Enter group name');
      return;
    }
    if (selectedUserIds.length < 1) {
      setError('Select at least 1 contact');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatus('Creating group...');
      const { data } = await api.post('/conversations/group', {
        name: groupName.trim(),
        memberUserIds: selectedUserIds,
      });

      setSelectedUserIds([]);
      setGroupName('');
      setStatus('Group created');

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: data.id,
          name: data.name || 'Group',
          language: 'group',
          peerName: data.name || 'Group',
        },
      });
    } catch (e: any) {
      setStatus('');
      setError(e?.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Contacts</Text>
      <Text style={styles.subtitle}>Add people by email and start a translated chat instantly.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Add contact by email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="friend@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <Pressable style={styles.addButton} onPress={handleAddContact}>
          <Text style={styles.addText}>{loading ? 'Adding...' : 'Add contact'}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.groupCard}>
        <Text style={styles.groupTitle}>Create group</Text>
        <Text style={styles.groupHint}>Web: Ctrl/Cmd + click contacts to select members</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Team sync"
          style={styles.input}
        />
        <Text style={styles.groupMeta}>Selected: {selectedUserIds.length}</Text>
        <View style={styles.groupActions}>
          <Pressable style={styles.secondaryButton} onPress={() => setSelectedUserIds([])}>
            <Text style={styles.secondaryText}>Clear</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={handleCreateGroup}>
            <Text style={styles.addText}>{loading ? 'Creating...' : 'Create group'}</Text>
          </Pressable>
        </View>
      </View>

      {list.map((contact) => (
        <Pressable
          key={contact.id}
          style={[styles.contactCard, selectedUserIds.includes(contact.userId) && styles.contactCardSelected]}
          onPress={(e) => handleContactPress(contact, e)}>
          <View style={styles.row}>
            <Text style={styles.name}>{contact.name}</Text>
            <Text style={styles.lang}>{contact.language}</Text>
          </View>
          <Text style={styles.email}>{contact.email}</Text>
        </Pressable>
      ))}
      {loading ? <Text style={styles.meta}>Loading...</Text> : null}
      {!loading && !list.length ? <Text style={styles.meta}>No contacts yet.</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#4b5563',
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  groupTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  groupHint: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 12,
  },
  groupMeta: {
    marginTop: 6,
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 12,
  },
  groupActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryText: {
    color: '#374151',
    fontWeight: '700',
  },
  cardLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  contactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  contactCardSelected: {
    borderWidth: 2,
    borderColor: '#0f766e',
    backgroundColor: '#f0fdfa',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  lang: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '700',
  },
  email: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13,
  },
  meta: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 8,
  },
  status: {
    textAlign: 'center',
    color: '#0f766e',
    marginTop: 8,
  },
  error: {
    textAlign: 'center',
    color: '#b91c1c',
    marginTop: 8,
  },
});
