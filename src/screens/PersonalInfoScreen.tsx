import { Text, StyleSheet, View } from 'react-native';
import { Field } from '../components/Field';
import { KycApplication, KycRequiredField } from '../types/kyc';
import { FieldError } from '../validation/stepValidation';
import { EditableSection } from '../state/reducer';

interface ScreenProps {
  app: KycApplication;
  errors: FieldError[];
  disabled: boolean;
  onEdit: (section: EditableSection, key: string, value: string) => void;
}

function errFor(errors: FieldError[], field: KycRequiredField): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function PersonalInfoScreen({ app, errors, disabled, onEdit }: ScreenProps) {
  const pi = app.personalInfo;
  return (
    <View>
      <Text style={styles.heading}>Personal information</Text>
      <Field
        label="Legal name"
        value={pi?.legalName ?? ''}
        onChangeText={(v) => onEdit('personalInfo', 'legalName', v)}
        placeholder="As shown on your ID"
        error={errFor(errors, 'personalInfo.legalName')}
        editable={!disabled}
        autoCapitalize="words"
      />
      <Field
        label="Date of birth (YYYY-MM-DD)"
        value={pi?.dateOfBirth ?? ''}
        onChangeText={(v) => onEdit('personalInfo', 'dateOfBirth', v)}
        placeholder="1990-01-31"
        error={errFor(errors, 'personalInfo.dateOfBirth')}
        editable={!disabled}
        autoCapitalize="none"
      />
      <Field
        label="Nationality"
        value={pi?.nationality ?? ''}
        onChangeText={(v) => onEdit('personalInfo', 'nationality', v)}
        placeholder="e.g. United States"
        error={errFor(errors, 'personalInfo.nationality')}
        editable={!disabled}
        autoCapitalize="words"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
});
