/**
 * T6 — UI projection of the KYC machine.
 *
 * App holds the single useReducer machine, runs the boot/resume effect
 * (load local draft + fetch service state -> reconcile -> hydrate), wires the
 * bounded poll hook, and renders purely as a function of
 * (machineStatus, application.status, currentStep). No navigation library owns
 * step or status — the reducer is the source of truth.
 */

import { useEffect, useReducer, type ReactNode } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner } from './src/components/Banner';
import { Button } from './src/components/Button';
import { usePollKycStatus } from './src/hooks/usePollKycStatus';
import { AddressScreen } from './src/screens/AddressScreen';
import { DocumentScreen } from './src/screens/DocumentScreen';
import { PersonalInfoScreen } from './src/screens/PersonalInfoScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { StatusScreen } from './src/screens/StatusScreen';
import {
  fetchKycApplication,
  saveKycDraft,
  seedKyc,
  submitKycApplication,
} from './src/services/fakeKycService';
import { archiveDraft, loadDraft, saveDraft } from './src/services/draftStorage';
import { reconcile } from './src/state/conflictResolution';
import { EditableSection, initialState, reducer } from './src/state/reducer';
import { KycApplication, KycStep, REQUIRED_FIELD_TO_STEP } from './src/types/kyc';
import { FieldError, validateFields, validateStep } from './src/validation/stepValidation';

const STEP_TITLES: Partial<Record<KycStep, string>> = {
  personal_info: 'Step 1 of 4 · Personal info',
  address: 'Step 2 of 4 · Address',
  document: 'Step 3 of 4 · Document',
  review: 'Step 4 of 4 · Review',
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { application, currentStep, machineStatus, validationErrors, error } = state;

  // --- Boot / resume -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      dispatch({ type: 'BOOT_START' });
      const [local, server] = await Promise.all([loadDraft(), fetchKycApplication()]);
      const r = reconcile(local, server);
      if (r.archiveLocal) {
        // Preserve unsynced local edits rather than deleting them (Hole 1).
        await archiveDraft();
      }
      // Give the in-memory service session memory so fetch/poll stay consistent
      // with the resumed state (the service otherwise forgets on reload).
      seedKyc(r.application);
      if (cancelled) return;
      dispatch({
        type: 'HYDRATE',
        application: r.application,
        currentStep: r.nextStep,
        archivedNoticeShown: r.archiveLocal,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Bounded polling while submitted ------------------------------------
  usePollKycStatus({
    active:
      application?.status === 'submitted' &&
      !state.pollBoundHit &&
      machineStatus !== 'error',
    onResult: (app) => dispatch({ type: 'POLL_TICK', application: app }),
    onBoundHit: () => dispatch({ type: 'POLL_BOUND_HIT' }),
    onError: () => dispatch({ type: 'POLL_ERROR', message: 'Status check failed.' }),
  });

  const busy = machineStatus === 'saving' || machineStatus === 'submitting';

  const onEdit = (section: EditableSection, key: string, value: string) =>
    dispatch({ type: 'EDIT_FIELD', section, key, value });

  // --- Handlers ------------------------------------------------------------
  const handleNext = async () => {
    if (!application) return;
    const res = validateStep(currentStep, application);
    dispatch({ type: 'VALIDATE_STEP', errors: res.errors });
    if (!res.valid) return;

    dispatch({ type: 'SAVE_START' });
    try {
      const saved = await saveKycDraft(application);
      dispatch({ type: 'SAVE_SUCCESS', application: saved });
      await saveDraft(saved);
      dispatch({ type: 'NEXT_STEP' });
    } catch {
      // Non-fatal: keep in-memory edits, tell the user they're safe locally.
      dispatch({
        type: 'SAVE_ERROR',
        message: 'Could not save to the device. Your changes are kept for this session.',
      });
      dispatch({ type: 'NEXT_STEP' });
    }
  };

  const handlePrev = () => dispatch({ type: 'PREV_STEP' });

  const handleSubmit = async () => {
    if (!application) return;
    // Defense-in-depth: never submit incomplete data, even if a resumed draft
    // lands on review. Gate on every required field across all steps.
    const allFields = Object.keys(REQUIRED_FIELD_TO_STEP) as (keyof typeof REQUIRED_FIELD_TO_STEP)[];
    const gate = validateFields(allFields, application);
    if (!gate.valid) {
      dispatch({ type: 'VALIDATE_STEP', errors: gate.errors });
      return;
    }
    dispatch({ type: 'SUBMIT_START' });
    try {
      const submitted = await submitKycApplication(application.id);
      dispatch({ type: 'SUBMIT_SUCCESS', application: submitted });
      await saveDraft(submitted).catch(() => undefined);
    } catch {
      dispatch({
        type: 'SUBMIT_ERROR',
        message: 'Network error while submitting. Please try again.',
        retryable: true,
      });
    }
  };

  // Resubmit from requires_more_info — gated on EVERY required field (Hole 3).
  const handleResubmit = async () => {
    if (!application) return;
    const res = validateFields(application.requiredFields ?? [], application);
    dispatch({ type: 'VALIDATE_STEP', errors: res.errors });
    if (!res.valid) return;

    // Persist corrections first so they reach the service (which invalidates the
    // prior submission's cached result) and survive on disk. Without this the
    // resubmit would replay the stale cached outcome and lose the corrections.
    dispatch({ type: 'SAVE_START' });
    let saved;
    try {
      saved = await saveKycDraft(application); // status -> draft, cache cleared
      dispatch({ type: 'SAVE_SUCCESS', application: saved });
      await saveDraft(saved).catch(() => undefined);
    } catch {
      dispatch({
        type: 'SAVE_ERROR',
        message: 'Could not save your corrections. Please try again.',
      });
      return;
    }
    await handleSubmit();
  };

  const handleRetry = () => {
    dispatch({ type: 'RETRY' });
    if (application?.status === 'draft' || application?.status === 'requires_more_info') {
      // A submit failure (e.g. NETFAIL) leaves status pre-submit; re-attempt.
      void handleSubmit();
    }
  };

  // --- Render (pure projection of machine state) ---------------------------
  let body: ReactNode = null;
  let footer: ReactNode = null;
  let title = 'KYC verification';

  if (machineStatus === 'loading' || !application) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a58ca" />
        <Text style={styles.loadingText}>Loading your application…</Text>
      </View>
    );
  } else if (application.status === 'approved') {
    body = <StatusScreen variant="approved" />;
  } else if (application.status === 'rejected') {
    body = <StatusScreen variant="rejected" rejectionReason={application.rejectionReason} />;
  } else if (application.status === 'submitted') {
    title = 'Verification';
    body = <StatusScreen variant="pending" />;
  } else if (application.status === 'requires_more_info') {
    title = 'More information needed';
    const missing = (application.requiredFields ?? [])
      .map((f) => `${REQUIRED_FIELD_TO_STEP[f]} · ${f}`)
      .join('\n');
    body = (
      <View>
        <Banner tone="warning" message={`We need a bit more information:\n${missing}`} />
        {renderEditableStep(currentStep, application, validationErrors, busy, onEdit)}
      </View>
    );
    footer = <Button title="Submit corrections" onPress={handleResubmit} busy={busy} disabled={busy} />;
  } else {
    // draft / not_started -> wizard
    title = STEP_TITLES[currentStep] ?? 'KYC verification';
    if (currentStep === 'review') {
      body = <ReviewScreen app={application} />;
      footer = (
        <>
          <Button title="Submit application" onPress={handleSubmit} busy={busy} disabled={busy} />
          <Button title="Back" variant="secondary" onPress={handlePrev} disabled={busy} />
        </>
      );
    } else {
      body = renderEditableStep(currentStep, application, validationErrors, busy, onEdit);
      footer = (
        <>
          <Button title="Next" onPress={handleNext} busy={busy} disabled={busy} />
          {currentStep !== 'personal_info' && (
            <Button title="Back" variant="secondary" onPress={handlePrev} disabled={busy} />
          )}
        </>
      );
    }
  }

  const showArchivedNotice =
    state.archivedNoticeShown &&
    (application?.status === 'submitted' ||
      application?.status === 'approved' ||
      application?.status === 'rejected');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.appTitle}>{title}</Text>

        {showArchivedNotice && (
          <Banner
            tone="info"
            message="Your unsynced local edits were preserved. The verification status from the service is shown here."
          />
        )}

        {error && (
          <Banner
            tone="error"
            message={error.message}
            actionLabel={error.retryable ? 'Retry' : undefined}
            onAction={error.retryable ? handleRetry : undefined}
          />
        )}

        {state.pollBoundHit && application?.status === 'submitted' && (
          <Banner
            tone="warning"
            message="Still verifying. You can check again."
            actionLabel="Check again"
            onAction={handleRetry}
          />
        )}

        <View style={styles.body}>{body}</View>
      </ScrollView>

      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

function renderEditableStep(
  step: KycStep,
  app: KycApplication,
  errors: FieldError[],
  disabled: boolean,
  onEdit: (section: EditableSection, key: string, value: string) => void,
) {
  switch (step) {
    case 'personal_info':
      return <PersonalInfoScreen app={app} errors={errors} disabled={disabled} onEdit={onEdit} />;
    case 'address':
      return <AddressScreen app={app} errors={errors} disabled={disabled} onEdit={onEdit} />;
    case 'document':
      return <DocumentScreen app={app} errors={errors} disabled={disabled} onEdit={onEdit} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 20, paddingBottom: 32, flexGrow: 1 },
  appTitle: { fontSize: 15, fontWeight: '600', color: '#666', marginBottom: 16 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 16, color: '#666', fontSize: 15 },
  footer: {
    padding: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
});
