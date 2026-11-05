import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  addNote,
  archiveCandidate,
  generateSummary,
  getCandidate,
  STAGES,
  updateStage,
} from './api';
import type { CandidateWithNotes, Stage } from './api';
import SummarySection from './SummarySection';

type Props = {
  id: number;
  generateOnLoad: boolean;
  onBack: () => void;
};

export default function CandidateDetail({ id, generateOnLoad, onBack }: Props) {
  const [candidate, setCandidate] = useState<CandidateWithNotes | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      await generateSummary(id);
      setCandidate(await getCandidate(id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    // StrictMode runs this effect twice in development. The first run is marked stale,
    // so only the second one reaches handleGenerate, and only one summary is requested.
    let stale = false;
    getCandidate(id)
      .then((loaded) => {
        if (stale) return;
        setCandidate(loaded);
        if (generateOnLoad) {
          handleGenerate();
        }
      })
      .catch((err: Error) => {
        if (!stale) setError(err.message);
      });
    return () => {
      stale = true;
    };
  }, [id]);

  if (!candidate) {
    return (
      <section>
        <button onClick={onBack}>Back to list</button>
        {error ? <p className="error">{error}</p> : <p>Loading...</p>}
      </section>
    );
  }

  async function handleStageChange(stage: Stage) {
    setError('');
    try {
      const updated = await updateStage(id, stage);
      setCandidate((current) => current && { ...current, stage: updated.stage });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleAddNote(event: FormEvent) {
    event.preventDefault();
    setSavingNote(true);
    setError('');
    try {
      const note = await addNote(id, noteBody);
      setCandidate((current) => current && { ...current, notes: [...current.notes, note] });
      setNoteBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm(`Archive ${candidate?.name}? They will disappear from the list.`)) {
      return;
    }
    setError('');
    try {
      await archiveCandidate(id);
      onBack();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <button onClick={onBack}>Back to list</button>

      <h2>{candidate.name}</h2>
      {error && <p className="error">{error}</p>}

      <dl>
        <dt>Email</dt>
        <dd>{candidate.email}</dd>
        <dt>Phone</dt>
        <dd>{candidate.phone ?? 'Not provided'}</dd>
        <dt>Role</dt>
        <dd>{candidate.role}</dd>
        <dt>Source</dt>
        <dd>{candidate.source ?? 'Not provided'}</dd>
        <dt>Added</dt>
        <dd>{new Date(candidate.created_at).toLocaleString()}</dd>
      </dl>

      <label>
        Stage
        <select
          value={candidate.stage}
          onChange={(e) => handleStageChange(e.target.value as Stage)}
        >
          {STAGES.map((stage) => (
            <option key={stage}>{stage}</option>
          ))}
        </select>
      </label>

      <SummarySection
        summary={candidate.summary}
        problem={candidate.summary_problem}
        generating={generating}
        onGenerate={handleGenerate}
      />

      <h3>Notes</h3>
      {candidate.notes.length === 0 && <p>No notes yet.</p>}
      <ul>
        {candidate.notes.map((note) => (
          <li key={note.id}>
            <small>{new Date(note.created_at).toLocaleString()}</small>
            <p className="plain-text">{note.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddNote}>
        <label>
          Add a note
          <textarea
            required
            rows={3}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
        </label>
        <button type="submit" disabled={savingNote}>
          {savingNote ? 'Saving...' : 'Add note'}
        </button>
      </form>

      <h3>Resume</h3>
      <p className="plain-text">{candidate.resume_text}</p>

      <button onClick={handleArchive}>Archive candidate</button>
    </section>
  );
}
