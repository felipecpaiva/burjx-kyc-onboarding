import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusVariant } from '../state/reducer';

interface ScreenProps {
  variant: Exclude<StatusVariant, null | 'more_info'>;
  rejectionReason?: string;
}

const COPY: Record<ScreenProps['variant'], { emoji: string; title: string; body: string; color: string }> = {
  pending: {
    emoji: '⏳',
    title: 'Verification in progress',
    body: 'We are reviewing your application. This usually takes a moment.',
    color: '#8a5a00',
  },
  approved: {
    emoji: '✅',
    title: 'You are verified',
    body: 'Your KYC application has been approved. You can now use your account.',
    color: '#1e7e34',
  },
  rejected: {
    emoji: '⛔',
    title: 'Application not approved',
    body: 'Unfortunately your application could not be verified.',
    color: '#8a1c12',
  },
};

export function StatusScreen({ variant, rejectionReason }: ScreenProps) {
  const c = COPY[variant];
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{c.emoji}</Text>
      <Text style={[styles.title, { color: c.color }]}>{c.title}</Text>
      <Text style={styles.body}>{c.body}</Text>
      {variant === 'rejected' && !!rejectionReason && (
        <Text style={styles.reason}>Reason: {rejectionReason}</Text>
      )}
      {variant === 'pending' && <ActivityIndicator style={styles.spinner} color={c.color} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 16, color: '#444', textAlign: 'center', lineHeight: 22 },
  reason: { fontSize: 14, color: '#8a1c12', marginTop: 16, textAlign: 'center' },
  spinner: { marginTop: 24 },
});
