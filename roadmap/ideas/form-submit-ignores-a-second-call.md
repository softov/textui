# A form ignores a submit while one runs

Proposed 2026-11-04, from ahpc's sign-in prompt.

`useForm` sets `submitting` while `onSubmit` runs, and `FormActions` blocks its button on it ([form-actions.ts:26](../../packages/widgets/src/form/form-actions.ts#L26)). `submit()` itself does not check it ([index.ts:99](../../packages/widgets/src/form/index.ts#L99)). A field whose Enter calls `form.submit()` can therefore send the form a second time while the first send is still out.

ahpc meets this on its sign-in prompt: Enter in the token field while `authenticate` is in flight pushes the same token twice. ahpc guards its own field for now.

## Proposal

`submit()` returns at once while a submit runs. It reads a ref, not the `submitting` state, so two calls in one frame are also caught.

## Where

- `packages/widgets/src/form/index.ts`, `submit()`.
- A test that calls `submit()` twice with an `onSubmit` that waits, and counts one call.
- ahpc can drop its own guard once it moves to the release that has it.
