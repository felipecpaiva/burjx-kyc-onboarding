import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Field } from '../components/Field';
import { DocumentType, KycApplication, KycRequiredField } from '../types/kyc';
import { FieldError } from '../validation/stepValidation';
import { EditableSection } from '../state/reducer';

interface ScreenProps {
  app: KycApplication;
  errors: FieldError[];
  disabled: boolean;
  onEdit: (section: EditableSection, key: string, value: string) => void;
}

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's license" },
];

function errFor(errors: FieldError[], field: KycRequiredField): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function DocumentScreen({ app, errors, disabled, onEdit }: ScreenProps) {
  const doc = app.document;
  const typeError = errFor(errors, 'document.type');
  return (
    <View>
      <Text style={styles.heading}>Identity document</Text>

      <Text style={styles.label}>Document type</Text>
      <View style={styles.chips}>
        {DOC_TYPES.map((t) => {
          const selected = doc?.type === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
              onPress={() => onEdit('document', 'type', t.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!!typeError && <Text style={styles.error}>{typeError}</Text>}

      <View style={styles.spacer} />

      <Field
        label="Document number"
        value={doc?.documentNumber ?? ''}
        onChangeText={(v) => onEdit('document', 'documentNumber', v)}
        placeholder="Document number"
        error={errFor(errors, 'document.documentNumber')}
        editable={!disabled}
        autoCapitalize="characters"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#222' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cfcfcf', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#0a58ca', borderColor: '#0a58ca' },
  chipDisabled: { opacity: 0.5 },
  chipText: { color: '#222', fontSize: 14 },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  error: { color: '#c0392b', fontSize: 12, marginTop: 8 },
  spacer: { height: 20 },
});
