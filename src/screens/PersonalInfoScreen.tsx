import { Text, StyleSheet, View } from 'react-native';
import { Field } from '../components/Field';
import { KycApplication } from '../types/kyc';
import { errorFor, FieldError } from '../validation/stepValidation';
import { EditableSection } from '../state/reducer';

interface ScreenProps {
  app: KycApplication;
  errors: FieldError[];
  disabled: boolean;
  onEdit: (section: EditableSection, key: string, value: string) => void;
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
        error={errorFor(errors, 'personalInfo.legalName')}
        editable={!disabled}
        autoCapitalize="words"
      />
      <Field
        label="Date of birth (YYYY-MM-DD)"
        value={pi?.dateOfBirth ?? ''}
        onChangeText={(v) => onEdit('personalInfo', 'dateOfBirth', v)}
        placeholder="1990-01-31"
        error={errorFor(errors, 'personalInfo.dateOfBirth')}
        editable={!disabled}
        autoCapitalize="none"
      />
      <Field
        label="Nationality"
        value={pi?.nationality ?? ''}
        onChangeText={(v) => onEdit('personalInfo', 'nationality', v)}
        placeholder="e.g. United States"
        error={errorFor(errors, 'personalInfo.nationality')}
        editable={!disabled}
        autoCapitalize="words"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
});
