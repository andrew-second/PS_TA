import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ApiError, createCandidate } from './api';

type Props = {
  onCreated: (id: number) => void;
  onCancel: () => void;
};

const EMPTY_FORM = { name: '', email: '', phone: '', role: '', resume_text: '', source: '' };

export default function AddCandidateForm({ onCreated, onCancel }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function setField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  // The file is read here in the browser, so the server only ever receives plain text.
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setField('resume_text', await file.text());
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const candidate = await createCandidate(form);
      onCreated(candidate.id);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
      }
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="page-title">
        <h2>Add candidate</h2>
      </div>

      {error && <p className="error">{error}</p>}
      {Object.entries(fieldErrors).map(([field, messages]) => (
        <p className="error" key={field}>
          {field}: {messages.join(', ')}
        </p>
      ))}

      <div className="form-grid">
        <label>
          Name
          <input required value={form.name} onChange={(e) => setField('name', e.target.value)} />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
          />
        </label>
        <label>
          Phone (optional)
          <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
        </label>
        <label>
          Role applied for
          <input required value={form.role} onChange={(e) => setField('role', e.target.value)} />
        </label>
        <label>
          Source (optional)
          <input
            value={form.source}
            placeholder="Referral, LinkedIn..."
            onChange={(e) => setField('source', e.target.value)}
          />
        </label>
      </div>
      <label>
        Resume or cover letter: paste text, or upload a .txt file
        <textarea
          required
          rows={10}
          value={form.resume_text}
          onChange={(e) => setField('resume_text', e.target.value)}
        />
      </label>
      <input
        type="file"
        accept=".txt,text/plain"
        aria-label="Upload resume"
        onChange={handleFile}
      />

      <div className="actions">
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save candidate'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
