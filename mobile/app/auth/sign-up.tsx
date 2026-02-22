import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/app/lib/session';

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, loading } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');

  async function handleCreateAccount() {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    try {
      setError('');
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        preferredLanguage: language,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Sign up failed');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand}>OneVoice</Text>
        <Text style={styles.tagline}>Set your language and start chatting instantly</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign up</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          style={styles.input}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Create password"
          secureTextEntry
          style={styles.input}
        />

        <Text style={styles.label}>Preferred language</Text>
        <View style={styles.langWrap}>
          {LANGUAGES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setLanguage(item.value)}
              style={[styles.langChip, item.value === language && styles.langChipActive]}>
              <Text style={[styles.langText, item.value === language && styles.langTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.cta} onPress={handleCreateAccount}>
          <Text style={styles.ctaText}>{loading ? 'Creating...' : 'Create account'}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Link href="/auth/sign-in" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  hero: {
    backgroundColor: '#0f766e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  brand: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 28,
  },
  tagline: {
    color: '#ccfbf1',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  title: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 24,
    marginBottom: 12,
  },
  label: {
    color: '#6b7280',
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  langWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  langChip: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  langChipActive: {
    backgroundColor: '#0f766e',
  },
  langText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 12,
  },
  langTextActive: {
    color: '#ffffff',
  },
  cta: {
    marginTop: 4,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  linkWrap: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    color: '#0f766e',
    fontWeight: '700',
  },
  error: {
    marginTop: 4,
    color: '#b91c1c',
    fontSize: 12,
  },
});
