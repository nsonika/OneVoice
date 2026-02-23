import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/app/lib/session';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Telugu', value: 'te' },
  { label: 'Kannada', value: 'kn' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateMe, signOut } = useSession();
  const [name, setName] = useState('');
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
      setMessage('Settings updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      if (e?.response?.status === 401) signOut();
      setMessage(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile Settings</Text>
        <Pressable onPress={signOut} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.light.error} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHero}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
              <Pressable style={styles.editAvatarBtn}>
                <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={Colors.light.muted} style={styles.inputIcon} />
                  <TextInput 
                    value={name} 
                    onChangeText={setName} 
                    style={styles.input} 
                    placeholder="Enter your name" 
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Preferred Language</Text>
                <Text style={styles.hint}>This is the language you'll receive messages in.</Text>
                <View style={styles.languageWrap}>
                  {LANGUAGES.map((lang) => (
                    <Pressable
                      key={lang.value}
                      onPress={() => setPreferredLanguage(lang.value)}
                      style={[
                        styles.chip, 
                        preferredLanguage === lang.value && styles.chipActive
                      ]}>
                      <Text style={[
                        styles.chipText, 
                        preferredLanguage === lang.value && styles.chipTextActive
                      ]}>
                        {lang.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Preferences</Text>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="notifications-outline" size={22} color={Colors.light.muted} />
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                </View>
                <View style={styles.togglePlaceholder} />
              </View>
              <View style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="moon-outline" size={22} color={Colors.light.muted} />
                  <Text style={styles.settingLabel}>Dark Mode</Text>
                </View>
                <View style={styles.togglePlaceholder} />
              </View>
            </View>
          </View>

          {message ? (
            <View style={[
              styles.messageContainer, 
              message.includes('failed') ? styles.errorContainer : styles.successContainer
            ]}>
              <Ionicons 
                name={message.includes('failed') ? "alert-circle" : "checkmark-circle"} 
                size={18} 
                color={message.includes('failed') ? Colors.light.error : Colors.light.success} 
              />
              <Text style={[
                styles.messageText,
                { color: message.includes('failed') ? Colors.light.error : Colors.light.success }
              ]}>{message}</Text>
            </View>
          ) : null}

          <Pressable 
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              saving && styles.saveBtnDisabled
            ]} 
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>

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
  logoutBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileHero: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    elevation: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1e293b',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.muted,
    marginTop: 4,
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
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: Colors.light.muted,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
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
    fontSize: 15,
    color: Colors.light.text,
  },
  languageWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  chipTextActive: {
    color: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  togglePlaceholder: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  successContainer: {
    backgroundColor: '#ecfdf5',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  saveBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
