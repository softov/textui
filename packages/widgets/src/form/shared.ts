import { createContext, useContext } from '@textui/core';

export type FormErrors<T> = Partial<Record<keyof T & string, string>>;

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

export const FormContext = createContext<FormApi<Record<string, unknown>> | null>('Form', null);

export function useFormContext<T extends Record<string, unknown>>(): FormApi<T> {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('[textui] a Field must be rendered inside a Form');
  }
  return form as unknown as FormApi<T>;
}
