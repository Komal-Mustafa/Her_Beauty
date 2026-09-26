/**
 * A server action as `useActionState` calls it: (previous state, form data) → next state. The
 * auth panels take the app's own actions as props, so each app keeps its redirects and
 * revalidation while the forms stay shared.
 */
export type FormAction<S> = (state: S | null, payload: FormData) => Promise<S>;
