import { StyleSheet, Text, View } from 'react-native';
import { KycApplication } from '../types/kyc';

interface ScreenProps {
  app: KycApplication;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

/**
 * Review shows REAL values to the user (it is their own data on their device).
 * Redaction applies only to logs, never to the on-screen review.
 */
export function ReviewScreen({ app }: ScreenProps) {
  return (
    <View>
      <Text style={styles.heading}>Review &amp; submit</Text>

      <Text style={styles.section}>Personal information</Text>
      <Row label="Legal name" value={app.personalInfo?.legalName} />
      <Row label="Date of birth" value={app.personalInfo?.dateOfBirth} />
      <Row label="Nationality" value={app.personalInfo?.nationality} />

      <Text style={styles.section}>Address</Text>
      <Row label="Country" value={app.address?.country} />
      <Row label="City" value={app.address?.city} />
      <Row label="Address line 1" value={app.address?.line1} />

      <Text style={styles.section}>Document</Text>
      <Row label="Type" value={app.document?.type} />
      <Row label="Number" value={app.document?.documentNumber} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: { fontSize: 13, fontWeight: '700', color: '#666', marginTop: 16, marginBottom: 4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  rowLabel: { fontSize: 15, color: '#444' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#111', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
});
