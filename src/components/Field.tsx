/** Labeled text input with inline error. Presentational only. */
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.disabled, !!error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#cfcfcf',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#c0392b' },
  disabled: { backgroundColor: '#f0f0f0', color: '#999' },
  error: { color: '#c0392b', fontSize: 12, marginTop: 4 },
});
