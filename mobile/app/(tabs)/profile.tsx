import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/app/lib/session';

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
];

export default function ProfileScreen() {
  const { user, updateMe, signOut } = useSession();
  const [name, setName] = useState('Demo User');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPreferredLanguage(user.preferredLanguage);
  }, [user]);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage('');
      await updateMe({ name: name.trim(), preferredLanguage });
      setMessage('Saved');
    } catch (e: any) {
      if (e?.response?.status === 401) signOut();
      setMessage(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Choose your preferred language for translated messages.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Display name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Enter your name" />

        <Text style={styles.label}>Preferred language</Text>
        <View style={styles.languageWrap}>
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang.value}
              onPress={() => setPreferredLanguage(lang.value)}
              style={[styles.chip, preferredLanguage === lang.value && styles.chipActive]}>
              <Text style={[styles.chipText, preferredLanguage === lang.value && styles.chipTextActive]}>
                {lang.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save preferences'}</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
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
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
  },
  label: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  languageWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#0f766e',
  },
  chipText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  message: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
});
