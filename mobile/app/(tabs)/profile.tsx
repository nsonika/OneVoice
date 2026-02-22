import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu'];

export default function ProfileScreen() {
  const [name, setName] = useState('Demo User');
  const [preferredLanguage, setPreferredLanguage] = useState('English');

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
              key={lang}
              onPress={() => setPreferredLanguage(lang)}
              style={[styles.chip, preferredLanguage === lang && styles.chipActive]}>
              <Text style={[styles.chipText, preferredLanguage === lang && styles.chipTextActive]}>
                {lang}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveText}>Save preferences</Text>
        </Pressable>
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
});
