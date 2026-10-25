'use client';

import { t } from '@gravn/shared';
import { useActionState, useState } from 'react';

import type { FormState } from '@/lib/form-state';

export interface FieldSpec {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'select';
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submit: string;
  fields?: FieldSpec[];
  hidden?: Record<string, string>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  confirm?: string;
  inline?: boolean;
}

// Every form and action button on the web: validation errors, pending state, a
// confirmation prompt, and the copyable link an invitation returns.
export function Form({
  action,
  submit,
  fields = [],
  hidden = {},
  variant = 'primary',
  confirm,
  inline,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={(formData) => {
        // Sign-up stores the device timezone on the new profile.
        formData.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
        formAction(formData);
      }}
      className={inline ? 'form inline' : 'form'}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <Field
          key={f.name}
          spec={f}
          value={state?.values?.[f.name]}
          error={state?.fieldErrors?.[f.name]}
        />
      ))}
      <button type="submit" className={`button ${variant}`} disabled={pending} aria-busy={pending}>
        {pending ? t('common.loading') : submit}
      </button>
      {state?.error && (
        <p role="alert" className="message error">
          {state.error}
        </p>
      )}
      {state?.notice && (
        <p role="status" className="message notice">
          {state.notice}
        </p>
      )}
      {state?.link && <CopyLink url={state.link} />}
    </form>
  );
}

function Field({ spec, value, error }: { spec: FieldSpec; value?: string; error?: string }) {
  const id = `field-${spec.name}`;
  const common = {
    id,
    name: spec.name,
    defaultValue: value ?? spec.defaultValue,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{spec.label}</label>
      {spec.type === 'select' ? (
        <select {...common}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={spec.type ?? 'text'}
          autoComplete={spec.autoComplete}
          placeholder={spec.placeholder}
        />
      )}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-link">
      <input
        readOnly
        value={url}
        aria-label={t('common.copy_link')}
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        className="button secondary"
        onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
      >
        {copied ? t('common.copied') : t('common.copy_link')}
      </button>
    </div>
  );
}
