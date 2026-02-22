import { Redirect } from 'expo-router';
import { useSession } from '@/app/lib/session';

export default function EntryScreen() {
  const { token } = useSession();
  return <Redirect href={token ? '/(tabs)' : '/auth/sign-in'} />;
}
