import {
  Button, Column, Field, Form, Panel, RadioGroup, Row, Switch, TextInput,
  Wizard, defineComponent, fieldValidators, useForm, useState, validators,
} from '@textui/core';

/**
 * A setup flow.
 *
 * One form spans every step rather than one form per step, so going back does
 * not lose what was already typed and the final validation sees all of it at
 * once - which is the only way cross-step rules can work.
 */
const STEPS = [
  { id: 'identity', label: 'Identity', description: 'Who this instance belongs to' },
  { id: 'transport', label: 'Transport', description: 'How it is reached' },
  { id: 'review', label: 'Review', description: 'Confirm and finish' },
];

export interface SetupWizardProps {
  onFinish?(values: Record<string, unknown>): void;
}

export function SetupWizard({ onFinish }: SetupWizardProps) {
  const [step, setStep] = useState(0);

  const form = useForm({
    initialValues: { name: '', host: '', protocol: 'https', tls: true },
    validate: fieldValidators({
      name: [validators.required('Name the instance')],
      host: [validators.required('A host is required'), validators.pattern(/^[\w.-]+$/, 'Host looks wrong')],
    }),
    onSubmit: (values) => onFinish?.(values),
  });

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  // Only block on the fields this step actually owns.
  const stepValid =
    step === 0 ? !form.errors.name
      : step === 1 ? !form.errors.host
        : form.valid;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Wizard
        steps={STEPS}
        activeId={current?.id ?? STEPS[0]!.id}
        completedIds={STEPS.slice(0, step).map((s) => s.id)}
      />

      <Panel title={current?.label} flex={1}>
        <Form form={form}>
          {step === 0 ? (
            <Field name="name" label="Name" labelWidth={10} required>
              <TextInput
                value={form.values.name}
                autoFocus
                onChange={(v) => { form.setValue('name', v); form.touch('name'); }}
              />
            </Field>
          ) : null}

          {step === 1 ? (
            <Column>
              <Field name="host" label="Host" labelWidth={10} required>
                <TextInput
                  value={form.values.host}
                  autoFocus
                  onChange={(v) => { form.setValue('host', v); form.touch('host'); }}
                />
              </Field>
              <Field name="protocol" label="Protocol" labelWidth={10}>
                <RadioGroup
                  inline
                  options={[
                    { value: 'https', label: 'https' },
                    { value: 'http', label: 'http' },
                  ]}
                  value={form.values.protocol}
                  onChange={(v) => form.setValue('protocol', v)}
                />
              </Field>
              <Field name="tls" label="Verify TLS" labelWidth={10}>
                <Switch value={form.values.tls} onChange={(v) => form.setValue('tls', v)} />
              </Field>
            </Column>
          ) : null}

          {step === 2 ? (
            <Column>
              <Row gap={1}><text content="Name" fg="muted" /><text content={form.values.name} /></Row>
              <Row gap={1}><text content="Host" fg="muted" /><text content={form.values.host} /></Row>
              <Row gap={1}><text content="Protocol" fg="muted" /><text content={form.values.protocol} /></Row>
              <Row gap={1}><text content="TLS" fg="muted" /><text content={form.values.tls ? 'verified' : 'ignored'} /></Row>
            </Column>
          ) : null}
        </Form>
      </Panel>

      <Row gap={1} justify="end">
        <Button label="Back" disabled={step === 0} onPress={() => setStep(step - 1)} />
        <Button
          label={last ? 'Finish' : 'Next'}
          tone="primary"
          variant="solid"
          disabled={!stepValid}
          onPress={() => (last ? void form.submit() : setStep(step + 1))}
        />
      </Row>
    </Column>
  );
}

export default defineComponent('SetupWizard', SetupWizard);
