import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
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

      {list.map((contact) => (
        <Pressable
          key={contact.id}
          style={styles.contactCard}
          onPress={() => handleOpenContact(contact)}>
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
    marginBottom: 18,
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
