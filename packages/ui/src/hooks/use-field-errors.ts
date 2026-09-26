'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from 'react';
import type { FieldCheck, FieldErrorMap } from '../lib/field-checks';

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type ServerState = { fieldErrors?: FieldErrorMap } | null | undefined;

export type UseFieldErrorsOptions = {
  /** Checks that need several fields (run on submit only). */
  formCheck?: (form: HTMLFormElement) => FieldErrorMap;
};

const KEEP_TYPES = new Set(['hidden', 'submit', 'button', 'checkbox', 'radio', 'file']);

function isField(el: unknown): el is FieldElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/** The first control in document order whose name has an error (a radio group: its first option). */
function firstInvalid(form: HTMLFormElement, errors: FieldErrorMap): HTMLElement | null {
  for (const el of Array.from(form.elements)) {
    if (isField(el) && el.name && errors[el.name]) return el;
  }
  return null;
}

/**
 * Blur-first validation: a field is checked when it loses focus, its error clears as soon as the
 * value is fixed, and everything is checked on submit (the first invalid field, in the order the
 * person reads the form, gets focus). Server field errors show until that field is edited.
 *
 * `server` must be the action's error state (null after a success). React resets a form after
 * its action runs; when the action comes back with an error we put back what the person typed
 * (it never leaves the browser), so fixing one field does not mean retyping the others.
 */
export function useFieldErrors(
  checks: Record<string, FieldCheck>,
  server: ServerState,
  { formCheck }: UseFieldErrorsOptions = {},
) {
  const [client, setClient] = useState<FieldErrorMap>({});
  const [edited, setEdited] = useState<{ source: ServerState; names: string[] }>({
    source: server,
    names: [],
  });
  const editedNames = edited.source === server ? edited.names : [];
  const submitted = useRef<{ form: HTMLFormElement; values: Map<string, string> } | null>(null);

  useEffect(() => {
    const last = submitted.current;
    submitted.current = null;
    if (!last || !server) return;
    for (const [name, value] of last.values) {
      const el = last.form.elements.namedItem(name);
      if (el instanceof HTMLInputElement && el.value === '') el.value = value;
    }
  }, [server]);

  function run(el: FieldElement): string | undefined {
    return checks[el.name]?.(el.value, el.form);
  }

  function store(name: string, message: string | undefined) {
    setClient((prev) => {
      if (prev[name] === message) return prev;
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  function onBlur(e: FocusEvent<FieldElement>) {
    const el = e.currentTarget;
    if (el.value === '' && !client[el.name]) return; // do not nag on a field only tabbed through
    store(el.name, run(el));
  }

  function onChange(e: ChangeEvent<FieldElement>) {
    const el = e.currentTarget;
    if (!editedNames.includes(el.name)) {
      setEdited({ source: server, names: [...editedNames, el.name] });
    }
    if (client[el.name]) store(el.name, run(el));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const found: FieldErrorMap = { ...(formCheck?.(form) ?? {}) };
    for (const name of Object.keys(checks)) {
      const el = form.elements.namedItem(name);
      if (isField(el)) {
        const message = found[name] ?? run(el);
        if (message) found[name] = message;
      }
    }
    setClient(found);
    if (Object.keys(found).length) {
      e.preventDefault();
      firstInvalid(form, found)?.focus();
      return;
    }
    const values = new Map<string, string>();
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement && el.name && !KEEP_TYPES.has(el.type) && el.value) {
        values.set(el.name, el.value);
      }
    }
    submitted.current = { form, values };
  }

  const errorFor = (name: string): string | undefined =>
    client[name] ?? (editedNames.includes(name) ? undefined : server?.fieldErrors?.[name]);

  return { errorFor, field: { onBlur, onChange }, onSubmit };
}
