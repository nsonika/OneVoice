import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

type Contact = {
  id: string;
  name: string;
  email: string;
  language: string;
};

const INITIAL_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Arjun', email: 'arjun@example.com', language: 'Hindi' },
  { id: 'c2', name: 'Keerthi', email: 'keerthi@example.com', language: 'Tamil' },
];

export default function ContactsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const list = useMemo(() => contacts, [contacts]);

  function handleAddContact() {
    if (!email.trim()) return;
    const handle = email.split('@')[0] || 'New Contact';
    const next: Contact = {
      id: String(Date.now()),
      name: handle.charAt(0).toUpperCase() + handle.slice(1),
      email,
      language: 'English',
    };
    setContacts((prev) => [next, ...prev]);
    setEmail('');
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
          <Text style={styles.addText}>Add contact</Text>
        </Pressable>
      </View>

      {list.map((contact) => (
        <Pressable
          key={contact.id}
          style={styles.contactCard}
          onPress={() =>
            router.push({
              pathname: '/chat/[id]',
              params: { id: contact.id, name: contact.name, language: contact.language },
            })
          }>
          <View style={styles.row}>
            <Text style={styles.name}>{contact.name}</Text>
            <Text style={styles.lang}>{contact.language}</Text>
          </View>
          <Text style={styles.email}>{contact.email}</Text>
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
});
