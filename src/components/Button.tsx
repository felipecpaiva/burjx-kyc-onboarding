/** Primary/secondary button with busy + disabled states. Presentational only. */
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  busy?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || busy) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#222'} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  primary: { backgroundColor: '#0a58ca' },
  secondary: { backgroundColor: '#e9ecef' },
  disabled: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: '700' },
  textPrimary: { color: '#fff' },
  textSecondary: { color: '#222' },
});
