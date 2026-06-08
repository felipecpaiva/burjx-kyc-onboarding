/** Inline notice / error banner with optional action. Presentational only. */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tone = 'info' | 'warning' | 'error';

interface BannerProps {
  tone: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: '#e8f0fe', fg: '#1a3a7a' },
  warning: { bg: '#fff4e5', fg: '#8a5a00' },
  error: { bg: '#fdecea', fg: '#8a1c12' },
};

export function Banner({ tone, message, actionLabel, onAction }: BannerProps) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: t.bg }]}>
      <Text style={[styles.msg, { color: t.fg }]}>{message}</Text>
      {!!actionLabel && !!onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={[styles.action, { color: t.fg }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, padding: 12, marginBottom: 16 },
  msg: { fontSize: 14 },
  action: { fontSize: 14, fontWeight: '700', marginTop: 8, textDecorationLine: 'underline' },
});
