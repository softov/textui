import type { ComponentDefinition } from '@textui/core';
import { useCallback, useMemo, useState } from '@textui/core';
import { DangerZone } from './danger-zone.js';
import { Field } from './field.js';
import { FormActions } from './form-actions.js';
import { FormSection } from './form-section.js';
import { Form } from './form.js';
import type { FormApi, FormErrors } from './shared.js';

/**
 * Forms and validation.
 *
 * Validation runs on a whole values object rather than per field, because the
 * rules people actually need are cross-field - "confirm must match password",
 * "end must be after start" - and a per-field validator cannot see its
 * siblings. Fields subscribe to the errors that name them.
 */
export * from './danger-zone.js';
export * from './field.js';
export * from './form.js';
export * from './form-actions.js';
export * from './form-section.js';
export type { FormApi, FormErrors, FormState } from './shared.js';
export { useFormContext } from './shared.js';

export type Validator<T> = (values: T) => FormErrors<T> | null;

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
