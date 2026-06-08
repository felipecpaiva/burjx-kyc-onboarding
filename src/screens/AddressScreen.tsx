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

export function AddressScreen({ app, errors, disabled, onEdit }: ScreenProps) {
  const a = app.address;
  return (
    <View>
      <Text style={styles.heading}>Address</Text>
      <Field
        label="Country"
        value={a?.country ?? ''}
        onChangeText={(v) => onEdit('address', 'country', v)}
        error={errorFor(errors, 'address.country')}
        editable={!disabled}
        autoCapitalize="words"
      />
      <Field
        label="City"
        value={a?.city ?? ''}
        onChangeText={(v) => onEdit('address', 'city', v)}
        error={errorFor(errors, 'address.city')}
        editable={!disabled}
        autoCapitalize="words"
      />
      <Field
        label="Address line 1"
        value={a?.line1 ?? ''}
        onChangeText={(v) => onEdit('address', 'line1', v)}
        error={errorFor(errors, 'address.line1')}
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
});
