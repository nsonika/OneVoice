import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/app/lib/session';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/app/lib/i18n';

const LANGUAGES = [
  { value: 'en' },
  { value: 'hi' },
  { value: 'ta' },
  { value: 'te' },
  { value: 'kn' },
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
      setError(e?.response?.data?.error || i18n.t('auth.signUpFailed'));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.light.tint} />
            </View>
            <Text style={styles.brand}>OneVoice</Text>
            <Text style={styles.tagline}>{i18n.t('auth.signUpTagline')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{i18n.t('auth.signUpTitle')}</Text>
            <Text style={styles.subtitle}>{i18n.t('auth.signUpSubtitle')}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{i18n.t('auth.fullName')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={i18n.t('auth.fullNamePlaceholder')}
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{i18n.t('auth.email')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={i18n.t('auth.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{i18n.t('auth.password')}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={i18n.t('auth.passwordPlaceholder')}
                  secureTextEntry
                  style={styles.input}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Text style={styles.label}>{i18n.t('auth.preferredLanguage')}</Text>
            <View style={styles.langWrap}>
              {LANGUAGES.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setLanguage(item.value)}
                  style={[
                    styles.langChip, 
                    item.value === language && styles.langChipActive,
                    { elevation: item.value === language ? 4 : 0 }
                  ]}>
                  <Text style={[styles.langText, item.value === language && styles.langTextActive]}>
                    {i18n.t(`languages.${item.value}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={Colors.light.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable 
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
                loading && styles.ctaDisabled
              ]} 
              onPress={handleCreateAccount}
              disabled={loading}
            >
              <Text style={styles.ctaText}>{loading ? i18n.t('auth.creating') : i18n.t('auth.createAccount')}</Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{i18n.t('auth.hasAccount')} </Text>
              <Link href="/auth/sign-in" asChild>
                <Pressable>
                  <Text style={styles.linkText}>{i18n.t('auth.signIn')}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  brand: {
    color: Colors.light.text,
    fontWeight: '900',
    fontSize: 32,
    letterSpacing: -1,
  },
  tagline: {
    color: Colors.light.muted,
    marginTop: 4,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 32,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  title: {
    color: Colors.light.text,
    fontWeight: '800',
    fontSize: 24,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 24,
    color: Colors.light.muted,
    fontSize: 15,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: Colors.light.text,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  langWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    marginTop: 8,
  },
  langChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  langChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  langText: {
    color: Colors.light.text,
    fontWeight: '600',
    fontSize: 13,
  },
  langTextActive: {
    color: '#ffffff',
  },
  cta: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaDisabled: {
    backgroundColor: '#94a3b8',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.light.muted,
    fontSize: 14,
  },
  linkText: {
    color: Colors.light.tint,
    fontWeight: '700',
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.light.error,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
});
