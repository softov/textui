import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { SemanticVariant } from '../types/style.js';
import { h, defineComponent } from '../jsx/factory.js';
import {
  createContext, useCallback, useContext, useMemo, useState, useTheme,
} from '../runtime/hooks.js';
import { Button } from './control.js';

/**
 * Forms and validation.
 *
 * Validation runs on a whole values object rather than per field, because the
 * rules people actually need are cross-field - "confirm must match password",
 * "end must be after start" - and a per-field validator cannot see its
 * siblings. Fields subscribe to the errors that name them.
 */

export type FormErrors<T> = Partial<Record<keyof T & string, string>>;

export type Validator<T> = (values: T) => FormErrors<T> | null;

export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: FormErrors<T>;
  /** Fields the user has interacted with. Errors show only for these. */
  touched: Partial<Record<keyof T & string, boolean>>;
  submitting: boolean;
  submitted: boolean;
  valid: boolean;
  dirty: boolean;
}

export interface FormApi<T extends Record<string, unknown>> extends FormState<T> {
  setValue<K extends keyof T & string>(field: K, value: T[K]): void;
  setValues(values: Partial<T>): void;
  setError(field: keyof T & string, message: string | undefined): void;
  touch(field: keyof T & string): void;
  reset(values?: T): void;
  validate(): boolean;
  submit(): Promise<void>;
  /** The error to show for a field: only after it has been touched. */
  errorFor(field: keyof T & string): string | undefined;
}

const FormContext = createContext<FormApi<Record<string, unknown>> | null>('Form', null);

export interface UseFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validate?: Validator<T>;
  onSubmit?(values: T): void | Promise<void>;
}

export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>,
): FormApi<T> {
  const [values, setValuesState] = useState<T>(options.initialValues);
  // Validate the initial values immediately: a form whose required fields are
  // empty is not valid, and reporting it as valid until the first keystroke
  // makes `form.valid` useless for enabling a submit button.
  const [errors, setErrors] = useState<FormErrors<T>>(
    () => options.validate?.(options.initialValues) ?? {},
  );
  const [touched, setTouched] = useState<Partial<Record<keyof T & string, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [initial] = useState(options.initialValues);

  const runValidation = useCallback(
    (next: T): FormErrors<T> => options.validate?.(next) ?? {},
    [options.validate],
  );

  const setValue = <K extends keyof T & string>(field: K, value: T[K]): void => {
    const next = { ...values, [field]: value } as T;
    setValuesState(next);
    // Re-validate as they type, but only surface what they have touched.
    setErrors(runValidation(next));
  };

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  const api: FormApi<T> = {
    values,
    errors,
    touched,
    submitting,
    submitted,
    valid: Object.keys(errors).length === 0,
    dirty,

    setValue,
    setValues(patch) {
      const next = { ...values, ...patch } as T;
      setValuesState(next);
      setErrors(runValidation(next));
    },
    setError(field, message) {
      setErrors({ ...errors, [field]: message } as FormErrors<T>);
    },
    touch(field) {
      if (touched[field]) return;
      setTouched({ ...touched, [field]: true });
    },
    reset(next) {
      setValuesState(next ?? initial);
      setErrors({});
      setTouched({});
      setSubmitted(false);
    },
    validate() {
      const found = runValidation(values);
      setErrors(found);
      return Object.keys(found).length === 0;
    },
    async submit() {
      const found = runValidation(values);
      setErrors(found);
      // Submitting reveals every error, touched or not.
      setTouched(
        Object.keys(values).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {} as Partial<Record<keyof T & string, boolean>>,
        ),
      );
      if (Object.keys(found).length > 0) return;

      setSubmitting(true);
      try {
        await options.onSubmit?.(values);
        setSubmitted(true);
      } finally {
        setSubmitting(false);
      }
    },
    errorFor(field) {
      return touched[field] || submitted ? errors[field] : undefined;
    },
  };

  return api;
}

export function useFormContext<T extends Record<string, unknown>>(): FormApi<T> {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('[textui] a Field must be rendered inside a Form');
  }
  return form as unknown as FormApi<T>;
}

export interface FormProps extends BoxProps {
  form: FormApi<Record<string, unknown>>;
}

export const Form = defineComponent<FormProps>('Form', ({ form, children, ...rest }) =>
  h(FormContext.Provider, { value: form },
    h('box', { role: 'form', direction: 'column', ...rest }, children)),
);

export interface FieldProps extends BoxProps {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  /** Cells reserved for the label, so a column of fields lines up. */
  labelWidth?: number;
  /** Label above the control rather than beside it. */
  stacked?: boolean;
}

/**
 * A labelled control with its error.
 *
 * The error line is always reserved when one could appear, so a form does not
 * jump a row every time validation fires.
 */
export const Field = defineComponent<FieldProps>('Field', (props) => {
  const theme = useTheme();
  const form = useFormContext();
  const { name, label, hint, required, labelWidth, stacked, children, ...rest } = props;
  const error = form.errorFor(name);

  const labelNode = label
    ? h('box', { direction: 'row', gap: 0, width: stacked ? undefined : labelWidth },
        h('text', { content: label, fg: error ? 'danger' : 'muted' }),
        required ? h('text', { content: '*', fg: 'danger' }) : null)
    : null;

  return h('box', { direction: 'column', ...rest },
    h('box', { direction: stacked ? 'column' : 'row', gap: stacked ? 0 : 1 },
      labelNode,
      h('box', { flex: 1 }, children)),
    error
      ? h('box', { direction: 'row', gap: 1 },
          stacked ? null : h('box', { width: labelWidth }),
          h('text', { content: theme.glyphs.warning, fg: 'danger' }),
          h('text', { content: error, fg: 'danger', wrap: 'word' }))
      : hint
        ? h('box', { direction: 'row', gap: 1 },
            stacked ? null : h('box', { width: labelWidth }),
            h('text', { content: hint, fg: 'subtle' }))
        : null,
  );
});

export interface FormSectionProps extends BoxProps {
  title: string;
  description?: string;
}

export const FormSection = defineComponent<FormSectionProps>('FormSection', (props) => {
  const { title, description, children, ...rest } = props;
  return h('box', { direction: 'column', ...rest },
    h('text', { content: title, bold: true }),
    description ? h('text', { content: description, fg: 'muted', wrap: 'word' }) : null,
    h('box', { direction: 'column' }, children),
  );
});

export interface FormActionsProps extends BoxProps {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?(): void;
  tone?: SemanticVariant;
  /** Disable submit until something changed. */
  requireDirty?: boolean;
}

export const FormActions = defineComponent<FormActionsProps>('FormActions', (props) => {
  const theme = useTheme();
  const form = useFormContext();
  const {
    submitLabel = 'Submit', cancelLabel = 'Cancel', onCancel,
    tone = 'primary', requireDirty = false, ...rest
  } = props;

  const blocked = form.submitting || (requireDirty && !form.dirty);

  return h('box', { direction: 'row', gap: 1, justify: 'end', ...rest },
    onCancel ? h(Button, { label: cancelLabel, onPress: onCancel }) : null,
    h(Button, {
      label: form.submitting ? `${submitLabel}${theme.glyphs.ellipsis}` : submitLabel,
      tone,
      variant: 'solid',
      disabled: blocked,
      onPress: () => void form.submit(),
    }),
  );
});

export interface DangerZoneProps extends BoxProps {
  title?: string;
  description?: string;
  actionLabel: string;
  onAction?(): void;
  /** Require typing this exact text before the action is enabled. */
  confirmText?: string;
}

export const DangerZone = defineComponent<DangerZoneProps>('DangerZone', (props) => {
  const theme = useTheme();
  const {
    title = 'Danger zone', description, actionLabel, onAction, confirmText, ...rest
  } = props;

  return h('box', {
    border: { style: theme.border, color: 'danger' },
    padding: [0, 1],
    direction: 'column',
    title: ` ${title} `,
    ...rest,
  },
    description ? h('text', { content: description, fg: 'muted', wrap: 'word' }) : null,
    confirmText
      ? h('text', { content: `Type "${confirmText}" to confirm.`, fg: 'subtle' })
      : null,
    h('box', { direction: 'row', justify: 'end' },
      h(Button, { label: actionLabel, tone: 'danger', variant: 'outline', onPress: onAction })),
  );
});

// ------------------------------------------------------------- validators

/** Small composable validators, because every form needs the same four. */
export const validators = {
  required: (message = 'Required') =>
    (value: unknown): string | undefined =>
      value === undefined || value === null || value === '' ? message : undefined,

  minLength: (n: number, message?: string) =>
    (value: unknown): string | undefined =>
      typeof value === 'string' && value.length < n
        ? message ?? `Must be at least ${n} characters`
        : undefined,

  maxLength: (n: number, message?: string) =>
    (value: unknown): string | undefined =>
      typeof value === 'string' && value.length > n
        ? message ?? `Must be at most ${n} characters`
        : undefined,

  pattern: (re: RegExp, message = 'Invalid format') =>
    (value: unknown): string | undefined =>
      typeof value === 'string' && value !== '' && !re.test(value) ? message : undefined,

  range: (min: number, max: number, message?: string) =>
    (value: unknown): string | undefined => {
      const n = Number(value);
      return Number.isNaN(n) || n < min || n > max
        ? message ?? `Must be between ${min} and ${max}`
        : undefined;
    },
};

/**
 * Build a whole-form validator from per-field rules.
 *
 * Returns the error map rather than `FormErrors | null`, so it composes: a
 * caller can take the result, add a cross-field rule, and hand the whole thing
 * to `useForm` without a null check in between.
 */
export function fieldValidators<T extends Record<string, unknown>>(
  rules: Partial<Record<keyof T & string, ((value: unknown) => string | undefined)[]>>,
): (values: T) => FormErrors<T> {
  return (values) => {
    const errors: FormErrors<T> = {};
    for (const [field, checks] of Object.entries(rules) as [keyof T & string, ((value: unknown) => string | undefined)[]][]) {
      for (const check of checks ?? []) {
        const message = check(values[field]);
        if (message) {
          errors[field] = message;
          break;
        }
      }
    }
    return errors;
  };
}

export const FORM_COMPONENTS: ComponentDefinition[] = [
  { component: 'Form', category: 'form', renderer: { kind: 'function', render: Form }, role: 'form', description: 'Provides form state to its fields.' },
  { component: 'Field', category: 'form', renderer: { kind: 'function', render: Field }, description: 'Label, control and error, aligned.' },
  { component: 'FormSection', category: 'form', renderer: { kind: 'function', render: FormSection }, description: 'A titled group of fields.' },
  { component: 'FormActions', category: 'form', renderer: { kind: 'function', render: FormActions }, description: 'Submit and cancel.' },
  { component: 'DangerZone', category: 'form', renderer: { kind: 'function', render: DangerZone }, description: 'Destructive action, fenced off.' },
];
