import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/app/lib/session';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) return;
    try {
      setError('');
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Sign in failed');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand}>OneVoice</Text>
        <Text style={styles.tagline}>Real-time multilingual conversation</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Use email for demo. It is faster than phone OTP setup.</Text>

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
          placeholder="Enter password"
          secureTextEntry
          style={styles.input}
        />

        <Pressable style={styles.cta} onPress={handleSignIn}>
          <Text style={styles.ctaText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Link href="/auth/sign-up" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.linkText}>New here? Create an account</Text>
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
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: '#4b5563',
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
